-- 006: referential integrity fixes + the planning job queue.
--
-- ON DELETE CASCADE was already correct almost everywhere (tasks.event_id,
-- feedback.event_id, agent_actions.event_id, meeting_notes.event_id,
-- events.club_id, members.club_id, club_documents.club_id). The defect is the
-- opposite: one cascade that destroys history. Run after 005.

-- !! CORRECTED BY 009. The reasoning below is wrong and the SET NULL it applies to
-- !! feedback.subject_member_id is a bug: a null subject means "a rating of the event
-- !! itself", so deleting a member turned reviews about them into event ratings and
-- !! moved event averages. 009 restores ON DELETE CASCADE for that column.
-- ── 1. Deleting a member must not rewrite past event ratings ───────────
-- 002 made feedback.subject_member_id `on delete cascade`, so removing a
-- departed member DELETED every rating row naming them -- which fires
-- refresh_event_rating and silently moves the average_rating of every event
-- they were rated on. Ratings are historical facts: keep the row, drop the
-- link. (feedback.member_id, the author, is already `on delete set null`.)
alter table feedback drop constraint if exists feedback_subject_member_id_fkey;
alter table feedback
  add constraint feedback_subject_member_id_fkey
  foreign key (subject_member_id) references members(id) on delete set null;

-- Note on trg_feedback_rating: it stays `for each row`. It is correct as
-- written; the only bulk path is a cascade delete of an event's feedback, and
-- that recomputes the rating of an event that is itself being removed. A
-- statement-level rewrite with transition tables would need three separate
-- trigger functions and buys nothing at this scale.

-- ── 2. Planning jobs ───────────────────────────────────────────────────
-- /api/events/plan used to run a ~45s Gemini generation inside the request.
-- It now enqueues here and returns 202; the client polls. See
-- backend/app/routers/planning.py.
create table if not exists plan_jobs (
  id         uuid primary key default uuid_generate_v4(),
  club_id    uuid not null references clubs(id) on delete cascade,
  member_id  uuid references members(id) on delete set null,  -- who asked
  status     text not null default 'pending'
             check (status in ('pending', 'running', 'done', 'failed')),
  prompt     text not null,
  event_id   uuid references events(id) on delete set null,
  error      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_plan_jobs_club on plan_jobs (club_id, created_at desc);

-- Polled through FastAPI (which scopes by club), never read from the browser:
-- RLS on with no policy.
alter table plan_jobs enable row level security;

-- ── Verification ───────────────────────────────────────────────────────
-- Audit what actually cascades, so this never drifts again. confdeltype:
-- 'c' = cascade, 'n' = set null, 'a' = no action (a future orphan).
--
--   select c.conrelid::regclass as child, a.attname as col,
--          c.confrelid::regclass as parent, c.confdeltype as on_delete
--   from pg_constraint c
--   join unnest(c.conkey) k on true
--   join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k
--   where c.contype = 'f' and c.connamespace = 'public'::regnamespace
--   order by 1;
--
-- Any 'c' pointing at members from a historical table (feedback, agent_actions)
-- is a silent data-loss path and should be 'n'.
