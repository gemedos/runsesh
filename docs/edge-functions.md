# Edge Functions (deployed by hand from the dashboard)

The source of each function lives in `supabase/functions/<name>/index.ts`. There is no Supabase
CLI and no deploy script in this repository: paste each file into the dashboard editor.

| Function | Called by | Verify JWT |
|---|---|---|
| `ingest-tokens` | the runsesh web app (signed-in user): creates a personal ingest token | **ON** |
| `ingest-steps` | the user's phone: Android webhook app or Apple Shortcut (personal ingest token) | **OFF** |

`ingest-steps` is the only function with Verify JWT OFF: the personal token is its only gate.
The old `shortcut-key` function is no longer used: delete it in the dashboard once migration
`20261006120100_remove_shortcut_keys.sql` has run.

Both use only the variables Supabase provides to every function automatically
(`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). **Do not add secrets
yourself and never paste the service-role key anywhere.**

## Before deploying
Run `supabase/migrations/20261006120000_create_ingest_tokens.sql` in the SQL editor (the same
way as the others) and the verification queries for it.

## Deploy (repeat for each function)
1. Dashboard → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Function name: exactly `ingest-tokens` or `ingest-steps`.
3. Replace the example code with the whole content of the matching `index.ts`, then **Deploy**.
4. Open the function → **Details / Settings** → **Verify JWT with legacy secret** (or "Enforce JWT
   verification"): **ON** for `ingest-tokens`, **OFF** for `ingest-steps`. Save.

The functions are then reachable at
`https://qxjeaoxujpyafksxzqak.supabase.co/functions/v1/<name>`, the same origin the app already
uses, so the CSP does not change.

## Testing `ingest-steps` before deploying
The body parser is plain TypeScript and runs on Node 23.6+ without any packages:
`node tests/ingest-steps.node.mjs` (fake data only). The HTTP checks against the deployed
function are in `docs/security-tests.md`, section 6c.

## Logs
Dashboard → Edge Functions → `ingest-steps` → **Logs**. Requests rejected before the token
check (no or malformed token, wrong method or content type, too large) log nothing. Every other
request logs one line,
`ingest-steps outcome=<ok|unauthorized|rate_limited|invalid|invalid_body> token=<first 8 characters>`.
Nothing else: no token, body, dates or step values. If you ever see more, stop and report it.

## Updating a function
Edit the file in the repo first (reviewed like any code change), then paste the new version into
the dashboard editor and deploy. Keep the dashboard and the repo identical.

## If a function returns 503
The functions call the database with `SUPABASE_SERVICE_ROLE_KEY`. On projects that use only the
new API keys (publishable/secret) this variable may be missing or not accepted. Tell Claude the
status code (never the key) instead of pasting keys into the code.
