-- 17: usertags (@handle), approved 2026-10-06 (docs/design.md §11).
--
-- Every profile gets a unique usertag: 3–20 characters a-z 0-9 . _ (stored lowercase, so it is
-- unique ignoring case), shown as "@handle". It is generated from the display name plus 4 digits
-- for existing accounts and at sign-up; the owner can change it (Edit profile).
-- Who can read it: the owner, party members (existing policies) and, from migration 18, friends
-- and the usertag search.

alter table public.profiles add column handle text;

/** Display name → lowercase a-z0-9 start of a usertag (accents folded, max 12 characters). */
create or replace function private.handle_slug(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(nullif(pg_catalog.left(pg_catalog.regexp_replace(
    pg_catalog.translate(pg_catalog.lower(coalesce(p_name, '')),
      'áàäâãåéèëêíìïîóòöôõúùüûñçýÿ', 'aaaaaaeeeeiiiiooooouuuuncyy'),
    '[^a-z0-9]', '', 'g'), 12), ''), 'runner');
$$;
revoke all on function private.handle_slug(text) from public, anon, authenticated;

/** A free usertag: slug + 4 random digits (tries again on the rare collision). */
create or replace function private.generate_handle(p_name text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  base text := private.handle_slug(p_name);
  candidate text;
begin
  if pg_catalog.char_length(base) < 3 then base := base || 'run'; end if;
  loop
    candidate := base || pg_catalog.lpad((pg_catalog.floor(pg_catalog.random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from public.profiles where handle = candidate);
  end loop;
  return candidate;
end;
$$;
revoke all on function private.generate_handle(text) from public, anon, authenticated;

-- Existing accounts: one row at a time, so each new usertag sees the ones given before it.
do $$
declare r record;
begin
  for r in select id, display_name from public.profiles where handle is null order by created_at loop
    update public.profiles set handle = private.generate_handle(r.display_name) where id = r.id;
  end loop;
end $$;

alter table public.profiles alter column handle set not null;
alter table public.profiles add constraint profiles_handle_check check (handle ~ '^[a-z0-9._]{3,20}$');
alter table public.profiles add constraint profiles_handle_key unique (handle);

-- The owner may change their usertag (the update policy already limits it to their own row).
grant update (display_name, avatar, timezone, handle) on table public.profiles to authenticated;

-- Sign-up: same as migration 3, plus a generated usertag (retried if two sign-ups collide).
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
  tries int := 0;
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

  loop
    begin
      insert into public.profiles (id, display_name, timezone, handle)
      values (new.id, clean_name, clean_tz, private.generate_handle(clean_name))
      on conflict (id) do nothing;
      exit;
    exception when unique_violation then
      tries := tries + 1;
      if tries >= 5 then raise; end if;
    end;
  end loop;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;
