-- 18: friends, approved 2026-10-06 (docs/design.md §11).
--
-- Players find each other by usertag (prefix suggestions that return ONLY usertags), send friend
-- invites, accept / decline / cancel them, and remove friends. Friends can read each other's
-- profile and daily steps, like party members already can.
--
-- Clients cannot write public.friendships directly; every change goes through the functions
-- below. They are SECURITY DEFINER (they must read profiles the caller cannot see, to resolve a
-- usertag) with an empty search_path, fully qualified names, and the caller always taken from
-- auth.uid(), never from a parameter. Rate limits: 60 searches per hour, 30 invites per day.

create table public.friendships (
  requester uuid not null references auth.users (id) on delete cascade,
  addressee uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (requester, addressee),
  constraint friendships_not_self check (requester <> addressee),
  constraint friendships_status_check check (status in ('pending', 'accepted'))
);
-- One row per pair, whichever direction.
create unique index friendships_pair_key on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index friendships_addressee_idx on public.friendships (addressee);

comment on table public.friendships is 'Friend invites and friendships. Read own rows; changes only through the friend functions.';

revoke all on table public.friendships from public, anon, authenticated;
grant select on table public.friendships to authenticated;
alter table public.friendships enable row level security;
create policy "friendships: read own"
  on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester, addressee));

-- ---------------------------------------------------------------------------
-- Visibility: friends can read each other's profile and daily steps.
-- ---------------------------------------------------------------------------

create or replace function private.are_friends(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = (select auth.uid()) and f.addressee = p_user)
        or (f.addressee = (select auth.uid()) and f.requester = p_user))
  );
$$;
revoke all on function private.are_friends(uuid) from public, anon;
grant execute on function private.are_friends(uuid) to authenticated;

create policy "profiles: read friends"
  on public.profiles for select to authenticated
  using ((select private.are_friends(id)));

create policy "daily_steps: read friends"
  on public.daily_steps for select to authenticated
  using ((select private.are_friends(user_id)));

-- ---------------------------------------------------------------------------
-- Rate limits (counted even when the action then fails, so guessing costs attempts).
-- ---------------------------------------------------------------------------

create table private.social_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  window_start timestamptz not null,
  uses integer not null default 0,
  primary key (user_id, kind)
);
revoke all on table private.social_limits from public, anon, authenticated;

/** Counts one use. Returns false once the limit for the window is reached (never raises). */
create or replace function private.count_social(p_kind text, p_max integer, p_window interval)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  l private.social_limits%rowtype;
  now_ts timestamptz := pg_catalog.now();
begin
  select * into l from private.social_limits where user_id = uid and kind = p_kind for update;
  if not found then
    insert into private.social_limits (user_id, kind, window_start, uses) values (uid, p_kind, now_ts, 1);
  elsif l.window_start <= now_ts - p_window then
    update private.social_limits set window_start = now_ts, uses = 1 where user_id = uid and kind = p_kind;
  elsif l.uses >= p_max then
    return false;
  else
    update private.social_limits set uses = uses + 1 where user_id = uid and kind = p_kind;
  end if;
  return true;
end;
$$;
revoke all on function private.count_social(text, integer, interval) from public, anon, authenticated;

/** The user id for a usertag ('@' and case ignored), or null. */
create or replace function private.user_by_handle(p_handle text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.profiles p
  where p.handle = pg_catalog.lower(pg_catalog.ltrim(pg_catalog.btrim(coalesce(p_handle, '')), '@'));
$$;
revoke all on function private.user_by_handle(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Functions for signed-in players
-- ---------------------------------------------------------------------------

/**
 * Usertag suggestions: usertags starting with the prefix (2+ characters), max 10, never the
 * caller. Returns ONLY usertags. {"status": "ok"|"invalid"|"rate_limited", "handles": [...]}
 */
create or replace function public.search_usertags(p_prefix text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  q text := pg_catalog.lower(pg_catalog.ltrim(pg_catalog.btrim(coalesce(p_prefix, '')), '@'));
  matches jsonb;
begin
  if uid is null or q !~ '^[a-z0-9._]{2,20}$' then
    return jsonb_build_object('status', 'invalid', 'handles', '[]'::jsonb);
  end if;
  if not private.count_social('search', 60, interval '1 hour') then
    return jsonb_build_object('status', 'rate_limited', 'handles', '[]'::jsonb);
  end if;
  select coalesce(pg_catalog.jsonb_agg(h.handle order by h.handle), '[]'::jsonb) into matches
  from (
    select p.handle from public.profiles p
    where pg_catalog.starts_with(p.handle, q) and p.id <> uid
    order by p.handle
    limit 10
  ) h;
  return jsonb_build_object('status', 'ok', 'handles', matches);
end;
$$;

/**
 * Sends an invite to a usertag. If that player already invited the caller, it is accepted.
 * Returns: sent | accepted | already_friends | already_sent | not_found | self | rate_limited | invalid
 */
create or replace function public.send_friend_invite(p_handle text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  target uuid;
  f public.friendships%rowtype;
begin
  if uid is null then return 'invalid'; end if;
  if not private.count_social('invite', 30, interval '1 day') then return 'rate_limited'; end if;
  target := private.user_by_handle(p_handle);
  if target is null then return 'not_found'; end if;
  if target = uid then return 'self'; end if;

  select * into f from public.friendships
  where (requester = uid and addressee = target) or (requester = target and addressee = uid)
  for update;
  if found then
    if f.status = 'accepted' then return 'already_friends'; end if;
    if f.requester = uid then return 'already_sent'; end if;
    update public.friendships set status = 'accepted', accepted_at = pg_catalog.now()
      where requester = target and addressee = uid;
    return 'accepted';
  end if;

  insert into public.friendships (requester, addressee) values (uid, target);
  return 'sent';
exception when unique_violation then
  return 'already_sent'; -- two invites crossed at the same moment
end;
$$;

/** Accepts or declines an invite the caller received. Returns: accepted | declined | not_found */
create or replace function public.respond_friend_invite(p_handle text, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  other uuid := private.user_by_handle(p_handle);
begin
  if uid is null or other is null then return 'not_found'; end if;
  if coalesce(p_accept, false) then
    update public.friendships set status = 'accepted', accepted_at = pg_catalog.now()
      where requester = other and addressee = uid and status = 'pending';
    return case when found then 'accepted' else 'not_found' end;
  end if;
  delete from public.friendships where requester = other and addressee = uid and status = 'pending';
  return case when found then 'declined' else 'not_found' end;
end;
$$;

/** Withdraws an invite the caller sent. Returns: cancelled | not_found */
create or replace function public.cancel_friend_invite(p_handle text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  other uuid := private.user_by_handle(p_handle);
begin
  if uid is null or other is null then return 'not_found'; end if;
  delete from public.friendships where requester = uid and addressee = other and status = 'pending';
  return case when found then 'cancelled' else 'not_found' end;
end;
$$;

/** Ends a friendship (either side). Returns: removed | not_found */
create or replace function public.remove_friend(p_handle text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  other uuid := private.user_by_handle(p_handle);
begin
  if uid is null or other is null then return 'not_found'; end if;
  delete from public.friendships
  where status = 'accepted'
    and ((requester = uid and addressee = other) or (requester = other and addressee = uid));
  return case when found then 'removed' else 'not_found' end;
end;
$$;

/** Pending invites to and from the caller, with ONLY the other player's usertag. */
create or replace function public.my_friend_requests()
returns table (handle text, direction text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.handle, case when f.requester = (select auth.uid()) then 'out' else 'in' end, f.created_at
  from public.friendships f
  join public.profiles p on p.id = case when f.requester = (select auth.uid()) then f.addressee else f.requester end
  where f.status = 'pending' and (select auth.uid()) in (f.requester, f.addressee)
  order by f.created_at desc;
$$;

/** The caller's friends (friends may see each other's id, name, avatar and usertag). */
create or replace function public.my_friends()
returns table (id uuid, handle text, display_name text, avatar jsonb, since timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.handle, p.display_name, p.avatar, f.accepted_at
  from public.friendships f
  join public.profiles p on p.id = case when f.requester = (select auth.uid()) then f.addressee else f.requester end
  where f.status = 'accepted' and (select auth.uid()) in (f.requester, f.addressee)
  order by p.display_name nulls last, p.handle;
$$;

revoke all on function public.search_usertags(text) from public, anon;
revoke all on function public.send_friend_invite(text) from public, anon;
revoke all on function public.respond_friend_invite(text, boolean) from public, anon;
revoke all on function public.cancel_friend_invite(text) from public, anon;
revoke all on function public.remove_friend(text) from public, anon;
revoke all on function public.my_friend_requests() from public, anon;
revoke all on function public.my_friends() from public, anon;
grant execute on function public.search_usertags(text) to authenticated;
grant execute on function public.send_friend_invite(text) to authenticated;
grant execute on function public.respond_friend_invite(text, boolean) to authenticated;
grant execute on function public.cancel_friend_invite(text) to authenticated;
grant execute on function public.remove_friend(text) to authenticated;
grant execute on function public.my_friend_requests() to authenticated;
grant execute on function public.my_friends() to authenticated;
