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
const URL = 'https://qxjeaoxujpyafksxzqak.supabase.co';
const KEY = '<publishable key from js/config.js>';
const client = () => supabase.createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const today = new Date().toISOString().slice(0, 10); // UTC day
const shift = (days) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const A_ID = '<user A id>', B_ID = '<user B id>';
const A = client();
await A.auth.signInWithPassword({ email: '<user A email>', password: '<user A password>' });
```
Do not paste real passwords anywhere else, and clear the console afterwards.

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

## 6c. Apple Shortcut keys
Deploy both Edge Functions first (`docs/edge-functions.md`). Use the console session from
"Setup" (User A signed in as `A`). `FN` is the functions base URL.
```js
const FN = `${URL}/functions/v1`;
const call = (path, opts = {}) => fetch(`${FN}/${path}`, opts).then(async (r) => [r.status, await r.json().catch(() => null)]);
```
1. **Create, shown once:** in the app (Profile → runsesh on iPhone → Create Shortcut key) create a
   key and copy it into `KEY_A`. Leave the screen and come back: only "…last 4 characters" is shown.
   In the dashboard Table Editor, `shortcut_keys` has one row for A with a 64-character
   `key_hash` and **no** readable key.
   ```js
   const KEY_A = '<paste>';
   ```
2. **Ingest works for the owner only:**
   ```js
   await call('ingest-steps', { method: 'POST', headers: { Authorization: `Bearer ${KEY_A}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ day: today, steps: 4321 }) });
   // expect [200, {ok: true}]; A's daily_steps for today = 4321, source 'shortcut'
   await call('ingest-steps', { method: 'POST', headers: { Authorization: `Bearer ${KEY_A}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: B_ID, day: today, steps: 1 }) });
   // expect [200, …] but the row written is A's (user_id in the body is ignored); B unchanged
   ```
3. **Invalid input → 400:** `steps: -1`, `steps: 100001`, `steps: 12.5`, `steps: "9000"`,
   `day: "2026-02-30"`, `day: shift(-4)` (outside the window), a body that is not JSON.
4. **Wrong method → 405:** `await call('ingest-steps')` (GET).
5. **Unknown / malformed / revoked key → 401:** `Bearer rs_` + 43 random characters; `Bearer abc`;
   no header; then revoke the key in the app and repeat step 2 → 401.
6. **Rate limit:** with a fresh key, send 31 valid requests within an hour → the 31st returns 429.
7. **Replace:** create a new key → the old key returns 401, the new one works.
8. **No client access:**
   ```js
   await A.from('shortcut_keys').select('*');        // expect error 42501 (permission denied)
   await A.rpc('ingest_shortcut_steps', { p_key_hash: '0'.repeat(64), p_day: today, p_steps: 1 }); // expect error 42501
   await client().from('shortcut_keys').select('*'); // anon: expect error 42501
   ```
9. **shortcut-key requires a session:** `await call('shortcut-key')` without a session → 401;
   calling it from another web origin is blocked by CORS.
10. **Nothing logged:** dashboard → Edge Functions → each function → Logs: no keys, step values
    or emails appear (only status lines).
11. **Account deletion** (when built): the user's `shortcut_keys` row is gone.

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
