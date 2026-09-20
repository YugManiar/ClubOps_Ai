-- 008: let the person choose "leader" or "member" on the sign-up form.
-- Run after 005 (it uses club_invites).
--
-- ┌──────────────────────────────────────────────────────────────────────┐
-- │ DELIBERATE SECURITY TRADE-OFF -- chosen by the product owner.        │
-- │                                                                      │
-- │ 002 hard-coded role = 'member' and said, in capitals, that the role  │
-- │ must never be read from raw_user_meta_data, because that field is    │
-- │ controlled by the person signing up. This migration reverses that.   │
-- │                                                                      │
-- │ Consequence: anyone who can reach /signup can self-elect to          │
-- │ 'leader'. A leader can read every member, task and feedback row in   │
-- │ the club, delete feedback, and drive the agent's write tools. There  │
-- │ is NO verification step. This is acceptable for a closed demo and    │
-- │ is not acceptable once real club data is in the database.            │
-- │                                                                      │
-- │ To close it later, pick one and the rest of the app is unchanged:    │
-- │   a) leader access code -- add clubs.leader_code_hash, verify it     │
-- │      here before honouring 'leader';                                 │
-- │   b) approval -- insert as 'member' with a pending_role, and let an  │
-- │      existing leader promote;                                        │
-- │   c) revert to 005: delete the raw_user_meta_data branch below, so   │
-- │      only invites and the bootstrap rule can produce a leader.       │
-- └──────────────────────────────────────────────────────────────────────┘
--
-- Precedence, highest first:
--   1. An existing (seeded) member row  -> keeps whatever role it already has.
--   2. A club_invites row               -> the inviting leader's choice wins,
--                                          so an invite cannot be overridden
--                                          by what the invitee typed.
--   3. Bootstrap: club has no leader    -> this account becomes the leader.
--   4. The sign-up form's choice        -> 'leader' or anything else = 'member'.

create or replace function public.handle_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  invite       club_invites%rowtype;
  existing     members%rowtype;
  club_count   int;
  leader_count int;
  target_club  uuid;
  target_role  text;
  requested    text;
begin
  if exists (select 1 from members where auth_user_id = new.id) then
    return new;
  end if;

  -- ── Which club? ──────────────────────────────────────────────────────
  select * into invite from club_invites where email = lower(new.email);
  if found then
    target_club := invite.club_id;
  else
    -- With exactly one club there is no ambiguity. With two or more the club
    -- is unknowable from an email address, so we refuse to guess.
    select count(*) into club_count from clubs;
    if club_count <> 1 then
      return new;
    end if;
    select id into target_club from clubs limit 1;
  end if;

  -- ── Claiming a pre-seeded row keeps that row's existing role ─────────
  -- Only an account with a CONFIRMED email may claim one, so nobody takes
  -- over a leader row just by signing up with their address.
  select * into existing from members
   where club_id = target_club and lower(email) = lower(new.email);
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

  -- ── Which role? ──────────────────────────────────────────────────────
  if invite.role is not null then
    target_role := invite.role;  -- an explicit grant by a leader outranks the form
  else
    -- UNVERIFIED, user-supplied. See the banner at the top of this file.
    requested := lower(nullif(trim(new.raw_user_meta_data->>'role'), ''));
    target_role := case when requested = 'leader' then 'leader' else 'member' end;
  end if;

  -- Bootstrap: a club with nobody in charge gets a leader regardless of what
  -- was asked for. Without this the first person into a fresh club could lock
  -- everyone out of the leader-only screens.
  select count(*) into leader_count
    from members where club_id = target_club and role = 'leader';
  if leader_count = 0 then
    target_role := 'leader';
  end if;

  insert into members (club_id, full_name, email, role, auth_user_id)
  values (
    target_club,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    new.email,
    target_role,
    new.id
  );
  delete from club_invites where email = lower(new.email);
  return new;
end $$;

-- ── Backfill: accounts created before this migration ───────────────────
-- handle_auth_user only fires on insert/confirm, so anyone who already signed
-- up and picked "leader" is sitting in members with role = 'member' (002
-- discarded their choice). Apply retroactively what each of them actually
-- chose at sign-up. Promotes only; never demotes an existing leader.
update members m
   set role = 'leader'
  from auth.users u
 where u.id = m.auth_user_id
   and m.role <> 'leader'
   and lower(u.raw_user_meta_data->>'role') = 'leader';

-- ── Verification ───────────────────────────────────────────────────────
-- Who ended up with what, and how many leaders exist per club:
--   select c.name, m.email, m.role, m.auth_user_id is not null as linked
--   from members m join clubs c on c.id = m.club_id
--   order by c.name, m.role desc, m.email;
--
-- Demote someone who self-elected:
--   update members set role = 'member' where email = '...';
