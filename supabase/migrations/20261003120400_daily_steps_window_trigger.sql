-- 5/5: only recent days may be written, keys cannot be moved, updated_at is server-set.
--
-- Allowed window (UTC): from 3 days before today up to 1 day after today.
-- The extra day ahead covers users in time zones east of UTC.

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

  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function private.daily_steps_guard() from public, anon, authenticated;

create trigger daily_steps_guard
  before insert or update on public.daily_steps
  for each row execute function private.daily_steps_guard();
