-- 7: Apple Shortcut keys (CLAUDE.md §2.1 exception, approved 2026-10-04).
--
-- A Shortcut cannot hold a Supabase session, so each user may create ONE personal Shortcut key
-- through the `shortcut-key` Edge Function. Only its SHA-256 hash is stored here.
-- The `ingest-steps` Edge Function hashes the key it receives and calls
-- public.ingest_shortcut_steps(), which writes the key owner's own daily total.
--
-- Clients (anon, authenticated) have NO access to the table or the function. Only the Edge
-- Functions reach them, using the service role that Supabase injects into its functions.

create table public.shortcut_keys (
  user_id uuid primary key references auth.users (id) on delete cascade, -- one key per user
  key_hash text not null unique,
  key_hint text not null, -- last 4 characters, so the user can recognise their key
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  window_start timestamptz, -- start of the current 1-hour rate-limit window
  uses_in_window integer not null default 0,

  constraint shortcut_keys_hash_check check (key_hash ~ '^[0-9a-f]{64}$'),
  constraint shortcut_keys_hint_check check (key_hint ~ '^[A-Za-z0-9_-]{4}$'),
  constraint shortcut_keys_uses_check check (uses_in_window >= 0)
);

comment on table public.shortcut_keys is 'Hashed Apple Shortcut keys. No client access; Edge Functions only.';

-- Default deny: RLS on with NO policies, and no privileges for client roles.
alter table public.shortcut_keys enable row level security;
revoke all on table public.shortcut_keys from public, anon, authenticated;
grant select, insert, update, delete on table public.shortcut_keys to service_role;

-- The ingest function writes daily_steps as the service role (explicit, in case defaults differ).
grant select, insert, update on table public.daily_steps to service_role;

-- Called only by the ingest-steps Edge Function (service role).
-- It writes rows for a user without that user's session, i.e. it works around RLS by design;
-- approved under CLAUDE.md §4 on 2026-10-04. The owner always comes from the key, never from
-- the request. The daily_steps constraints and window trigger still apply.
-- Returns only: 'ok' | 'unknown_key' | 'rate_limited' | 'invalid'.
create or replace function public.ingest_shortcut_steps(p_key_hash text, p_day date, p_steps integer)
returns text
language plpgsql
set search_path = ''
as $$
declare
  k public.shortcut_keys%rowtype;
  now_ts timestamptz := pg_catalog.now();
begin
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    return 'unknown_key';
  end if;

  select * into k from public.shortcut_keys where key_hash = p_key_hash for update;
  if not found then
    return 'unknown_key';
  end if;

  -- Rate limit: at most 30 requests per key per hour (counted even if the values are invalid).
  if k.window_start is null or k.window_start <= now_ts - interval '1 hour' then
    update public.shortcut_keys
      set window_start = now_ts, uses_in_window = 1, last_used_at = now_ts
      where user_id = k.user_id;
  elsif k.uses_in_window >= 30 then
    return 'rate_limited';
  else
    update public.shortcut_keys
      set uses_in_window = uses_in_window + 1, last_used_at = now_ts
      where user_id = k.user_id;
  end if;

  if p_day is null or p_steps is null then
    return 'invalid';
  end if;

  begin
    insert into public.daily_steps (user_id, day, steps, source)
    values (k.user_id, p_day, p_steps, 'shortcut')
    on conflict (user_id, day) do update
      set steps = excluded.steps, source = excluded.source;
  exception
    when check_violation then
      -- steps out of range, or day outside the allowed window (trigger)
      return 'invalid';
  end;

  return 'ok';
end;
$$;

revoke all on function public.ingest_shortcut_steps(text, date, integer) from public, anon, authenticated;
grant execute on function public.ingest_shortcut_steps(text, date, integer) to service_role;
