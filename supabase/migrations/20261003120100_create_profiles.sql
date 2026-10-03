-- 2/5: profiles table, constraints, privileges, row level security, updated_at trigger.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Nullable: if the name given at sign-up is invalid, the account is still created
  -- and the user sets a name later.
  display_name text,
  -- Nullable: null means "use the default avatar". Format: docs/avatar-schema.md.
  avatar jsonb,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_display_name_check check (
    display_name is null
    or (display_name = btrim(display_name) and char_length(display_name) between 2 and 30)
  ),
  constraint profiles_timezone_check check (char_length(timezone) between 1 and 64),
  constraint profiles_avatar_check check (avatar is null or private.is_valid_avatar(avatar))
);

comment on table public.profiles is 'One row per user. Created by trigger on auth.users; never inserted or deleted by clients.';

-- Privileges: default deny. Logged-out users (anon) get nothing.
-- Signed-in users may read, and may update only the three editable columns.
revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, avatar, timezone) on table public.profiles to authenticated;

-- Row level security: a user only ever sees and changes their own row.
-- No insert policy and no delete policy: clients can do neither.
alter table public.profiles enable row level security;

create policy "profiles: select own row"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: update own row"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Phase 3 will add a policy so members of the same party can read each other's
-- display_name and avatar.

-- updated_at trigger
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();
