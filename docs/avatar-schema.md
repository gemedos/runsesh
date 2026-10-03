# Avatar JSON schema (v1)

This is the exact format the app produces and accepts. In Phase 2 the Supabase database must
enforce the same rules (CHECK constraints or a validation function); the client check in
`js/avatar/avatar.js` (`validateAvatar`) is for UX only and is **not** a security boundary.

Source of truth in code:
- Part ID whitelists: the keys of `HAIR`, `HAIR_COLORS`, `TOPS`, `BOTTOMS`, `SHOES`, `ACCESSORIES` in `js/avatar/parts.js`
- Validation: `validateAvatar()` in `js/avatar/avatar.js`
- Tests: `tests/avatar.test.js`

If you add or remove a part ID, update this file, `js/strings.js` (its label) and the database constraint together.

## Example

```json
{"v":1,"skin":"#ff8c1a","hair":"h_none","hairColor":"hc_brown","top":"t_jersey","bottom":"b_joggers","shoes":"s_runner","acc":"a_none"}
```

This is also the default avatar.

## Rules

- The value is a JSON **object** with **exactly these 8 keys**. No missing keys, no extra keys.
- Size limit: the serialized JSON must be **at most 512 characters**. A real avatar is about
  130 characters, so anything near the limit is invalid anyway.
- Anything that breaks a rule is **rejected as a whole**. Values are never trimmed, repaired or partly accepted.
  (When stored data is invalid, the app shows the default avatar instead.)

| Key | Type | Allowed values |
|---|---|---|
| `v` | number | `1` (schema version) |
| `skin` | string | Hex color `#RRGGBB`: regex `^#[0-9a-fA-F]{6}$`. Saved lowercase. No 3-digit form, no names, no alpha. |
| `hair` | string | One of the hair IDs below |
| `hairColor` | string | One of the hair color IDs below |
| `top` | string | One of the top IDs below |
| `bottom` | string | One of the bottom IDs below |
| `shoes` | string | One of the shoe IDs below |
| `acc` | string | One of the accessory IDs below (one accessory at a time) |

All part IDs match `^[a-z]{1,2}_[a-z0-9]{1,16}$`. That pattern is only a sanity check; the
whitelists below are the real rule.

## Allowed part IDs

| Key | IDs |
|---|---|
| `hair` | `h_none`, `h_buzz`, `h_short`, `h_spiky`, `h_long`, `h_bob`, `h_ponytail`, `h_bun`, `h_curly`, `h_mohawk` |
| `hairColor` | `hc_black`, `hc_brown`, `hc_auburn`, `hc_blonde`, `hc_grey`, `hc_blue`, `hc_pink`, `hc_green` |
| `top` | `t_tee`, `t_tank`, `t_jersey`, `t_hoodie`, `t_jacket`, `t_singlet`, `t_tracksuit` |
| `bottom` | `b_shorts`, `b_runshorts`, `b_leggings`, `b_joggers`, `b_skirt` |
| `shoes` | `s_none`, `s_runner`, `s_white`, `s_blue`, `s_pink` |
| `acc` | `a_none`, `a_cap`, `a_headband`, `a_sunglasses`, `a_glasses`, `a_headphones`, `a_scarf`, `a_medal`, `a_watch` |

## Golden set (not allowed in v1)

`g_glasses`, `g_vest`, `g_boots`, `g_crown`, `g_color` exist only as **locked previews** in the
editor. They are deliberately **not** in any whitelist, so an avatar containing them is rejected.
Unlocking them (Phase 5) needs a schema change, for example `v: 2` with a field for unlocked
golden items. Who owns which reward must be decided by the backend, never by the client.

## How the SVG is built

`buildAvatarSvg()` re-validates its input, then draws hard-coded shapes from `parts.js` with
`document.createElementNS` and `setAttribute`. The only value taken from the avatar that ends up
in an attribute is the validated `skin` color (and the hair color, looked up by whitelisted ID).
No string concatenation into markup, no `innerHTML`.

## Suggested Phase 2 database check (for reference, not applied)

```sql
-- avatar jsonb column on the profile table
check (
  octet_length(avatar::text) <= 512
  and avatar ?& array['v','skin','hair','hairColor','top','bottom','shoes','acc']
  and (select count(*) from jsonb_object_keys(avatar)) = 8
  and avatar->>'v' = '1'
  and avatar->>'skin' ~ '^#[0-9a-fA-F]{6}$'
  and avatar->>'hair' in ('h_none','h_buzz','h_short','h_spiky','h_long','h_bob','h_ponytail','h_bun','h_curly','h_mohawk')
  and avatar->>'hairColor' in ('hc_black','hc_brown','hc_auburn','hc_blonde','hc_grey','hc_blue','hc_pink','hc_green')
  and avatar->>'top' in ('t_tee','t_tank','t_jersey','t_hoodie','t_jacket','t_singlet','t_tracksuit')
  and avatar->>'bottom' in ('b_shorts','b_runshorts','b_leggings','b_joggers','b_skirt')
  and avatar->>'shoes' in ('s_none','s_runner','s_white','s_blue','s_pink')
  and avatar->>'acc' in ('a_none','a_cap','a_headband','a_sunglasses','a_glasses','a_headphones','a_scarf','a_medal','a_watch')
)
```
Postgres does not allow subqueries in CHECK constraints, so the key-count part will need a small
`immutable` validation function in Phase 2. Treat this as a sketch to review then.
