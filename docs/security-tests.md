# Security tests

Manual test script required by CLAUDE.md §10. Items marked **Phase 2+** cannot be run yet,
because Phase 1 has no backend, no accounts and makes no network requests.

## Setup

```
powershell -ExecutionPolicy Bypass -File tools/serve.ps1
```
Open http://localhost:8080/ (the app) and http://localhost:8080/tests/ (unit tests: all must PASS).

## Phase 1 checks (run now)

### 5. XSS
1. Profile → Competition → Create a competition.
2. Name: `<img src=x onerror=alert(1)>`, pick a start date, submit.
3. Expected: the name is shown literally as text on the Competition screen and the Race page. No alert.
4. DevTools → Application → Local Storage → edit `runsesh.local.v1` and set
   `avatar.skin` to `"/><script>alert(1)</script>` or `avatar.hair` to `"<b>x</b>"`. Reload.
   Expected: no alert; the default avatar is shown (invalid avatar rejected).
5. Unit tests cover the avatar whitelist and color validation (`tests/avatar.test.js`).

### 6. CSP
1. Open DevTools Console, then visit every screen: Race, Create a party, Profile, Avatar editor
   (all tabs), Party settings → Manage members / Party rules, Competition, Login, Account, Health connect.
2. Expected: no `Content-Security-Policy` violations.
3. `grep -rnE "innerHTML|outerHTML|document.write|eval\(|new Function" js` returns only comments.

### Service worker / PWA
1. Load the app once, then DevTools → Application → Cache Storage: only `runsesh-shell-vN`
   containing static files (HTML, JS, CSS, font, icons, images). No user data.
2. Change any shell file and bump `CACHE_VERSION` in `sw.js`, reload: an "An update is available"
   banner appears; tapping Reload activates the new version and the old cache is deleted.
3. Offline (DevTools → Network → Offline), reload: the app shell still loads.

## Phase 2+ checks (not runnable yet)

1. **Access control:** with two test accounts, User A cannot read, update or delete User B's
   records through the provider API, including by changing IDs.
2. **Unauthenticated access:** logged-out requests to every table/endpoint are denied.
3. **Enumeration:** login/reset responses are identical for existing and non-existing emails.
4. **Logout:** after logout, caches and local data (including `runsesh.local.v1` and
   `runsesh.iosHintDismissed`) are cleared, the service worker is reset, and API calls fail.
