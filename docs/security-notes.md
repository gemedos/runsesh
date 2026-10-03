# Security notes

## Step counts are self-reported

Every step number in runsesh comes from the user's own device: typed in by hand ("manual"),
read by the Android app from Health Connect ("health_connect"), or, in a later phase, sent by
an Apple Shortcut ("shortcut"). **The server cannot know whether a number is true.**

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
- **Source check:** `source` must be one of `manual`, `health_connect`, `shortcut`.
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

## Apple Shortcut keys (CLAUDE.md §2.1 exception, approved 2026-10-04)
iPhone web apps cannot read Apple Health, so an Apple Shortcut sends the daily total. A
Shortcut cannot hold a Supabase session, so each user can create one personal **Shortcut key**.

How it is protected:
- Created by the `shortcut-key` Edge Function from 32 random bytes (`crypto.getRandomValues`),
  format `rs_` + 43 base64url characters (256 bits; guessing is infeasible).
- Only its **SHA-256 hash** is stored (`public.shortcut_keys`, no client access: RLS on with no
  policies, all privileges revoked from `anon`/`authenticated`). The app shows the key once
  and never stores it; it is never logged and only travels in the `Authorization` header.
- One key per user. Creating a new one replaces the old; the user can revoke it; deleting the
  account deletes it.
- The key can only call `ingest-steps`, which writes the **key owner's** `daily_steps` row with
  `source = 'shortcut'`. The owner always comes from the key, never from the request. The usual
  constraints and the 3-days-back / 1-day-ahead window apply. It cannot read anything or log in.
- 30 requests per key per hour (`public.ingest_shortcut_steps`, callable only by the service role).

What it does **not** protect against:
- A leaked key (shared Shortcut, iCloud backup, someone with the phone) lets that person
  overwrite the owner's recent step totals until the key is revoked or replaced.
- Requests with unknown keys are not rate limited per IP (Supabase has no built-in per-IP
  limit for functions); they only cost Edge Function invocations from the monthly quota.
- Steps sent by a Shortcut are still **self-reported**: the user can edit the Shortcut or the
  Health data. `source = 'shortcut'` says which path was used, not that the number is true.
- **Double counting:** the Shortcut sums raw Health samples. If both the iPhone and an Apple Watch
  record, the sum counts steps twice unless the Shortcut filters to one source (the set-up
  guide says so). Unlike Health Connect on Android, Shortcuts has no de-duplicated daily total.

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
  - the Android app (Capacitor, Part B): email links always open in the phone's browser, never
    in the app, so a reset requested in the app can never finish through a `?code=` link;
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
