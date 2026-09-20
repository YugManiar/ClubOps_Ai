-- 007: RAG relevance floor + vector index corrections. Run after 006.
--
-- Two problems in schema.sql:
--   1. match_club_documents took the top N neighbours with NO similarity
--      threshold, so a club with three retro docs answers a question about its
--      refund policy with the three least-unrelated chunks at similarity ~0.3 --
--      handed to the caller as authoritative context. Confident hallucination
--      with a citation attached.
--   2. `match_club_id is null` meant "search every club". That is the RAG-side
--      instance of the tenant leak fixed in 004, waiting for one caller to pass
--      null. The tenant is now required.

-- Signature changes (extra parameter), so the old overload must go first or
-- calls become ambiguous.
drop function if exists match_club_documents(vector(768), int, uuid);

create or replace function match_club_documents(
  query_embedding  vector(768),
  match_count      int   default 5,
  match_club_id    uuid  default null,
  min_similarity   float default 0.6
)
returns table (
  id uuid, source text, chunk_index int, content text,
  metadata jsonb, similarity float
)
language sql stable
as $$
  select id, source, chunk_index, content, metadata,
         1 - (embedding <=> query_embedding) as similarity
  from club_documents
  where match_club_id is not null           -- no wildcard: a null tenant matches nothing
    and club_id = match_club_id
    and 1 - (embedding <=> query_embedding) >= min_similarity
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- ── Vector indexes ─────────────────────────────────────────────────────
-- club_documents already had HNSW with vector_cosine_ops -- correct, kept.
-- meeting_notes had `ivfflat ... with (lists = 100)` created in schema.sql at
-- schema-creation time, i.e. ON AN EMPTY TABLE. IVFFlat derives its centroids
-- from the rows present when the index is built; built on zero rows it
-- partitions near-randomly and silently returns poor neighbours forever, with
-- nothing in the system reporting the low recall. HNSW has no training step.
drop index if exists idx_notes_embedding;

-- Raise the build memory for this session so the build stays in RAM.
set maintenance_work_mem = '256MB';

create index if not exists idx_notes_embedding on meeting_notes
  using hnsw (embedding vector_cosine_ops) with (m = 16, ef_construction = 64);

-- On a table with live traffic, build these with CREATE INDEX CONCURRENTLY
-- instead -- which cannot run inside a transaction, so run it as its own
-- statement, not as part of this script.

-- Makes the club_id filter in match_club_documents index-assisted.
create index if not exists idx_club_documents_club_created
  on club_documents (club_id, created_at desc);

-- ── Verification ───────────────────────────────────────────────────────
-- Recall knob, set per session by the caller. Default 40; raise toward 100 for
-- recall, lower for latency:
--   set hnsw.ef_search = 40;
--
-- Confirm the index is actually used. A Seq Scan here means the operator class
-- and the query operator disagree -- both must be cosine (vector_cosine_ops
-- and <=>). Mixing in <-> (L2) silently bypasses the index:
--   explain analyze
--   select 1 - (embedding <=> '[...]'::vector(768))
--   from club_documents where club_id = '...'
--   order by embedding <=> '[...]'::vector(768) limit 5;
--
-- Tune min_similarity against YOUR corpus before launch. gemini-embedding-001
-- at 768 dims puts unrelated club prose around 0.45-0.55, so 0.6 is a
-- defensible starting point, not a measured one.
