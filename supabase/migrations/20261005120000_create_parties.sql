-- 8: parties and party members.
--
-- Rules: a user is in at most ONE party (party_members.user_id is the primary key), as either
-- the leader (who created it) or a member. Exactly one leader per party.
-- Clients only READ these tables directly; every change goes through the functions in the
-- next migration, which check roles themselves.

-- Signed-in users need USAGE on the private schema so RLS policies can call the helper
-- functions below. The schema is not exposed through the API, so this exposes nothing.
grant usage on schema private to authenticated;

create table public.parties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  step_scoring text not null default 'plain',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint parties_name_check check (name = btrim(name) and char_length(name) between 2 and 30),
  constraint parties_step_scoring_check check (step_scoring in ('plain', 'elevation_bonus'))
);

create table public.party_members (
  user_id uuid primary key references auth.users (id) on delete cascade, -- one party per user
  party_id uuid not null references public.parties (id) on delete cascade,
  role text not null,
  joined_at timestamptz not null default now(),

  constraint party_members_role_check check (role in ('leader', 'member'))
);

create unique index party_members_one_leader on public.party_members (party_id) where role = 'leader';
create index party_members_party_idx on public.party_members (party_id);

-- ---------------------------------------------------------------------------
-- Helpers for RLS policies. SECURITY DEFINER so a policy on party_members can look up the
-- caller's own party without recursing into that same policy. search_path '' and fully
-- qualified names; they only ever look at the CALLER's own membership (auth.uid()).
-- ---------------------------------------------------------------------------

create or replace function private.my_party_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select pm.party_id from public.party_members pm where pm.user_id = (select auth.uid());
$$;

create or replace function private.is_party_leader(p_party_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.party_members pm
    where pm.user_id = (select auth.uid()) and pm.party_id = p_party_id and pm.role = 'leader'
  );
$$;

/** True if p_user is in the same party as the caller (including the caller themself). */
create or replace function private.shares_party(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.party_members me
    join public.party_members other on other.party_id = me.party_id
    where me.user_id = (select auth.uid()) and other.user_id = p_user
  );
$$;

revoke all on function private.my_party_id() from public, anon;
revoke all on function private.is_party_leader(uuid) from public, anon;
revoke all on function private.shares_party(uuid) from public, anon;
grant execute on function private.my_party_id() to authenticated;
grant execute on function private.is_party_leader(uuid) to authenticated;
grant execute on function private.shares_party(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges and row level security (default deny)
-- ---------------------------------------------------------------------------

revoke all on table public.parties from public, anon, authenticated;
revoke all on table public.party_members from public, anon, authenticated;
grant select on table public.parties to authenticated;
grant update (name, step_scoring) on table public.parties to authenticated;
grant select on table public.party_members to authenticated;

alter table public.parties enable row level security;
alter table public.party_members enable row level security;

create policy "parties: members read their party"
  on public.parties for select to authenticated
  using (id = (select private.my_party_id()));

create policy "parties: leader updates name and rules"
  on public.parties for update to authenticated
  using ((select private.is_party_leader(id)))
  with check ((select private.is_party_leader(id)));

create policy "party_members: read own party's members"
  on public.party_members for select to authenticated
  using (party_id = (select private.my_party_id()));

-- No insert/update/delete policies: membership changes only through the functions.

create trigger parties_set_updated_at
  before update on public.parties
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Leadership handover (decision: automatic). When the leader's membership row disappears
-- (they leave, or their account is deleted), the longest-standing member becomes leader.
-- If nobody is left, the party is deleted. Runs as SECURITY DEFINER because the delete may
-- come from the Auth service (account deletion) or from the party functions.
-- ---------------------------------------------------------------------------

create or replace function private.after_member_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_leader uuid;
begin
  -- Invite links created by someone who left stop working.
  update public.party_invites set revoked_at = pg_catalog.now()
    where created_by = old.user_id and revoked_at is null;

  if old.role = 'leader' then
    select pm.user_id into next_leader
      from public.party_members pm
      where pm.party_id = old.party_id
      order by pm.joined_at, pm.user_id
      limit 1;
    if next_leader is null then
      delete from public.parties where id = old.party_id;
    else
      update public.party_members set role = 'leader' where user_id = next_leader;
    end if;
  end if;
  return null;
end;
$$;

revoke all on function private.after_member_removed() from public, anon, authenticated;
-- The trigger itself is created in the next migration, after party_invites exists.
