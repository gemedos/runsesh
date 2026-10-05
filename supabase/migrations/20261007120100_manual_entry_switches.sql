-- 16: switches for typing steps by hand ("manual entry"), set by the project owner only.
--
-- Manual entry is allowed for a player only when BOTH are on:
--   1. the global switch  public.app_settings.manual_entry  (one row; on after this migration)
--   2. the player's switch public.user_settings.manual_entry (no row = OFF, the default)
-- The owner flips them in the dashboard (Table Editor or SQL editor). Players can read their own
-- switch and the global one, so the app can hide the form, but can never change them.
--
-- Enforced in the daily_steps guard for EVERY direct write by a player, whatever `source` the
-- request claims (a player could label a typed number 'health_connect'). Phone ingest writes as
-- the service role through public.record_ingest and is not affected. The owner's own SQL is not
-- affected either.

create table public.app_settings (
  id boolean primary key default true,
  manual_entry boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint app_settings_single_row check (id)
);
insert into public.app_settings (id, manual_entry) values (true, true);

comment on table public.app_settings is 'One row of app-wide switches. Owner only (dashboard); players read it.';

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  manual_entry boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table public.user_settings is 'Per-player switches. Owner only (dashboard); players read their own row. No row = defaults (manual entry off).';

-- Privileges: players read, nobody but the owner writes.
revoke all on table public.app_settings from public, anon, authenticated;
revoke all on table public.user_settings from public, anon, authenticated;
grant select (manual_entry) on table public.app_settings to authenticated;
grant select (user_id, manual_entry) on table public.user_settings to authenticated;

alter table public.app_settings enable row level security;
alter table public.user_settings enable row level security;

create policy "app_settings: players read"
  on public.app_settings for select to authenticated
  using (true);

create policy "user_settings: read own"
  on public.user_settings for select to authenticated
  using ((select auth.uid()) = user_id);

-- The guard from migration 15, plus the manual-entry check.
create or replace function private.daily_steps_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  today_utc date := (pg_catalog.now() at time zone 'UTC')::date;
begin
  if new.day < today_utc - 3 or new.day > today_utc + 1 then
    raise exception 'day outside the allowed window'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'UPDATE' and (new.user_id <> old.user_id or new.day <> old.day) then
    raise exception 'user_id and day cannot be changed'
      using errcode = 'check_violation';
  end if;

  -- Players (and anyone using the public API).
  if current_user in ('authenticated', 'anon') then
    if new.source = 'admin' then
      raise exception 'source admin is reserved'
        using errcode = 'check_violation';
    end if;
    if tg_op = 'UPDATE' and old.source = 'admin' then
      raise exception 'this day was set by the admin'
        using errcode = 'check_violation';
    end if;
    -- Both switches must be on. Missing rows count as off. Read under the player's own RLS:
    -- RLS on daily_steps already guarantees new.user_id is the player.
    if not coalesce((select s.manual_entry from public.app_settings s limit 1), false)
       or not coalesce((select u.manual_entry from public.user_settings u where u.user_id = new.user_id), false) then
      raise exception 'manual entry is turned off'
        using errcode = 'check_violation';
    end if;
  end if;

  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function private.daily_steps_guard() from public, anon, authenticated;
