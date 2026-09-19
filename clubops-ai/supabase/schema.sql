-- ClubOps AI schema. Run this whole file in the Supabase SQL editor.

create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- ── Clubs ──────────────────────────────────────────────────────────────
create table clubs (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- ── Members ────────────────────────────────────────────────────────────
create table members (
  id         uuid primary key default uuid_generate_v4(),
  club_id    uuid not null references clubs(id) on delete cascade,
  full_name  text not null,
  email      text not null unique,
  role       text not null default 'member'
             check (role in ('lead', 'officer', 'member')),
  created_at timestamptz not null default now()
);

-- ── Events ─────────────────────────────────────────────────────────────
create table events (
  id          uuid primary key default uuid_generate_v4(),
  club_id     uuid not null references clubs(id) on delete cascade,
  name        text not null,
  description text,
  location    text,
  start_time  timestamptz not null,
  end_time    timestamptz,
  status      text not null default 'planning'
              check (status in ('planning', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  created_at  timestamptz not null default now()
);

-- ── Tasks ──────────────────────────────────────────────────────────────
create table tasks (
  id          uuid primary key default uuid_generate_v4(),
  event_id    uuid not null references events(id) on delete cascade,
  assignee_id uuid references members(id) on delete set null,
  title       text not null,
  description text,
  status      text not null default 'todo'
              check (status in ('todo', 'in_progress', 'blocked', 'done')),
  priority    text not null default 'medium'
              check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date    timestamptz,
  created_at  timestamptz not null default now()
);

-- ── Meeting notes (semantic recall via pgvector) ─────────────────────────
create table meeting_notes (
  id         uuid primary key default uuid_generate_v4(),
  event_id   uuid not null references events(id) on delete cascade,
  raw_text   text not null,
  embedding  vector(768),
  processed  boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── Agent audit log (demo-critical: show judges the AI acting) ─────────
create table agent_actions (
  id          uuid primary key default uuid_generate_v4(),
  event_id    uuid references events(id) on delete cascade,
  action_type text not null,
  payload     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index idx_tasks_event_id     on tasks (event_id);
create index idx_tasks_assignee_id  on tasks (assignee_id);
create index idx_members_club_id    on members (club_id);
create index idx_events_club_id     on events (club_id);
create index idx_notes_embedding    on meeting_notes
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Semantic search over a single event's meeting notes.
create or replace function match_meeting_notes(
  query_embedding vector(768),
  match_event_id  uuid,
  match_count     int default 5
)
returns table (id uuid, raw_text text, similarity float)
language sql stable
as $$
  select id, raw_text, 1 - (embedding <=> query_embedding) as similarity
  from meeting_notes
  where event_id = match_event_id
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- ── Club documents (RAG corpus: past events, retros, budgets, etc.) ─────
-- Run this block on its own if the rest of the schema is already applied.
create table if not exists club_documents (
  id         uuid primary key default uuid_generate_v4(),
  club_id    uuid references clubs(id) on delete cascade,
  source     text not null,
  chunk_index int not null default 0,
  content    text not null,
  metadata   jsonb not null default '{}',
  embedding  vector(768) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_club_documents_club_id on club_documents (club_id);
create index if not exists idx_club_documents_embedding on club_documents
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Cosine-similarity search. match_club_id null = search every club.
create or replace function match_club_documents(
  query_embedding vector(768),
  match_count     int default 5,
  match_club_id   uuid default null
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
  where match_club_id is null or club_id = match_club_id
  order by embedding <=> query_embedding
  limit match_count;
$$;
