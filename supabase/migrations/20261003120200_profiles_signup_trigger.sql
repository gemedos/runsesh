-- 3/5: create the profile row when a user signs up.
--
-- Why SECURITY DEFINER: the trigger runs as part of the Auth service's insert into
-- auth.users, and clients have no INSERT privilege on public.profiles (on purpose).
-- SECURITY DEFINER lets this one function insert the row with the owner's rights.
-- To keep that safe:
--   * search_path is set to '' so no object can be swapped in through the search path;
--   * every object name is fully qualified (public.profiles, pg_catalog.*);
--   * it lives in the "private" schema, which the Data API does not expose, and
--     EXECUTE is revoked from every client role, so it cannot be called directly;
--   * it only copies values from the sign-up metadata after validating them, and it
--     never fails the sign-up because of a bad value (invalid values become null / 'UTC').

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_name text := pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  raw_tz text := coalesce(new.raw_user_meta_data ->> 'timezone', '');
  clean_name text;
  clean_tz text;
begin
  if pg_catalog.char_length(raw_name) between 2 and 30 then
    clean_name := raw_name;
  else
    clean_name := null;
  end if;

  if pg_catalog.char_length(raw_tz) between 1 and 64
     and raw_tz ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+){0,2}$' then
    clean_tz := raw_tz;
  else
    clean_tz := 'UTC';
  end if;

  insert into public.profiles (id, display_name, timezone)
  values (new.id, clean_name, clean_tz)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
