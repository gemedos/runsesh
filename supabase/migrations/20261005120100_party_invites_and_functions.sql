-- 9: invite links and the functions that change party membership.
--
-- Invite codes: CLAUDE.md "Development derived exceptions → Party invite codes".
-- 18 random bytes (pgcrypto gen_random_bytes) as base64url = 24 characters. Only the SHA-256
-- hash is stored. Valid 7 days, at most 25 joins, revocable. Joining is rate limited per user.
--
-- The functions below are SECURITY DEFINER: they change rows that clients cannot write
-- directly, i.e. they work around RLS by design (approved under CLAUDE.md §4 on 2026-10-05).
-- Each one checks the caller (auth.uid()) and their role itself. search_path is '' and every
-- name is fully qualified. Errors are raised with short codes the app maps to generic messages.

create table public.party_invites (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  code_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  max_uses integer not null default 25,
  uses integer not null default 0,
  revoked_at timestamptz,

  constraint party_invites_hash_check check (code_hash ~ '^[0-9a-f]{64}$'),
  constraint party_invites_uses_check check (uses >= 0 and uses <= max_uses and max_uses between 1 and 25)
);

create index party_invites_party_idx on public.party_invites (party_id);

revoke all on table public.party_invites from public, anon, authenticated;
grant select on table public.party_invites to authenticated;
alter table public.party_invites enable row level security;

-- Members see the invites THEY created (never the code, only its status).
create policy "party_invites: read own invites"
  on public.party_invites for select to authenticated
  using (created_by = (select auth.uid()));

-- Now that party_invites exists, attach the handover trigger from the previous migration.
create trigger party_members_after_delete
  after delete on public.party_members
  for each row execute function private.after_member_removed();

-- Join / preview attempts per user (private schema: not reachable through the API).
create table private.join_attempts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  window_start timestamptz not null,
  attempts integer not null default 0
);
revoke all on table private.join_attempts from public, anon, authenticated;

/**
 * Counts one attempt. Returns false once a user has made 10 attempts in the current hour.
 * It returns instead of raising: an exception would roll back the counter itself, so
 * failed guesses would never be counted.
 */
create or replace function private.count_join_attempt(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  a private.join_attempts%rowtype;
  now_ts timestamptz := pg_catalog.now();
begin
  select * into a from private.join_attempts where user_id = p_user for update;
  if not found then
    insert into private.join_attempts (user_id, window_start, attempts) values (p_user, now_ts, 1);
  elsif a.window_start <= now_ts - interval '1 hour' then
    update private.join_attempts set window_start = now_ts, attempts = 1 where user_id = p_user;
  elsif a.attempts >= 10 then
    return false;
  else
    update private.join_attempts set attempts = attempts + 1 where user_id = p_user;
  end if;
  return true;
end;
$$;
revoke all on function private.count_join_attempt(uuid) from public, anon, authenticated;

create or replace function private.hash_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.encode(extensions.digest(p_code, 'sha256'), 'hex');
$$;
revoke all on function private.hash_code(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public functions (callable by signed-in users through the API)
-- ---------------------------------------------------------------------------

create or replace function public.create_party(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  clean text := pg_catalog.btrim(coalesce(p_name, ''));
  new_id uuid;
begin
  if uid is null then raise exception 'not_signed_in' using errcode = 'P0001'; end if;
  if pg_catalog.char_length(clean) not between 2 and 30 then raise exception 'invalid_name' using errcode = 'P0001'; end if;
  if exists (select 1 from public.party_members where user_id = uid) then
    raise exception 'already_in_party' using errcode = 'P0001';
  end if;
  insert into public.parties (name) values (clean) returning id into new_id;
  insert into public.party_members (user_id, party_id, role) values (uid, new_id, 'leader');
  return new_id;
end;
$$;

/** Any member creates an invite. Returns the code ONCE (only its hash is stored). */
create or replace function public.create_invite()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  pid uuid;
  code text;
begin
  select party_id into pid from public.party_members where user_id = uid;
  if pid is null then raise exception 'not_in_party' using errcode = 'P0001'; end if;
  -- At most 10 active links per person, so nobody can flood the table.
  if (select count(*) from public.party_invites
        where created_by = uid and revoked_at is null and expires_at > pg_catalog.now() and uses < max_uses) >= 10 then
    raise exception 'too_many_invites' using errcode = 'P0001';
  end if;
  code := pg_catalog.translate(pg_catalog.encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_');
  insert into public.party_invites (party_id, created_by, code_hash) values (pid, uid, private.hash_code(code));
  return code;
end;
$$;

/** What an invite leads to, before joining. Empty result if the code is not usable. */
create or replace function public.preview_invite(p_code text)
returns table (party_name text, member_count integer, leader_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  inv public.party_invites%rowtype;
begin
  if uid is null then raise exception 'not_signed_in' using errcode = 'P0001'; end if;
  if not private.count_join_attempt(uid) then return; end if; -- rate limited: same as invalid
  if p_code is null or p_code !~ '^[A-Za-z0-9_-]{24}$' then return; end if;
  select * into inv from public.party_invites
    where code_hash = private.hash_code(p_code)
      and revoked_at is null and expires_at > pg_catalog.now() and uses < max_uses;
  if not found then return; end if;
  return query
    select p.name,
           (select count(*)::integer from public.party_members m where m.party_id = p.id),
           (select pr.display_name from public.party_members m
              join public.profiles pr on pr.id = m.user_id
              where m.party_id = p.id and m.role = 'leader')
    from public.parties p where p.id = inv.party_id;
end;
$$;

/**
 * Join with an invite code. Returns a status instead of raising, so the attempt counter is
 * kept even when the code is wrong:
 * 'ok' | 'invalid_invite' | 'already_in_party' | 'party_full' | 'rate_limited'
 */
create or replace function public.join_party(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  inv public.party_invites%rowtype;
begin
  if uid is null then raise exception 'not_signed_in' using errcode = 'P0001'; end if;
  if not private.count_join_attempt(uid) then return 'rate_limited'; end if;
  if exists (select 1 from public.party_members where user_id = uid) then return 'already_in_party'; end if;
  if p_code is null or p_code !~ '^[A-Za-z0-9_-]{24}$' then return 'invalid_invite'; end if;
  select * into inv from public.party_invites
    where code_hash = private.hash_code(p_code)
      and revoked_at is null and expires_at > pg_catalog.now() and uses < max_uses
    for update;
  if not found then return 'invalid_invite'; end if;
  -- Lock the party so two people cannot both take the last place.
  perform 1 from public.parties where id = inv.party_id for update;
  if (select count(*) from public.party_members where party_id = inv.party_id) >= 20 then
    return 'party_full';
  end if;
  insert into public.party_members (user_id, party_id, role) values (uid, inv.party_id, 'member');
  update public.party_invites set uses = uses + 1 where id = inv.id;
  return 'ok';
end;
$$;

/** Leave the party. If the leader leaves, the longest-standing member takes over (trigger). */
create or replace function public.leave_party()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'not_signed_in' using errcode = 'P0001'; end if;
  delete from public.party_members where user_id = (select auth.uid());
end;
$$;

/** Leader only: remove another member. */
create or replace function public.kick_member(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  pid uuid;
begin
  select party_id into pid from public.party_members where user_id = uid and role = 'leader';
  if pid is null then raise exception 'not_leader' using errcode = 'P0001'; end if;
  if p_user is null or p_user = uid then raise exception 'invalid_member' using errcode = 'P0001'; end if;
  delete from public.party_members where user_id = p_user and party_id = pid;
  if not found then raise exception 'invalid_member' using errcode = 'P0001'; end if;
end;
$$;

/** Any member: make all invite links THEY created stop working. People who already joined stay. */
create or replace function public.revoke_my_invites()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.party_invites set revoked_at = pg_catalog.now()
    where created_by = (select auth.uid()) and revoked_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

/** Leader only: force-expire every current invite link of the party. Members stay. */
create or replace function public.expire_all_invites()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  pid uuid;
  n integer;
begin
  select party_id into pid from public.party_members where user_id = (select auth.uid()) and role = 'leader';
  if pid is null then raise exception 'not_leader' using errcode = 'P0001'; end if;
  update public.party_invites set revoked_at = pg_catalog.now()
    where party_id = pid and revoked_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Only signed-in users may call them.
revoke all on function public.create_party(text) from public, anon;
revoke all on function public.create_invite() from public, anon;
revoke all on function public.preview_invite(text) from public, anon;
revoke all on function public.join_party(text) from public, anon;
revoke all on function public.leave_party() from public, anon;
revoke all on function public.kick_member(uuid) from public, anon;
revoke all on function public.revoke_my_invites() from public, anon;
revoke all on function public.expire_all_invites() from public, anon;
grant execute on function public.create_party(text) to authenticated;
grant execute on function public.create_invite() to authenticated;
grant execute on function public.preview_invite(text) to authenticated;
grant execute on function public.join_party(text) to authenticated;
grant execute on function public.leave_party() to authenticated;
grant execute on function public.kick_member(uuid) to authenticated;
grant execute on function public.revoke_my_invites() to authenticated;
grant execute on function public.expire_all_invites() to authenticated;
