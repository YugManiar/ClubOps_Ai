-- ClubOps AI — Supabase schema + Row Level Security
-- Paste into the Supabase SQL editor. Safe to run on a fresh project.

create extension if not exists vector;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.clubs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- App-level user profile; 1:1 with Supabase auth.users.
create table public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  club_id     uuid not null references public.clubs (id) on delete cascade,
  full_name   text not null,
  email       text not null unique,
  role        text not null default 'member' check (role in ('admin', 'member')),
  created_at  timestamptz not null default now()
);
create index users_club_id_idx on public.users (club_id);

create table public.events (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs (id) on delete cascade,
  created_by  uuid references public.users (id) on delete set null,
  name        text not null,
  description text,
  status      text not null default 'planning'
              check (status in ('planning', 'confirmed', 'live', 'completed', 'cancelled')),
  start_time  timestamptz,
  created_at  timestamptz not null default now()
);
create index events_club_id_idx on public.events (club_id);

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events (id) on delete cascade,
  assignee_id  uuid references public.users (id) on delete set null,
  title        text not null,
  description  text,
  status       text not null default 'todo'
               check (status in ('todo', 'in_progress', 'blocked', 'done')),
  priority     text not null default 'medium'
               check (priority in ('low', 'medium', 'high')),
  due_date     timestamptz,
  created_at   timestamptz not null default now()
);
create index tasks_event_id_idx    on public.tasks (event_id);
create index tasks_assignee_id_idx on public.tasks (assignee_id);

-- RAG store. 768 dims = Gemini text-embedding-004; change if the model changes.
create table public.club_documents (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs (id) on delete cascade,
  event_id    uuid references public.events (id) on delete set null,
  title       text not null,
  content     text not null,
  embedding   vector(768),
  created_by  uuid references public.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index club_documents_club_id_idx on public.club_documents (club_id);
create index club_documents_embedding_idx
  on public.club_documents using hnsw (embedding vector_cosine_ops);

-- Similarity search, scoped to a club. SECURITY INVOKER so RLS still applies.
create or replace function public.match_club_documents(
  query_embedding vector(768),
  match_club_id   uuid,
  match_count     int default 5
)
returns table (id uuid, title text, content text, similarity float)
language sql stable security invoker
as $$
  select d.id, d.title, d.content, 1 - (d.embedding <=> query_embedding) as similarity
  from public.club_documents d
  where d.club_id = match_club_id and d.embedding is not null
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

-- ---------------------------------------------------------------------------
-- RLS helpers (SECURITY DEFINER so policies on public.users don't recurse)
-- ---------------------------------------------------------------------------

create or replace function public.current_user_club_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select club_id from public.users where id = auth.uid() $$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.users where id = auth.uid() and role = 'admin') $$;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------

alter table public.clubs          enable row level security;
alter table public.users          enable row level security;
alter table public.events         enable row level security;
alter table public.tasks          enable row level security;
alter table public.club_documents enable row level security;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- clubs: read own club
create policy clubs_select on public.clubs
  for select to authenticated
  using (id = public.current_user_club_id());

-- users: read fellow club members; admins manage roster
create policy users_select on public.users
  for select to authenticated
  using (club_id = public.current_user_club_id());

create policy users_admin_write on public.users
  for all to authenticated
  using (public.is_admin() and club_id = public.current_user_club_id())
  with check (public.is_admin() and club_id = public.current_user_club_id());

-- events: everyone in the club reads; ONLY admins insert
create policy events_select on public.events
  for select to authenticated
  using (club_id = public.current_user_club_id());

create policy events_insert_admin on public.events
  for insert to authenticated
  with check (public.is_admin() and club_id = public.current_user_club_id());

create policy events_update_admin on public.events
  for update to authenticated
  using (public.is_admin() and club_id = public.current_user_club_id())
  with check (public.is_admin() and club_id = public.current_user_club_id());

create policy events_delete_admin on public.events
  for delete to authenticated
  using (public.is_admin() and club_id = public.current_user_club_id());

-- tasks: club members read; admins create/delete; members and admins may UPDATE
-- (column restriction for members is enforced by the trigger below)
create policy tasks_select on public.tasks
  for select to authenticated
  using (exists (select 1 from public.events e
                 where e.id = tasks.event_id and e.club_id = public.current_user_club_id()));

create policy tasks_insert_admin on public.tasks
  for insert to authenticated
  with check (public.is_admin() and exists (select 1 from public.events e
                 where e.id = tasks.event_id and e.club_id = public.current_user_club_id()));

create policy tasks_delete_admin on public.tasks
  for delete to authenticated
  using (public.is_admin() and exists (select 1 from public.events e
                 where e.id = tasks.event_id and e.club_id = public.current_user_club_id()));

create policy tasks_update on public.tasks
  for update to authenticated
  using (exists (select 1 from public.events e
                 where e.id = tasks.event_id and e.club_id = public.current_user_club_id()))
  with check (exists (select 1 from public.events e
                 where e.id = tasks.event_id and e.club_id = public.current_user_club_id()));

-- RLS is row-level only, so limit non-admins to changing `status` via a trigger.
-- auth.uid() is null for service-role/backend connections, which are exempt.
create or replace function public.enforce_member_task_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if (new.id, new.event_id, new.assignee_id, new.title, new.description,
      new.priority, new.due_date, new.created_at)
     is distinct from
     (old.id, old.event_id, old.assignee_id, old.title, old.description,
      old.priority, old.due_date, old.created_at) then
    raise exception 'Members may only update task status';
  end if;

  return new;
end;
$$;

create trigger tasks_member_status_only
  before update on public.tasks
  for each row execute function public.enforce_member_task_update();

-- club_documents: club members read; admins write
create policy club_documents_select on public.club_documents
  for select to authenticated
  using (club_id = public.current_user_club_id());

create policy club_documents_admin_write on public.club_documents
  for all to authenticated
  using (public.is_admin() and club_id = public.current_user_club_id())
  with check (public.is_admin() and club_id = public.current_user_club_id());
