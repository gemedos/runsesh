# Security tests

Manual test script required by CLAUDE.md §10. Run it after applying the migrations and after
every change to auth, the database or the service worker.

## Setup

```
powershell -ExecutionPolicy Bypass -File tools/serve.ps1
```
- App: http://localhost:8080/ · unit tests: http://localhost:8080/tests/ (all must PASS).
- Create two test accounts with throwaway addresses (never real user data): **User A** and
  **User B**. Confirm both by email. Note each user's id (Supabase dashboard → Authentication → Users).
- The console snippets below run in the browser console **on the app page** (it already has the
  SDK loaded and the CSP allows the Supabase origin). They use only the **publishable** key.

```js
// Paste once per console session.
// Not named URL: a top-level const would hide the browser's built-in URL that the SDK needs.
const SB_URL = 'https://qxjeaoxujpyafksxzqak.supabase.co';
const KEY = '<publishable key from js/config.js>';
const client = () => supabase.createClient(SB_URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const today = new Date().toISOString().slice(0, 10); // UTC day
const shift = (days) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const A_ID = '<user A id>', B_ID = '<user B id>';
const A = client();
await A.auth.signInWithPassword({ email: '<user A email>', password: '<user A password>' });
```
Do not paste real passwords anywhere else, and clear the console afterwards.

Manual entry is **off by default** (migration 16). Before sections 1 and 5, allow both test
accounts in the SQL editor (`docs/admin.md`, "Allow one player"); section 5b tests the switches.

## 1. Access control (User A against User B)
```js
await A.from('profiles').select('*').eq('id', B_ID);                       // expect data: []
await A.from('profiles').update({ display_name: 'Hacked' }).eq('id', B_ID).select(); // expect data: []
await A.from('daily_steps').select('*').eq('user_id', B_ID);              // expect data: []
await A.from('daily_steps').update({ steps: 1 }).eq('user_id', B_ID).select(); // expect data: []
await A.from('daily_steps').insert({ user_id: B_ID, day: today, steps: 1, source: 'manual' });
// expect error code 42501 (row-level security)
await A.from('daily_steps').delete().eq('user_id', A_ID).select();         // expect error or data: [] (no delete)
await A.from('profiles').insert({ id: A_ID });                             // expect error 42501
```
Then in the dashboard confirm User B's rows are unchanged.

## 2. Logged-out (anon key only) is denied
```js
const anon = client();
await anon.from('profiles').select('*');     // expect error 42501 "permission denied"
await anon.from('daily_steps').select('*');  // expect error 42501
await anon.from('daily_steps').insert({ user_id: A_ID, day: today, steps: 1, source: 'manual' }); // expect error
```

## 3. Avatar is validated by the database
```js
const good = { v: 1, skin: '#ff8c1a', hair: 'h_none', hairColor: 'hc_brown', top: 't_jersey', bottom: 'b_joggers', shoes: 's_runner', acc: 'a_none' };
await A.from('profiles').update({ avatar: good }).eq('id', A_ID).select();                       // expect success
await A.from('profiles').update({ avatar: { ...good, extra: 1 } }).eq('id', A_ID);              // expect error 23514
await A.from('profiles').update({ avatar: { ...good, skin: 'red' } }).eq('id', A_ID);           // expect error 23514
await A.from('profiles').update({ avatar: { ...good, acc: 'g_crown' } }).eq('id', A_ID);        // expect error 23514
await A.from('profiles').update({ avatar: { ...good, hair: 'h_'.padEnd(3000, 'x') } }).eq('id', A_ID); // expect error 23514
```

## 4. display_name and timezone limits
```js
await A.from('profiles').update({ display_name: 'A' }).eq('id', A_ID);              // expect 23514 (too short)
await A.from('profiles').update({ display_name: 'x'.repeat(31) }).eq('id', A_ID);   // expect 23514 (too long)
await A.from('profiles').update({ display_name: '  padded  ' }).eq('id', A_ID);     // expect 23514 (not trimmed)
await A.from('profiles').update({ timezone: '' }).eq('id', A_ID);                   // expect 23514
await A.from('profiles').update({ timezone: 'x'.repeat(65) }).eq('id', A_ID);       // expect 23514
await A.from('profiles').update({ id: B_ID }).eq('id', A_ID);                       // expect 42501 (column not updatable)
```

## 5. daily_steps rules
```js
const row = (extra) => ({ user_id: A_ID, day: today, steps: 5000, source: 'manual', ...extra });
await A.from('daily_steps').upsert(row()).select();                   // expect success
await A.from('daily_steps').upsert(row({ steps: -1 }));               // expect 23514
await A.from('daily_steps').upsert(row({ steps: 100001 }));           // expect 23514
await A.from('daily_steps').upsert(row({ source: 'fitbit' }));        // expect 23514
await A.from('daily_steps').upsert(row({ day: shift(-4) }));          // expect 23514 "day outside the allowed window"
await A.from('daily_steps').upsert(row({ day: shift(30) }));          // expect 23514
await A.from('daily_steps').upsert(row({ user_id: B_ID }));           // expect 42501
```

## 5b. Manual entry switches
Use the console session from "Setup" (User A signed in as `A`). Switches are set in the SQL editor
(`docs/admin.md`).
```js
// A has no user_settings row (default): manual entry is off
await A.from('daily_steps').upsert({ user_id: A_ID, day: today, steps: 111, source: 'manual' });          // expect error 23514 (manual entry is turned off)
await A.from('daily_steps').upsert({ user_id: A_ID, day: today, steps: 111, source: 'health_connect' });  // expect error 23514 (source does not matter)
await A.from('user_settings').insert({ user_id: A_ID, manual_entry: true });                         // expect error 42501
await A.from('user_settings').update({ manual_entry: true }).eq('user_id', A_ID);                    // expect error 42501
await A.from('app_settings').update({ manual_entry: true });                                          // expect error 42501
await A.from('user_settings').select('user_id, manual_entry').eq('user_id', B_ID);                // expect data: [] (cannot see B)
await client().from('app_settings').select('manual_entry');                                        // anon: expect error 42501
```
Then allow A in the SQL editor and repeat the first line: it succeeds. Switch the global
setting off: it fails again. Switch it back on. In the app (as A), Health connect shows the form
only while both are on. A phone sync with A's ingest token works in every case.

## 6. No account enumeration
Use one registered and one unregistered address:
- **Sign up** with each: the app shows the same "Check your email…" message.
- **Log in** with a wrong password for each: the same "Could not log in…" message.
- **Forgot password** for each: the same "If an account exists…" message.
- In DevTools → Network, the responses must not reveal the difference to the user interface.
  (Supabase's sign-up response is designed to look the same for existing emails when email
  confirmation is on.)

## 6b. Email links (auth-callback.html)
Use a test account. After each case, check that the address bar shows only
`…/auth-callback.html` (no `code`, `token_hash`, `error` or `#…` left) and that the DevTools
Console shows nothing from the URL or the session.

1. **token_hash flow (unchanged, recommended templates):** with the `token_hash` templates,
   confirm a new account → "Email confirmed… return to the app and log in". Request a reset →
   the link opens "Set a new password". Works in any browser.
2. **Reset with the DEFAULT template, same browser:** temporarily switch the "Reset password"
   template back to the default (`{{ .ConfirmationURL }}`). Request a reset on the app in browser X,
   open the email link **in browser X** → "Set a new password" opens; setting it works.
3. **Reset with the DEFAULT template, different browser:** request in browser X, open the link
   in browser Y (or a private window) → message: "…If it was a password reset, open the link in
   the same browser where you asked for it, or request a new one." No session is created in Y.
4. **Tampered code:** open `auth-callback.html?code=abc` → "This link is invalid or has expired".
   No request is sent to Supabase (Network tab).
5. **Error link:** open `auth-callback.html?error=access_denied&error_code=otp_expired` and also
   `auth-callback.html#error=access_denied&error_code=otp_expired` → "invalid or has expired".
6. **Fallback from the main page:** open `index.html?code=abc` and `index.html#error=x` → the app
   forwards to `auth-callback.html`, which shows the invalid message.
7. Restore the `token_hash` templates afterwards.

## 6c. Phone ingest tokens and the `ingest-steps` endpoint
Deploy `ingest-tokens` (Verify JWT **ON**) and `ingest-steps` (Verify JWT **OFF**) first
(`docs/edge-functions.md`). The parser itself is covered by `node tests/ingest-steps.node.mjs`.

**Never paste a real token into chats, issues or files.** The commands below use the fake token
`00000000-0000-4000-8000-000000000000.AAAA…`. Where a test needs a real one, create a token for
the **test account A** in the app and type it only into your own `cmd` window with `set`.
Revoke it when you are done.

### Setup (Windows `cmd`, not PowerShell)
```
set URL=https://qxjeaoxujpyafksxzqak.supabase.co/functions/v1/ingest-steps
set FAKE=00000000-0000-4000-8000-000000000000.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
set TODAY=2026-10-05
```
Set `TODAY` to today's **UTC** date. Every command prints the response headers and body
(`-i`): read the first line (`HTTP/1.1 401` …) and the last line (the body).

### 1. Every authentication failure is the identical 401 and writes nothing
Expected for each: `401` with body exactly `{"error":"unauthorized"}`.
```
curl -s -i -X POST "%URL%" -H "Content-Type: application/json" -d "{\"day\":\"%TODAY%\",\"steps\":1}"
curl -s -i -X POST "%URL%" -H "Authorization: Bearer abc" -H "Content-Type: application/json" -d "{\"day\":\"%TODAY%\",\"steps\":1}"
curl -s -i -X POST "%URL%" -H "Authorization: Basic abc" -H "Content-Type: application/json" -d "{\"day\":\"%TODAY%\",\"steps\":1}"
curl -s -i -X POST "%URL%" -H "Authorization: Bearer %FAKE%" -H "Content-Type: application/json" -d "{\"day\":\"%TODAY%\",\"steps\":1}"
```
With a real token for A (`set TOKEN=<your test token>` and `set TOKEN_ID=<the part before the dot>`),
right id but wrong secret:
```
curl -s -i -X POST "%URL%" -H "Authorization: Bearer %TOKEN_ID%.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" -H "Content-Type: application/json" -d "{\"day\":\"%TODAY%\",\"steps\":1}"
```
Revoked token: after step 6.3, repeat the first request of step 3 with the revoked `%TOKEN%`:
also `401`, immediately. A's steps for today must not change in any of these.

### 2. Wrong method, content type, size and JSON
```
curl -s -i "%URL%"
curl -s -i -X POST "%URL%" -H "Authorization: Bearer %FAKE%" -H "Content-Type: text/plain" -d "{\"day\":\"%TODAY%\",\"steps\":1}"
curl -s -i -X POST "%URL%" -H "Authorization: Bearer %FAKE%" -H "Content-Type: application/json" -d "{not json"
for /L %i in (1,1,700) do @echo aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa>>big.json
curl -s -i -X POST "%URL%" -H "Authorization: Bearer %FAKE%" -H "Content-Type: application/json" --data-binary "@big.json"
del big.json
```
Expected: `405`, `415`, `400 {"error":"invalid"}`, `413 {"error":"too_large"}`. None of them
writes anything.

### 3. Valid and invalid payloads (real token for A)
Create an Android token for A in the app and `set TOKEN=…`.
```
curl -s -i -X POST "%URL%" -H "Authorization: Bearer %TOKEN%" -H "Content-Type: application/json" -d "{\"day\":\"%TODAY%\",\"steps\":4321}"
```
Expected `200 {"ok":true,"days":1}`. In the app (as A): today = 4,321 with source
**Health Connect**, and the token shows "Last received …".

Each of these must return `400 {"error":"invalid"}` and leave today at 4,321 (negative, over
100,000, decimal, text, impossible date, outside the window, more than 3 days, a mixed valid and
invalid batch):
```
curl -s -i -X POST "%URL%" -H "Authorization: Bearer %TOKEN%" -H "Content-Type: application/json" -d "{\"day\":\"%TODAY%\",\"steps\":-1}"
curl -s -i -X POST "%URL%" -H "Authorization: Bearer %TOKEN%" -H "Content-Type: application/json" -d "{\"day\":\"%TODAY%\",\"steps\":100001}"
curl -s -i -X POST "%URL%" -H "Authorization: Bearer %TOKEN%" -H "Content-Type: application/json" -d "{\"day\":\"%TODAY%\",\"steps\":12.5}"
curl -s -i -X POST "%URL%" -H "Authorization: Bearer %TOKEN%" -H "Content-Type: application/json" -d "{\"day\":\"%TODAY%\",\"steps\":\"9000\"}"
curl -s -i -X POST "%URL%" -H "Authorization: Bearer %TOKEN%" -H "Content-Type: application/json" -d "{\"day\":\"2026-02-30\",\"steps\":1}"
curl -s -i -X POST "%URL%" -H "Authorization: Bearer %TOKEN%" -H "Content-Type: application/json" -d "{\"day\":\"2020-01-01\",\"steps\":1}"
curl -s -i -X POST "%URL%" -H "Authorization: Bearer %TOKEN%" -H "Content-Type: application/json" -d "{\"days\":[{\"day\":\"%TODAY%\",\"steps\":1},{\"day\":\"%TODAY%\",\"steps\":2},{\"day\":\"%TODAY%\",\"steps\":3},{\"day\":\"%TODAY%\",\"steps\":4}]}"
curl -s -i -X POST "%URL%" -H "Authorization: Bearer %TOKEN%" -H "Content-Type: application/json" -d "{\"days\":[{\"day\":\"%TODAY%\",\"steps\":5000},{\"day\":\"2020-01-01\",\"steps\":1}]}"
```
A `user_id` in the body is ignored:
```
curl -s -i -X POST "%URL%" -H "Authorization: Bearer %TOKEN%" -H "Content-Type: application/json" -d "{\"user_id\":\"<user B id>\",\"day\":\"%TODAY%\",\"steps\":4322}"
```
Expected `200`: **A's** today becomes 4,322 and B's steps are unchanged.

### 4. Rate limit
Each token allows 20 requests per hour, counting every request with a valid token (including
the ones above). Send 21 empty requests:
```
for /L %i in (1,1,21) do @curl -s -X POST "%URL%" -H "Authorization: Bearer %TOKEN%" -H "Content-Type: application/json" -d "{\"days\":[]}" & echo.
```
Expected: `{"ok":true,"days":0}` until the hour's 20th request, then `{"error":"rate_limited"}`
(status 429). An hour after the first request it works again.

### 5. Token table: own rows only, no hash, no direct writes (browser console)
Use the console session from "Setup" (User A signed in as `A`; `client()` is anon). Create one
token for **B** in the app first and note its `id` from the dashboard (Table Editor →
`ingest_tokens`; never copy `secret_hash`).
```js
const B_TOKEN_ID = '<B token id>';
await A.from('ingest_tokens').select('id, platform, secret_hint, created_at, last_used_at'); // expect only A's rows
await A.from('ingest_tokens').select('id').eq('id', B_TOKEN_ID);                    // expect data: []
await A.from('ingest_tokens').select('*');                                          // expect error 42501 (not every column is readable)
await A.from('ingest_tokens').select('secret_hash');                                // expect error 42501
await A.from('ingest_tokens').select('uses_in_window, window_start');               // expect error 42501
await A.from('ingest_tokens').insert({ id: crypto.randomUUID(), user_id: A_ID, platform: 'android', secret_hash: '0'.repeat(64), secret_hint: 'AAAA' }); // expect error 42501
await A.from('ingest_tokens').update({ platform: 'ios' }).eq('user_id', A_ID);      // expect error 42501
await A.from('ingest_tokens').delete({ count: 'exact' }).eq('id', B_TOKEN_ID);      // expect count: 0 (B's token keeps working)
await A.rpc('create_ingest_token', { p_id: crypto.randomUUID(), p_user_id: A_ID, p_platform: 'android', p_secret_hash: '0'.repeat(64), p_secret_hint: 'AAAA' }); // expect error 42501
await A.rpc('record_ingest', { p_token_id: B_TOKEN_ID, p_secret_hash: '0'.repeat(64), p_days: [] }); // expect error 42501
const anon = client();
await anon.from('ingest_tokens').select('id');                                      // expect error 42501
await anon.functions.invoke('ingest-tokens', { body: { platform: 'android' } });    // expect an error (401)
```

### 6. Shown once, at most 2, revoke is immediate (in the app, as A)
1. Create a token: it appears once with Copy and Done. Tap Done, leave the screen and come back:
   only "Token ending in …" is listed; the token cannot be shown again.
2. With 2 tokens (any platforms) the create button is disabled. Check that the server refuses a
   third too, **only when you already have 2** (so no token is printed to the console):
   ```js
   await A.functions.invoke('ingest-tokens', { body: { platform: 'android' } }); // expect an error with status 409
   ```
3. Revoke one: it disappears from the list, and a request with it returns `401` at once.
4. Log out on that device: the token card and any token on screen are gone.

### 7. Logs contain nothing personal
Dashboard → Edge Functions → `ingest-steps` → Logs: lines look like
`ingest-steps outcome=ok token=1a2b3c4d`. No token, body, dates, step values or emails. Check
`ingest-tokens` too: no tokens or user data.

### 8. Real-world test (Android phone with Life Dashboard Companion 1.23.0)
Follow `docs/android-setup.md`. After a Sync Now that reports records:
- the token shows "Last received …" at the time of the sync;
- runsesh shows today with source Health Connect;
- **today's number matches the Health Connect app**. This confirms which day
  `daily_totals.date` refers to. Write the result and the date here.

### 9. Security Advisor
Dashboard → Advisors → Security Advisor → Refresh. Expected: no **new** warnings from migrations
13 and 14 (`create_ingest_token` and `record_ingest` are not SECURITY DEFINER, and only
`service_role` may execute them). Note any warning and tell Claude.

## 6d. Parties, invites, competitions, background photo
Use three test accounts: **A** (leader), **B** (member), **C** (not in A's party). In the console,
sign each one in as in "Setup" (`A`, `B`, `C` clients). Replace `<…>` placeholders.

**Party rules**
```js
await A.rpc('create_party', { p_name: 'Test party' });            // ok, A is leader
await A.rpc('create_party', { p_name: 'Second' });                // error already_in_party
const { data: CODE } = await A.rpc('create_invite');              // 24-char code, shown once
await B.rpc('join_party', { p_code: CODE });                      // 'ok'
await B.rpc('join_party', { p_code: CODE });                      // 'already_in_party'
await C.rpc('join_party', { p_code: 'x'.repeat(24) });            // 'invalid_invite'
```
1. **One party per user:** B cannot create or join a second party (above).
2. **Reads stay inside the party:** as C, `C.from('parties').select('*')`,
   `C.from('party_members').select('*')`, `C.from('competitions').select('*')`,
   `C.from('daily_steps').select('*').eq('user_id', A_ID)` and
   `C.from('profiles').select('*').eq('id', A_ID)` all return `[]`. As B, A's profile and steps are visible.
3. **No direct writes:** as B, `B.from('party_members').insert({ user_id: B_ID, party_id: '<id>', role: 'leader' })`,
   `B.from('party_members').update({ role: 'leader' }).eq('user_id', B_ID)` and
   `B.from('party_members').delete().eq('user_id', A_ID)` all fail or change nothing.
4. **Leader-only actions:** as B: `B.rpc('kick_member', { p_user: A_ID })` → error `not_leader`;
   `B.rpc('expire_all_invites')` → `not_leader`; `B.from('parties').update({ name: 'Hacked' }).eq('id', '<party id>').select()` → `[]`.
   As A: `A.rpc('kick_member', { p_user: B_ID })` works and B is out.
5. **Invites:** a code works for 7 days and 25 joins at most; after `A.rpc('revoke_my_invites')`
   A's codes return `'invalid_invite'` but B stays a member; after `A.rpc('expire_all_invites')`
   every code of the party is dead, members stay. A member's codes stop working when they leave.
6. **Rate limit:** as C, 11 `join_party`/`preview_invite` calls with wrong codes within an hour →
   the 11th returns `'rate_limited'` (and the counter is not undone by failures).
7. **Party size:** the 21st member gets `'party_full'`.
8. **Leadership handover:** A leaves (`A.rpc('leave_party')`) → B becomes leader. When the last
   member leaves, the party is deleted. Deleting the leader's account behaves like leaving.
9. **Invite link in the URL:** open `…/#/join/<CODE>` → the address bar immediately shows `…/#/join`;
   the code is not in browser history or in any request to GitHub Pages (Network tab).

**Competitions**
10. As B: `B.from('competitions').insert({ party_id: '<id>', name: 'x', start_day: today, mode: 'days_won' })`
    → 42501; `update`/`delete` on the active one → no rows changed; `B.rpc('end_competition', { p_id: '<id>' })` → `not_allowed`.
11. As A: create one competition; a second insert while it is active → unique-constraint error.
12. As A: `end_competition` → `competition_results` has one row per member with frozen ranks; the
    competition can no longer be edited or deleted (history); a new one can be created.
13. As C: `C.from('competition_results').select('*')` → `[]`.
14. A competition whose `end_day` has passed is frozen the next time any member opens the app
    (`finalize_due_competitions`).
15. Constraints: `theme: 'neon'`, `mode: 'x'`, `end_day` before `start_day`, a `background_path`
    pointing to another party's folder → all rejected (23514).

**Background photo (storage bucket `competition-backgrounds`)**
16. As B (member): uploading to `<party id>/<uuid>.jpg` → denied; reading A's photo via
    `B.storage.from('competition-backgrounds').createSignedUrl(path, 60)` → works.
17. As C: `createSignedUrl` for that path → denied; uploading into A's party folder → denied.
18. Upload a PNG with GPS EXIF data as the leader, download it from the dashboard → it is a JPEG with
    no EXIF/GPS block (re-encoded in the browser). A non-image renamed to `.jpg` is rejected.
19. Files over 2 MB or with another content type are rejected by the bucket itself.

## 7. Logout clears everything
1. Log in, browse every screen, save steps and an avatar.
2. Log out (Profile → Login / Log out, or Account → Log out).
3. DevTools → Application: **Cache Storage** empty, **IndexedDB** empty, no `runsesh.*` keys
   and no `sb-…-auth-token` key in Local Storage, **Service Workers** unregistered (it registers
   again on the next load, with an empty cache).
4. The app shows only the login screen.
5. Repeat test 2's snippets in the same tab: they are still denied.
6. "Log out of all devices": log in on two browsers, use it in one; the other is logged out at
   its next token refresh (within about an hour) and API calls from it fail after that.

## 8. CSP and general
1. With DevTools Console open, visit every route and refresh: `#/login`, `#/signup`, `#/forgot`,
   `#/reset`, `#/race`, `#/race/create-party`, `#/competition`, `#/profile`, `#/profile/avatar`,
   `#/profile/members`, `#/profile/rules`, `#/profile/competition`, `#/profile/login`,
   `#/profile/account`, `#/profile/health`, plus `privacy.html` and `auth-callback.html`.
   Expected: no `Content-Security-Policy` violations and no errors.
2. The only network requests go to the app's own origin and to
   `https://qxjeaoxujpyafksxzqak.supabase.co`.
3. Cache Storage never contains Supabase responses (cross-origin requests are ignored by `sw.js`).

## 9. XSS
1. Set the display name to `<img src=x onerror=1>` (21 characters): it shows as plain text
   on Profile and Account. Nothing is rendered as HTML.
2. Create a competition named `<img src=x onerror=alert(1)>`: shown as text. No alert.
3. Unit tests cover the avatar whitelist and color validation (`tests/avatar.test.js`).

## 10. Secret scan of the published files
```
grep -rniE "service_role|secret|password|sk_live|eyJhbGciOi" --include=*.html --include=*.js --include=*.css --include=*.json . --exclude-dir=node_modules --exclude-dir=tests
```
Expected: only UI labels and comments (for example "Change password", "never put the service_role
key here"), the vendored SDK's own code, and **no key values**. The publishable key in
`js/config.js` is the only key allowed (it is public by design).
