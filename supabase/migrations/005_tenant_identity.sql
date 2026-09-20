-- 005: make member identity tenant-scoped.
--
-- Two problems from schema.sql + 002:
--   1. `members.email text not null unique` is GLOBAL. One person cannot belong
--      to two clubs, and a signup whose address already exists in another
--      tenant hits a unique violation that handle_auth_user swallows -- leaving
--      an auth user with no member row and no error anywhere.
--   2. handle_auth_user dropped every new signup into
--      `(select id from clubs order by created_at limit 1)` -- i.e. whichever
--      club was created first. With more than one tenant, self-service signup
--      silently joins the wrong club.
--
-- Fix: uniqueness becomes (club_id, lower(email)), and club membership is
-- granted by an explicit invite rather than inferred. Run after 004.

-- ── 1. Email is unique within a club, not globally ─────────────────────
alter table members drop constraint if exists members_email_key;
drop index if exists members_email_key;

create unique index if not exists members_email_per_club
  on members (club_id, lower(email));

-- ── 2. Invites decide which club a new account joins ───────────────────
create table if not exists club_invites (
  email      text primary key check (email = lower(email)),
  club_id    uuid not null references clubs(id) on delete cascade,
  role       text not null default 'member' check (role in ('leader', 'member')),
  created_at timestamptz not null default now()
);
create index if not exists idx_club_invites_club on club_invites (club_id);

-- Backend-managed only: RLS on, no policy => invisible to the browser.
alter table club_invites enable row level security;

-- Keep every already-seeded, not-yet-claimed member reachable. Without this the
-- demo logins (priya@/dev@/alex@club.edu) could no longer link themselves.
insert into club_invites (email, club_id, role)
select lower(m.email), m.club_id, m.role
from members m
where m.auth_user_id is null
on conflict (email) do nothing;

-- ── 3. Signup handler ──────────────────────────────────────────────────
-- SECURITY, unchanged from 002 and still load-bearing: the role is NEVER read
-- from raw_user_meta_data (users control that field). It comes from the invite,
-- which only a leader can write. A pre-seeded row is still only claimed by an
-- account whose email is CONFIRMED, so nobody takes over a leader row by
-- signing up with their address.
create or replace function public.handle_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  invite     club_invites%rowtype;
  existing   members%rowtype;
  club_count int;
begin
  if exists (select 1 from members where auth_user_id = new.id) then
    return new;
  end if;

  select * into invite from club_invites where email = lower(new.email);

  if not found then
    -- No invite. With exactly ONE club there is no ambiguity about which club
    -- this account belongs to, so open sign-up still works. With two or more,
    -- the club is genuinely unknowable from an email address and we must not
    -- guess -- guessing was the original bug (002 used
    -- `order by created_at limit 1`, silently joining whichever club existed
    -- first). Sign-up itself is never blocked either way: /dashboard already
    -- renders an "account not set up yet" state for a user with no member row.
    select count(*) into club_count from clubs;
    if club_count <> 1 then
      return new;
    end if;
    select id into invite.club_id from clubs limit 1;
    invite.role := 'member';  -- never from raw_user_meta_data; users control that
  end if;

  select * into existing from members
   where club_id = invite.club_id and lower(email) = lower(new.email);

  if found then
    if existing.auth_user_id is null and new.email_confirmed_at is not null then
      update members set auth_user_id = new.id where id = existing.id;
      delete from club_invites where email = lower(new.email);
    end if;
    return new;
  end if;

  if new.email_confirmed_at is null then
    return new;  -- the on_auth_user_confirmed trigger will finish the job
  end if;

  insert into members (club_id, full_name, email, role, auth_user_id)
  values (
    invite.club_id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    new.email,
    invite.role,
    new.id
  );
  delete from club_invites where email = lower(new.email);
  return new;
end $$;

-- Triggers are unchanged from 002; re-asserted here so this file is idempotent.
drop trigger if exists on_auth_user_created   on auth.users;
drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user();
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_auth_user();

-- ── Operating this ─────────────────────────────────────────────────────
-- While the project has exactly ONE club, open sign-up keeps working and you
-- need none of this. Invites become REQUIRED the moment a second club exists.
--
-- Invite someone into a specific club:
--   insert into club_invites (email, club_id, role)
--   values (lower('newmember@club.edu'), '<club uuid>', 'member');
--
-- Promote an existing member:
--   update members set role = 'leader' where id = '<member uuid>';
--
-- DOWN (manual): drop club_invites, drop index members_email_per_club, restore
-- `alter table members add constraint members_email_key unique (email)`, and
-- re-create handle_auth_user from 002 section 4.
