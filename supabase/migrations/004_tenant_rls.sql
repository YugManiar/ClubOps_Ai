-- 004: club-scoped Row Level Security.
--
-- 002 scoped every policy by ROLE but never by CLUB: "auth read events" was
-- `using (true)`, and members/tasks/feedback/agent_actions all resolved to
-- `current_member_role() = 'leader'` -- true for a leader of ANY club. Since the
-- browser holds the anon key, one login could read every tenant's rows straight
-- off the PostgREST API.
--
-- Every policy below is anchored on current_club_id(). Run after 002/003.

-- ── Tenant anchor ──────────────────────────────────────────────────────
-- security definer so it can read `members` without recursing into members' RLS.
create or replace function public.current_club_id() returns uuid
language sql stable security definer set search_path = public as $$
  select club_id from members where auth_user_id = auth.uid()
$$;

revoke execute on function public.current_club_id() from public, anon;
grant  execute on function public.current_club_id() to authenticated;

-- ── Replace the role-only policies from 002 ────────────────────────────
drop policy if exists "auth read clubs"            on clubs;
drop policy if exists "auth read events"           on events;
drop policy if exists "leader all, member self"        on members;
drop policy if exists "leader all, member assigned"    on tasks;
drop policy if exists "leader all, member about self"  on feedback;
drop policy if exists "leader reads actions"           on agent_actions;

-- A user sees exactly one club: their own.
create policy "own club" on clubs for select to authenticated
  using (id = current_club_id());

create policy "own club" on events for select to authenticated
  using (club_id = current_club_id());

-- Club first, then role. A leader of club A is not a leader of club B.
create policy "own club, scoped by role" on members for select to authenticated
  using (
    club_id = current_club_id()
    and (current_member_role() = 'leader' or auth_user_id = auth.uid())
  );

create policy "own club, scoped by role" on tasks for select to authenticated
  using (
    exists (select 1 from events e where e.id = tasks.event_id
                                     and e.club_id = current_club_id())
    and (current_member_role() = 'leader' or assignee_id = current_member_id())
  );

create policy "own club, scoped by role" on feedback for select to authenticated
  using (
    exists (select 1 from events e where e.id = feedback.event_id
                                     and e.club_id = current_club_id())
    and (current_member_role() = 'leader' or subject_member_id = current_member_id())
  );

create policy "own club leaders" on agent_actions for select to authenticated
  using (
    current_member_role() = 'leader'
    and exists (select 1 from events e where e.id = agent_actions.event_id
                                         and e.club_id = current_club_id())
  );

-- meeting_notes and club_documents keep RLS on with NO policy: invisible to the
-- browser entirely. Only the backend's service key touches them.

-- The exists() subqueries above run per row; these keep them index-assisted.
create index if not exists idx_tasks_event_id    on tasks (event_id);
create index if not exists idx_feedback_event_id on feedback (event_id);

-- ── Verification ───────────────────────────────────────────────────────
-- Impersonate a user and confirm the counts are per-club, not global:
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<auth_user_id>","role":"authenticated"}';
--   select count(*) from events;   -- must be that club's count, not the global one
--
-- DOWN (manual): drop the six policies above and current_club_id(), then
-- re-create the policies from 002 section 5.
