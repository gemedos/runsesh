-- 1/5: private schema + avatar validation function.
--
-- The "private" schema is NOT exposed through the Supabase Data API (only "public" is by
-- default), so nothing in here can be called from the browser.
--
-- private.is_valid_avatar() mirrors docs/avatar-schema.md exactly. If the avatar schema
-- changes (new part IDs, new version), update docs/avatar-schema.md, js/avatar/parts.js,
-- js/strings.js and this function together in a NEW migration.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create or replace function private.is_valid_avatar(a jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    a is not null
    and jsonb_typeof(a) = 'object'
    -- size limit (the app limit is 512 characters; the database allows up to 2 KB)
    and octet_length(a::text) < 2048
    -- exactly these 8 keys, no others
    and (select count(*) from jsonb_object_keys(a)) = 8
    and a ?& array['v', 'skin', 'hair', 'hairColor', 'top', 'bottom', 'shoes', 'acc']
    -- version
    and jsonb_typeof(a -> 'v') = 'number'
    and (a ->> 'v') = '1'
    -- every other value must be a string
    and jsonb_typeof(a -> 'skin') = 'string'
    and jsonb_typeof(a -> 'hair') = 'string'
    and jsonb_typeof(a -> 'hairColor') = 'string'
    and jsonb_typeof(a -> 'top') = 'string'
    and jsonb_typeof(a -> 'bottom') = 'string'
    and jsonb_typeof(a -> 'shoes') = 'string'
    and jsonb_typeof(a -> 'acc') = 'string'
    -- color
    and (a ->> 'skin') ~ '^#[0-9A-Fa-f]{6}$'
    -- whitelisted part IDs
    and (a ->> 'hair') in ('h_none', 'h_buzz', 'h_short', 'h_spiky', 'h_long', 'h_bob', 'h_ponytail', 'h_bun', 'h_curly', 'h_mohawk')
    and (a ->> 'hairColor') in ('hc_black', 'hc_brown', 'hc_auburn', 'hc_blonde', 'hc_grey', 'hc_blue', 'hc_pink', 'hc_green')
    and (a ->> 'top') in ('t_tee', 't_tank', 't_jersey', 't_hoodie', 't_jacket', 't_singlet', 't_tracksuit')
    and (a ->> 'bottom') in ('b_shorts', 'b_runshorts', 'b_leggings', 'b_joggers', 'b_skirt')
    and (a ->> 'shoes') in ('s_none', 's_runner', 's_white', 's_blue', 's_pink')
    and (a ->> 'acc') in ('a_none', 'a_cap', 'a_headband', 'a_sunglasses', 'a_glasses', 'a_headphones', 'a_scarf', 'a_medal', 'a_watch');
$$;

-- A CHECK constraint runs its function with the privileges of the user writing the row,
-- so signed-in users need EXECUTE on this pure validation function (it reads nothing and
-- the private schema is not reachable through the API). Logged-out users get nothing.
revoke all on function private.is_valid_avatar(jsonb) from public, anon;
grant execute on function private.is_valid_avatar(jsonb) to authenticated;
