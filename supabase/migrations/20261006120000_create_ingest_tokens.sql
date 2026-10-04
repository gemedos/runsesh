-- 13: personal ingest tokens for phone apps (CLAUDE.md "Health data ingest tokens", approved 2026-10-04).
--
-- A phone app (the Android Health Connect webhook app; later the iPhone Shortcut) has no Supabase
-- session, so the user creates a personal token in the web app. The `ingest-tokens` Edge Function
-- generates it and stores only the SHA-256 hash of its secret here. The phone sends
-- `<token id>.<secret>` in the Authorization header to the `ingest-steps` Edge Function, which
-- hashes the secret and calls public.record_ingest().
--
-- Clients may list (without the hash) and delete their own tokens. Creating tokens and writing
-- steps happen only through the two functions below, which only the service role may call.

create table public.ingest_tokens (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null,
  secret_hash text not null unique,
  secret_hint text not null, -- last 4 characters of the secret, so the user can recognise it
  created_at timestamptz not null default now(),
  last_used_at timestamptz,  -- shown in the app as "last received"
  window_start timestamptz,  -- start of the current 1-hour rate-limit window
  uses_in_window integer not null default 0,

  constraint ingest_tokens_platform_check check (platform in ('android', 'ios')),
  constraint ingest_tokens_hash_check check (secret_hash ~ '^[0-9a-f]{64}$'),
  constraint ingest_tokens_hint_check check (secret_hint ~ '^[A-Za-z0-9_-]{4}$'),
  constraint ingest_tokens_uses_check check (uses_in_window >= 0)
);

create index ingest_tokens_user_idx on public.ingest_tokens (user_id);

comment on table public.ingest_tokens is 'Hashed personal ingest tokens. Clients list/delete their own (never the hash).';

-- Privileges: default deny. Clients read only harmless columns of their own rows and may delete
-- (revoke) their own tokens. They can never read secret_hash or the rate-limit counters, and can
-- never insert or update.
alter table public.ingest_tokens enable row level security;
revoke all on table public.ingest_tokens from public, anon, authenticated;
grant select (id, platform, secret_hint, created_at, last_used_at) on table public.ingest_tokens to authenticated;
grant delete on table public.ingest_tokens to authenticated;
grant select, insert, update, delete on table public.ingest_tokens to service_role;

create policy "ingest_tokens: select own"
  on public.ingest_tokens for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "ingest_tokens: delete own"
  on public.ingest_tokens for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Creating a token. Called only by the `ingest-tokens` Edge Function (service role) after it has
-- checked the user's session; the user id comes from that session, never from the request body.
-- At most 2 tokens per user, checked under a per-user lock so parallel requests cannot pass it.
-- Returns only: 'ok' | 'limit' | 'invalid'.
-- ---------------------------------------------------------------------------
create or replace function public.create_ingest_token(
  p_id uuid, p_user_id uuid, p_platform text, p_secret_hash text, p_secret_hint text
)
returns text
language plpgsql
set search_path = ''
as $$
begin
  if p_id is null or p_user_id is null
     or p_platform is null or p_platform not in ('android', 'ios')
     or p_secret_hash is null or p_secret_hash !~ '^[0-9a-f]{64}$'
     or p_secret_hint is null or p_secret_hint !~ '^[A-Za-z0-9_-]{4}$' then
    return 'invalid';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ingest_tokens:' || p_user_id::text, 0));

  if (select pg_catalog.count(*) from public.ingest_tokens where user_id = p_user_id) >= 2 then
    return 'limit';
  end if;

  insert into public.ingest_tokens (id, user_id, platform, secret_hash, secret_hint)
  values (p_id, p_user_id, p_platform, p_secret_hash, p_secret_hint);
  return 'ok';
end;
$$;

revoke all on function public.create_ingest_token(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.create_ingest_token(uuid, uuid, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Writing steps. Called only by the `ingest-steps` Edge Function (service role).
-- It writes rows for a user without that user's session, i.e. it works around RLS by design
-- (same pattern as ingest_shortcut_steps, approved under CLAUDE.md §4). The owner always comes
-- from the token, never from the request. The daily_steps constraints and window trigger still
-- apply.
--
-- p_days: [{"day": "YYYY-MM-DD", "steps": 1234}, ...], at most 3 different days.
-- Every entry is validated first; if any entry is malformed nothing is written ('invalid').
-- Days outside the allowed window are skipped and the others are written.
-- Source: 'health_connect' for android tokens, 'shortcut' for ios tokens.
-- Returns only: 'ok' | 'unauthorized' | 'rate_limited' | 'invalid'.
-- ---------------------------------------------------------------------------
create or replace function public.record_ingest(p_token_id uuid, p_secret_hash text, p_days jsonb)
returns text
language plpgsql
set search_path = ''
as $$
declare
  t public.ingest_tokens%rowtype;
  now_ts timestamptz := pg_catalog.now();
  today_utc date := (pg_catalog.now() at time zone 'UTC')::date;
  elem jsonb;
  v_day date;
  v_count integer;
  v_days date[] := '{}';
  v_counts integer[] := '{}';
  v_source text;
  i integer;
begin
  if p_token_id is null or p_secret_hash is null or p_secret_hash !~ '^[0-9a-f]{64}$' then
    return 'unauthorized';
  end if;

  -- Unknown id and wrong secret give the same answer. Comparing two SHA-256 hashes leaks
  -- nothing useful through timing: an attacker cannot choose the hash of their guess.
  select * into t from public.ingest_tokens where id = p_token_id for update;
  if not found or t.secret_hash <> p_secret_hash then
    return 'unauthorized';
  end if;

  -- Rate limit: at most 20 requests per token per hour (counted even if the values are invalid).
  if t.window_start is null or t.window_start <= now_ts - interval '1 hour' then
    update public.ingest_tokens
      set window_start = now_ts, uses_in_window = 1, last_used_at = now_ts
      where id = t.id;
  elsif t.uses_in_window >= 20 then
    return 'rate_limited';
  else
    update public.ingest_tokens
      set uses_in_window = uses_in_window + 1, last_used_at = now_ts
      where id = t.id;
  end if;

  -- Validate everything before writing anything.
  if p_days is null or pg_catalog.jsonb_typeof(p_days) <> 'array'
     or pg_catalog.jsonb_array_length(p_days) > 3 then
    return 'invalid';
  end if;

  for elem in select value from pg_catalog.jsonb_array_elements(p_days) loop
    if pg_catalog.jsonb_typeof(elem) <> 'object'
       or pg_catalog.jsonb_typeof(elem -> 'day') is distinct from 'string'
       or pg_catalog.jsonb_typeof(elem -> 'steps') is distinct from 'number'
       or (elem ->> 'day') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       or (elem ->> 'steps') !~ '^[0-9]{1,6}$' then -- whole numbers only: no sign, decimals or exponent
      return 'invalid';
    end if;

    begin
      v_day := (elem ->> 'day')::date; -- rejects dates that do not exist, e.g. 2026-02-30
    exception
      when others then return 'invalid';
    end;

    v_count := (elem ->> 'steps')::integer;
    if v_count > 100000 or v_day = any (v_days) then
      return 'invalid';
    end if;

    v_days := v_days || v_day;
    v_counts := v_counts || v_count;
  end loop;

  v_source := case t.platform when 'android' then 'health_connect' else 'shortcut' end;

  for i in 1 .. coalesce(pg_catalog.array_length(v_days, 1), 0) loop
    -- Same window as private.daily_steps_guard(); days outside it are skipped, not errors.
    if v_days[i] between today_utc - 3 and today_utc + 1 then
      insert into public.daily_steps (user_id, day, steps, source)
      values (t.user_id, v_days[i], v_counts[i], v_source)
      on conflict (user_id, day) do update
        set steps = excluded.steps, source = excluded.source;
    end if;
  end loop;

  return 'ok';
end;
$$;

revoke all on function public.record_ingest(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_ingest(uuid, text, jsonb) to service_role;
