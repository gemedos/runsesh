# Vendored libraries

Third-party code is copied here and loaded from the app's own origin (no CDN, CLAUDE.md §8).
`.gitattributes` keeps these files byte-for-byte so the hashes below stay valid.

## @supabase/supabase-js

| | |
|---|---|
| Package | `@supabase/supabase-js` |
| Version | **2.117.2** (exact) |
| Registry | https://www.npmjs.com/package/@supabase/supabase-js |
| Maintainer | Supabase (npm maintainers `etienne_supa`, `mandarini`; repository github.com/supabase/supabase-js) |
| License | MIT (`supabase-js.LICENSE`) |
| Purpose | Auth (sign-up, login, sessions, password reset) and database access through the provider's official SDK |
| File used | `dist/umd/supabase.js` from the package → `vendor/supabase.js` (self-contained browser build; exposes `window.supabase`) |
| Tarball integrity (npm) | `sha512-eSG2VKnHR+Clp1PmidZ1/weJ8PJwoybjva3L2GgKqFG4YDS1Iqmc61psKGZP5xw6OMT2O7ZorPR42PY6q1BOXg==` |
| SHA-256 of `vendor/supabase.js` | `59d39487c3589843b410322d8a3d562ce022aba1e5ccb16898ef3fb2a0da2ecd` |
| Downloaded | 2026-10-04 with `npm pack @supabase/supabase-js@2.117.2` into a temporary folder; only the browser build was copied |

Checks done before adding it:
- The tarball's integrity matched the value published on the npm registry.
- No `eval(`, `new Function` or string-built functions (works with our CSP, no `'unsafe-eval'`).
- No source map reference, no hard-coded third-party origins it calls (only documentation links).

### Updating
1. `npm pack @supabase/supabase-js@<new exact version>` in a temporary folder (outside the repo).
2. Compare the tarball's integrity with `npm view @supabase/supabase-js@<version> dist.integrity`.
3. Repeat the checks above, copy `package/dist/umd/supabase.js` here, update this table
   (`sha256sum vendor/supabase.js`, or `certutil -hashfile vendor\supabase.js SHA256` on Windows).
4. Bump `CACHE_VERSION` in `sw.js` and re-run `docs/security-tests.md`.

Verify the current file at any time:
```
certutil -hashfile vendor\supabase.js SHA256
```
