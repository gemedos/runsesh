# Security notes

## Step counts are self-reported

Every step number in runsesh comes from the user's own device: typed in by hand ("manual"),
sent from Health Connect by a third-party Android app ("health_connect"), or sent by an
Apple Shortcut ("shortcut"). **The server cannot know whether a number is true.**

Anyone who controls their own account can:
- type any number into manual entry;
- send requests to the API directly (with their own session) instead of using the app;
- edit or fake data in Health Connect, use a step-faking app, or shake their phone;
- set the `source` column to any allowed value: `source` records where the app *says* the
  number came from, not a verified origin.

### What the server limits DO
These run in the database, so they apply even to direct API calls:
- **Row Level Security:** a user can only read, insert and update **their own** rows. Nobody
  can write steps for someone else or change another person's profile.
- **Range check:** `steps` must be a whole number from 0 to 100,000 per day.
- **Source check:** `source` must be one of `manual`, `health_connect`, `shortcut`, `admin`.
  `admin` marks totals the project owner entered in the dashboard (migration 15): players can
  neither write `admin` nor overwrite an `admin` row through the API.
- **Manual entry switches** (migration 16): a player can write `daily_steps` directly only if the
  global switch (`app_settings`) and their own switch (`user_settings`, no row = off) are on.
  Checked in the guard for every direct write, whatever `source` the request claims. Players
  can read but never change the switches. Phone ingest (service role) is not affected.
- **Time window:** only days from 3 days before today to 1 day after today (UTC) can be
  written or changed, so old results cannot be rewritten later.
- **No deletes and no key changes:** clients cannot delete rows or move a row to another
  user or day.
- **Avatar, display name and time zone** are validated by database constraints.

### What they do NOT prevent
- A believable but invented number (for example 14,000 instead of 9,000).
- Repeatedly overwriting today's value within the allowed window.
- Claiming `health_connect` as the source for a typed-in number.

They stop casual abuse and mistakes, not a determined cheater.

### What would be needed to trust steps more
- **Plausibility checks** on the server (for example an Edge Function that rejects sudden
  jumps or values far above a user's usual range) and flags for the party to review.
- **Attested data:** only accept steps written by a verified app build (for example Android
  Play Integrity) and read through platform aggregation. This needs Google Play distribution
  and a server-side check, and still cannot stop a rooted device or a shaken phone.
- **Social trust:** parties are small groups of friends; show the source and last update
  time next to each number so members can notice odd values.

## Phone ingest tokens (CLAUDE.md "Health data ingest tokens", approved 2026-10-04)
Phones send daily step totals without a Supabase session: the Android Health Connect webhook app
and the iPhone Shortcut. Each user can create up to 2 personal **ingest tokens** (platform
`android` or `ios`). This replaced the earlier Apple Shortcut keys (`shortcut_keys`, removed by
migration 14).

How it is protected:
- Created by the `ingest-tokens` Edge Function (Verify JWT ON; the user id comes from the
  session) from 32 random bytes (`crypto.getRandomValues`). Format `<token id>.<secret>`:
  a uuid plus 43 base64url characters (256 bits; guessing is infeasible).
- Only the **SHA-256 hash** of the secret is stored (`public.ingest_tokens`). Clients can list
  their own tokens through RLS and column grants that exclude `secret_hash` and the rate-limit
  counters, and can delete (revoke) their own tokens. They cannot insert or update tokens.
- The token is shown once, kept only in the page until the user taps Done or leaves the screen,
  never written to storage or caches, never logged, and only sent in the `Authorization` header.
- At most 2 tokens per user (checked in the database under a per-user lock). Revoking deletes
  the row, so it stops working immediately. Deleting the account deletes the tokens.
- The token can only call `ingest-steps`, which writes the **token owner's** `daily_steps`
  through `public.record_ingest` (service role only). The owner always comes from the token,
  never from the request; `source` is `health_connect` for Android and `shortcut` for iPhone
  tokens. The usual constraints and the 3-days-back / 1-day-ahead window apply.
- Every authentication failure (missing, malformed, unknown, revoked, wrong secret) returns the
  identical 401. The hash comparison happens in the database; comparing two SHA-256 hashes leaks
  nothing useful through timing, because an attacker cannot choose the hash of a guess.
- 20 requests per token per hour (429 afterwards), 16 KB body limit (413), JSON only (415).
- Logs hold only the outcome and the first 8 characters of the token id: never the token, the
  body, dates or step values. No CORS: browsers cannot call the endpoint from other sites.

### Accepted trade-offs (Phase 2 Part B)
1. **A third-party app reads Health Connect.** Android users install Life Dashboard Companion
   (independent, open source, MIT). Neither we nor the user control its code. Risk reduction:
   it has recent releases; the guide pins one release (1.23.0, with GitHub's SHA-256 of the APK)
   and links only to the official releases page; the user grants only the Steps permission and
   enables only Steps for the webhook; runsesh reads only `daily_totals[].date` and `.steps` and
   ignores, never stores and never logs everything else in the payload.
2. **The endpoint runs with Verify JWT OFF**, because phone apps have no login session. The
   personal token is the only gate, so the hardening above is mandatory and must not be relaxed.
3. **Step values are self-reported** and can be faked (see above). `source` says which path was
   used, not that the number is true.
4. **Background sync depends on the third-party app and on Android's battery management.** Gaps
   are possible; the user guide says so, and manual entry remains available.

What it does **not** protect against:
- A leaked token (shared screenshot, someone with the phone, a compromised app) lets that person
  overwrite the owner's recent step totals until the token is revoked.
- Requests with unknown tokens are not rate limited per IP (Supabase has no built-in per-IP
  limit for functions); they only cost Edge Function invocations from the monthly quota.
- **Which day:** the Android app's `daily_totals[].date` is stored as sent. Its docs do not say
  which time zone that date uses; we assume the phone's local day (to be confirmed by comparing
  with the Health Connect app). The iPhone Shortcut sends its own local date.
- **Double counting on iPhone:** the Shortcut sums raw Health samples. If both the iPhone and an
  Apple Watch record, the sum counts steps twice unless the Shortcut filters to one source (the
  set-up guide says so). On Android, `daily_totals` comes from Health Connect's de-duplicated
  aggregate.
- **Backfill:** only today and the last 3 days are accepted, so older history cannot be sent.

## Parties and invite links (CLAUDE.md exception, approved 2026-10-05)
- **One party per user** (primary key on `party_members.user_id`), one leader per party (unique
  index). Membership only changes through database functions that check the caller's role:
  every member may create invite links and leave; only the leader may remove members, expire
  all invite links, rename the party, change its rules and manage competitions.
- **Visibility:** party members can read each other's display name, avatar, time zone and daily
  step totals. Nobody outside the party can; email addresses are never readable by other users.
- **Invite codes:** 18 random bytes (pgcrypto), only the SHA-256 hash stored, valid 7 days and
  25 joins, revocable (each member revokes their own links; the leader expires all of them).
  Links carry the code only after `#` (`…/#/join/CODE`), so it is never sent to GitHub Pages or in
  a Referer header; the app removes it from the address bar and history at once and keeps it in
  memory only. Joining/previewing is limited to 10 attempts per user per hour, counted even
  when the code is wrong. Parties are capped at 20 members.
- **What it does not prevent:** anyone who gets a working link (forwarded chat, screenshot) can
  join until it expires or is turned off. Leaders can remove unwanted members.
- **Leadership handover:** if the leader leaves or deletes their account, the longest-standing
  member becomes leader automatically; a party with nobody left is deleted.

## Competitions and the background photo
- One active competition per party (unique index). Every member takes part automatically.
  Only the leader creates, edits, ends or deletes it (RLS + `end_competition`).
- When a competition ends (by date, or "End competition now"), its standings are **frozen** into
  `competition_results` by the database, with a snapshot of each member's display name and
  avatar. These rows are deleted if that person deletes their account.
- **Photo upload:** only the leader, only into their own party's folder of the private bucket
  `competition-backgrounds`; members read it through short-lived signed URLs (1 hour).
  The browser re-encodes every photo to JPEG (max 1600 px), which strips all metadata such as
  GPS location; the bucket accepts only JPEG up to 2 MB. CSP `img-src` allows the project's
  Supabase origin for this (no other origin).
- Photos are not scanned for content. A leader could upload something unpleasant; members can
  leave the party. Deleting a party does not yet delete its photos from storage (clean-up TODO).

## Keys and secrets
- The browser only ever has the **publishable (anon) key** (`js/config.js`). It is public by
  design; RLS decides what each signed-in user can do.
- The **service_role / secret key** and the database password must never be in this
  repository, in `js/config.js`, or on this machine. A future account-deletion Edge Function
  will use the key that Supabase injects into its own function environment.

## Sessions
- The Supabase SDK stores the session in its default browser storage. The app never copies
  tokens anywhere else, never puts them in URLs, and never logs them.
- On sign-out the app deletes all service worker caches, IndexedDB databases, its own
  `runsesh.*` localStorage keys and session storage, unregisters the service worker and
  reloads, so the next person on the device sees nothing.

## Email links
- Confirmation and reset emails link to `auth-callback.html` with a **one-time** `token_hash`.
  The page removes it from the address bar immediately and exchanges it with `verifyOtp`.
- Allowed `type` values and the token format are checked before use.
- Error links (`?error=…` or `#error=…`, for example an expired link) show a generic
  "invalid or expired" message. Nothing from the URL or the session is logged.

### Same-browser limitation of the default `?code=` links
If the email templates are left at Supabase's default, links arrive as `?code=…` (PKCE).
`auth-callback.html` handles them as a fallback, but such a code can only be exchanged **in the
same browser storage that started the request**, because the SDK keeps the one-time code
verifier there. Verified in `vendor/supabase.js` 2.117.2.

- **Sign-up confirmation** still works anywhere: Supabase confirms the email *before* it
  redirects, so the page tells the user to log in even when the exchange fails.
- **Password reset** only completes in the same browser. Opened anywhere else, the user sees
  "open the link in the same browser where you asked for it, or request a new one".
- **Installed apps are affected**, because their storage is separate from the browser that
  opens the email:
  - an installed iPhone home-screen app: its storage is separate from Safari's;
  - an installed Android PWA when the email opens in a different browser than the one it was
    installed from.
- With our client settings only the most recent request per browser can be exchanged (the SDK
  reads its single standard verifier slot).

The `token_hash` templates (dashboard checklist) do not have this limitation and remain the
recommended setup.

## Known limits of GitHub Pages
- No custom HTTP headers: the CSP is a `<meta>` tag, and `frame-ancestors` cannot be set, so
  clickjacking cannot be fully blocked.
