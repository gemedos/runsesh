# Avatar JSON schema (v1)

This is the exact format the app produces and accepts. The Supabase database
enforces the same rules (see "Database enforcement" below); the client check in
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

## Database enforcement (Phase 2)

`public.profiles.avatar` has the constraint `profiles_avatar_check`, which calls
`private.is_valid_avatar(jsonb)` (migration `supabase/migrations/20261003120000_create_private_schema.sql`).
It enforces exactly the rules above: the 8 keys only, `v = 1`, `skin` matching
`^#[0-9A-Fa-f]{6}$`, every part ID in the lists above, and a serialized size under 2 KB
(the browser additionally limits it to 512 characters). `avatar` may be `null`, which means
"use the default avatar".

If you change the schema, update this file, `js/avatar/parts.js`, `js/strings.js`,
`tests/avatar.test.js` and add a **new** migration that replaces `private.is_valid_avatar`.
