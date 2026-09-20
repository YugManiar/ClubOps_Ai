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
  -- Maintained by trigger on feedback; never write these directly.
  average_rating numeric(3,2) not null default 0,
  rating_count   int not null default 0,
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

-- ── Feedback (validated by Gemini Flash before insert) ─────────────────
create table feedback (
  id                uuid primary key default uuid_generate_v4(),
  event_id          uuid not null references events(id) on delete cascade,
  member_id         uuid references members(id) on delete set null,
  rating            int not null check (rating between 1 and 5),
  raw_comment       text,
  validated_comment text,          -- Gemini's constructive rewrite
  is_constructive   boolean,
  created_at        timestamptz not null default now()
);
create index idx_feedback_event_id on feedback (event_id);

-- Keep events.average_rating / rating_count in sync with feedback.
create or replace function refresh_event_rating() returns trigger
language plpgsql as $$
declare eid uuid := coalesce(new.event_id, old.event_id);
begin
  update events e set
    average_rating = coalesce((select round(avg(rating)::numeric, 2) from feedback where event_id = eid), 0),
    rating_count   = (select count(*) from feedback where event_id = eid)
  where e.id = eid;
  return null;
end $$;

create trigger trg_feedback_rating
after insert or update or delete on feedback
for each row execute function refresh_event_rating();

-- ── Club documents (RAG corpus: past events, retros, budgets, etc.) ─────
create table club_documents (
  id          uuid primary key default uuid_generate_v4(),
  club_id     uuid references clubs(id) on delete cascade,
  source      text not null,
  chunk_index int not null default 0,
  content     text not null,
  metadata    jsonb not null default '{}',
  embedding   vector(768) not null,
  created_at  timestamptz not null default now()
);
create index idx_club_documents_club_id on club_documents (club_id);
create index idx_club_documents_embedding on club_documents
  using hnsw (embedding vector_cosine_ops);

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

-- ── Row Level Security ─────────────────────────────────────────────────
-- The browser uses the publishable (anon) key, so RLS must be on or anyone
-- could write to every table. Anon = read-only on display tables. All writes
-- go through the FastAPI backend with the secret key, which bypasses RLS.
-- meeting_notes and club_documents get no policy => invisible to the browser.
alter table clubs          enable row level security;
alter table members        enable row level security;
alter table events         enable row level security;
alter table tasks          enable row level security;
alter table feedback       enable row level security;
alter table agent_actions  enable row level security;
alter table meeting_notes  enable row level security;
alter table club_documents enable row level security;

create policy "anon read clubs"    on clubs         for select using (true);
create policy "anon read members"  on members       for select using (true);
create policy "anon read events"   on events        for select using (true);
create policy "anon read tasks"    on tasks         for select using (true);
create policy "anon read feedback" on feedback      for select using (true);
create policy "anon read actions"  on agent_actions for select using (true);
