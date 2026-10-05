-- 15: source 'admin' for step totals entered by the project owner in the dashboard
-- (for example days from before the group moved to runsesh).
--
-- Only the owner can write 'admin' rows (SQL editor / Table Editor). Players can neither write
-- 'admin' themselves nor overwrite a row the owner set. Phone ingest (service role) keeps its
-- own sources and is not changed. The date window still applies to everyone except the owner's
-- one-off imports, which switch the guard off inside a single transaction.

alter table public.daily_steps drop constraint daily_steps_source_check;
alter table public.daily_steps add constraint daily_steps_source_check
  check (source in ('manual', 'health_connect', 'shortcut', 'admin'));

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

  -- Players (and anyone using the public API) cannot claim or replace an owner's entry.
  if current_user in ('authenticated', 'anon') then
    if new.source = 'admin' then
      raise exception 'source admin is reserved'
        using errcode = 'check_violation';
    end if;
    if tg_op = 'UPDATE' and old.source = 'admin' then
      raise exception 'this day was set by the admin'
        using errcode = 'check_violation';
    end if;
  end if;

  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function private.daily_steps_guard() from public, anon, authenticated;
