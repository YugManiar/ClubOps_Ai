-- 002: link members to Supabase Auth, add leader/member roles, per-member
-- ratings and role-aware row level security. Run in the Supabase SQL editor
-- after schema.sql + seed.sql. Safe to run once; see the DOWN notes at the end.

-- ── 1. members <-> auth.users ──────────────────────────────────────────
-- We keep `members` as the app's user table (it already holds the club and
-- role). auth_user_id is the link to the hidden auth.users row.
alter table members
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null,
  add column if not exists average_rating numeric(3,2) not null default 0,
  add column if not exists rating_count   int          not null default 0;

-- ── 2. Roles: 'leader' | 'member' ──────────────────────────────────────
alter table members drop constraint if exists members_role_check;
update members set role = case role when 'lead' then 'leader' else 'member' end
  where role in ('lead', 'officer');
alter table members add constraint members_role_check check (role in ('leader', 'member'));
alter table members alter column role set default 'member';

-- ── 3. Feedback is written by a leader ABOUT a member ──────────────────
-- member_id        = author (a leader)
-- subject_member_id = the member being rated (null => rating of the event itself)
alter table feedback
  add column if not exists subject_member_id uuid references members(id) on delete cascade;
create index if not exists idx_feedback_subject on feedback (subject_member_id);

create or replace function recompute_event_rating(eid uuid) returns void
language sql as $$
  update events e set
    average_rating = coalesce((select round(avg(rating)::numeric, 2) from feedback
                               where event_id = eid and subject_member_id is null), 0),
    rating_count   = (select count(*) from feedback where event_id = eid and subject_member_id is null)
  where e.id = eid;
$$;

create or replace function recompute_member_rating(mid uuid) returns void
language sql as $$
  update members m set
    average_rating = coalesce((select round(avg(rating)::numeric, 2) from feedback
                               where subject_member_id = mid), 0),
    rating_count   = (select count(*) from feedback where subject_member_id = mid)
  where m.id = mid;
$$;

-- Replaces the old event-only function; the trigger trg_feedback_rating keeps pointing at it.
create or replace function refresh_event_rating() returns trigger
language plpgsql as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform recompute_event_rating(old.event_id);
    if old.subject_member_id is not null then perform recompute_member_rating(old.subject_member_id); end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform recompute_event_rating(new.event_id);
    if new.subject_member_id is not null then perform recompute_member_rating(new.subject_member_id); end if;
  end if;
  return null;
end $$;

-- ── 4. Auto-create / link a members row when someone signs up ──────────
-- SECURITY: the role is ALWAYS 'member' here. It is never read from
-- raw_user_meta_data (users control that field). Promote leaders in SQL:
--   update members set role = 'leader' where email = '...';
-- An existing (seeded) member row is only claimed by an account whose email is
-- CONFIRMED, so nobody can take over a leader row by signing up with their email.
create or replace function public.handle_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  existing members%rowtype;
  target_club uuid;
begin
  if exists (select 1 from members where auth_user_id = new.id) then
    return new;
  end if;

  select * into existing from members where lower(email) = lower(new.email);
  if found then
    if existing.auth_user_id is null and new.email_confirmed_at is not null then
      update members set auth_user_id = new.id where id = existing.id;
    end if;
    return new;
  end if;

  select id into target_club from clubs order by created_at limit 1;
  if target_club is null then return new; end if;   -- no club yet: never block sign-up

  insert into members (club_id, full_name, email, role, auth_user_id)
  values (
    target_club,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    new.email, 'member', new.id
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created   on auth.users;
drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user();
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_auth_user();

-- ── 5. Role-aware RLS (browser reads use the logged-in user's JWT) ─────
-- security definer so these helpers can read members without recursing into RLS.
create or replace function public.current_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from members where auth_user_id = auth.uid()
$$;
create or replace function public.current_member_role() returns text
language sql stable security definer set search_path = public as $$
  select role from members where auth_user_id = auth.uid()
$$;

drop policy if exists "anon read clubs"    on clubs;
drop policy if exists "anon read members"  on members;
drop policy if exists "anon read events"   on events;
drop policy if exists "anon read tasks"    on tasks;
drop policy if exists "anon read feedback" on feedback;
drop policy if exists "anon read actions"  on agent_actions;

-- Logged-out visitors (anon) now see nothing. Writes still go through FastAPI.
create policy "auth read clubs"  on clubs  for select to authenticated using (true);
create policy "auth read events" on events for select to authenticated using (true);

create policy "leader all, member self" on members for select to authenticated
  using (current_member_role() = 'leader' or auth_user_id = auth.uid());

create policy "leader all, member assigned" on tasks for select to authenticated
  using (current_member_role() = 'leader' or assignee_id = current_member_id());

create policy "leader all, member about self" on feedback for select to authenticated
  using (current_member_role() = 'leader' or subject_member_id = current_member_id());

create policy "leader reads actions" on agent_actions for select to authenticated
  using (current_member_role() = 'leader');

-- DOWN (manual): drop the two triggers on auth.users, the policies above,
-- then re-create the "anon read *" policies from schema.sql.
