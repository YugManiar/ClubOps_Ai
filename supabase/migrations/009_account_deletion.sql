-- 009: make deleting an account actually delete the person. Run after 008.
--
-- Self-service deletion works by removing the Supabase auth user
-- (POST /me/delete -> auth.admin.delete_user). Two foreign keys stood in the
-- way of that meaning "delete my data":
--
-- 1. members.auth_user_id -> auth.users was ON DELETE SET NULL (002).
--    Deleting the login left the members row behind, still holding the person's
--    name and email, merely unlinked. The row must go with the login.
--
-- 2. feedback.subject_member_id -> members was ON DELETE SET NULL (006).
--    THAT WAS A BUG IN 006. A null subject_member_id does not mean "unknown":
--    in this schema it means "a rating of the event itself"
--    (recompute_event_rating counts rows where subject_member_id is null).
--    So deleting a member converted every personal review of them into an event
--    rating and silently shifted that event's average. 006's stated reason --
--    that cascading would move event averages -- had it backwards: event
--    averages only count subject-null rows, so deleting subject rows leaves
--    them untouched, and SET NULL is what moved them.
--    Reviews ABOUT a person are that person's data. They go with them.
--
-- What deliberately survives a deletion:
--   * feedback the person WROTE (feedback.member_id stays SET NULL): a leader's
--     assessment of someone else is that other person's record, kept anonymised;
--   * tasks they were assigned (tasks.assignee_id stays SET NULL): they become
--     unassigned rather than vanishing from the event's plan.

-- ── 1. auth user deletion removes the member row ───────────────────────
-- Look the constraint up rather than trusting its name: it was created inline
-- by `add column ... references`, so the name is auto-generated.
do $$
declare fk text;
begin
  for fk in
    select conname from pg_constraint
    where conrelid = 'public.members'::regclass
      and contype = 'f'
      and confrelid = 'auth.users'::regclass
  loop
    execute format('alter table public.members drop constraint %I', fk);
  end loop;
end $$;

alter table members
  add constraint members_auth_user_id_fkey
  foreign key (auth_user_id) references auth.users(id) on delete cascade;

-- ── 2. reviews about a member go with the member (corrects 006) ────────
alter table feedback drop constraint if exists feedback_subject_member_id_fkey;
alter table feedback
  add constraint feedback_subject_member_id_fkey
  foreign key (subject_member_id) references members(id) on delete cascade;

-- ── 3. the rating trigger must not depend on WHO deletes the user ──────
-- Deleting an auth user is executed by Supabase's auth service (GoTrue), which
-- connects as the role supabase_auth_admin. That role has search_path = auth and
-- NO privileges on the public tables. The cascade deletes (or nulls the author
-- of) the person's feedback rows, which fires trg_feedback_rating ->
-- refresh_event_rating() -> recompute_event_rating(). Two things went wrong:
--
--   a) the functions use unqualified names, so under GoTrue's path they fail
--      with "function recompute_event_rating(uuid) does not exist";
--   b) even with the path fixed, refresh_event_rating() runs with the privileges
--      of whoever caused it, and supabase_auth_admin cannot UPDATE public.events.
--
-- Either one makes GoTrue answer "Database error deleting user" and roll the
-- whole deletion back. It only appears when the person has feedback attached, and
-- it is invisible from the SQL editor (a superuser with public on its path).
-- Verified against the real API: tasks and plan_jobs deleted fine; any user with
-- a review about them or written by them returned HTTP 500.
--
-- Fix: the trigger function runs as its owner, with a pinned search_path (which
-- is what makes SECURITY DEFINER safe). The two helpers it calls then also run as
-- the owner. They stay SECURITY INVOKER on purpose: they are callable through the
-- API as RPCs, and an invoker function called that way is still bound by RLS.
alter function public.refresh_event_rating()        set search_path = public;
alter function public.recompute_event_rating(uuid)  set search_path = public;
alter function public.recompute_member_rating(uuid) set search_path = public;
alter function public.refresh_event_rating()        security definer;

-- ── Verification ───────────────────────────────────────────────────────
--   select c.conrelid::regclass as child, a.attname as col, c.confrelid::regclass as parent,
--          case c.confdeltype when 'c' then 'CASCADE' when 'n' then 'SET NULL' else 'NO ACTION' end as on_delete
--   from pg_constraint c join unnest(c.conkey) k on true
--   join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k
--   where c.contype = 'f' and c.confrelid in ('public.members'::regclass, 'auth.users'::regclass)
--     and c.connamespace = 'public'::regnamespace order by 3, 1;
--
-- Expect: members.auth_user_id CASCADE, feedback.subject_member_id CASCADE,
--         feedback.member_id / tasks.assignee_id / plan_jobs.member_id SET NULL.
--
-- DOWN (manual): recreate both constraints with `on delete set null`.
