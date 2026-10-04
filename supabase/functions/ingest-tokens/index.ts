// Edge Function: ingest-tokens  (CLAUDE.md "Health data ingest tokens", approved 2026-10-04)
//
// Called by the runsesh web app for the SIGNED-IN user. Keep "Verify JWT" ON for this function.
//   POST { "platform": "android" | "ios" }
//     200 { token, id, platform, hint, createdAt }   the token is returned ONCE, never again
//     400 invalid | 401 unauthorized | 409 { error: 'limit' } (already 2 tokens) | 503 unavailable
//
// Listing and revoking need no function: the app reads (without the hash) and deletes its own
// rows in public.ingest_tokens directly, protected by RLS.
//
// Token format: `<token id (uuid)>.<secret>`; the secret is 32 bytes from crypto.getRandomValues,
// base64url (43 characters). Only the SHA-256 hash of the secret is stored. The token is never
// logged, stored in plain text, or put in a URL.
// Uses the service-role key that Supabase injects into its own functions (never in the repo).
// No packages: plain fetch + Web Crypto.

const ALLOWED_ORIGINS = new Set(['https://gemedos.github.io', 'http://localhost:8080']);
const PLATFORMS = new Set(['android', 'ios']);
const MAX_BODY_BYTES = 256;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** Headers for database calls as the service role (works with legacy JWT and new secret keys). */
function serviceHeaders(): Record<string, string> {
  const h: Record<string, string> = { apikey: SERVICE_KEY, 'Content-Type': 'application/json' };
  if (SERVICE_KEY.startsWith('eyJ')) h.Authorization = `Bearer ${SERVICE_KEY}`;
  return h;
}

/** The signed-in user's id, checked by Supabase Auth; null if the session is not valid. */
async function getUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') ?? '';
  if (!/^Bearer [A-Za-z0-9._-]+$/.test(auth)) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: auth, apikey: ANON_KEY } });
  if (!res.ok) return null;
  const user = await res.json().catch(() => null);
  return user && typeof user.id === 'string' && /^[0-9a-f-]{36}$/.test(user.id) ? user.id : null;
}

function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin);
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) return json({ error: 'unavailable' }, 503, origin);

  try {
    const userId = await getUserId(req);
    if (!userId) return json({ error: 'unauthorized' }, 401, origin);

    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return json({ error: 'invalid' }, 400, origin);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: 'invalid' }, 400, origin);
    }
    const platform = (body as { platform?: unknown } | null)?.platform;
    if (typeof platform !== 'string' || !PLATFORMS.has(platform)) return json({ error: 'invalid' }, 400, origin);

    const id = crypto.randomUUID();
    const secret = base64url(crypto.getRandomValues(new Uint8Array(32)));
    const hint = secret.slice(-4);

    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_ingest_token`, {
      method: 'POST',
      headers: serviceHeaders(),
      body: JSON.stringify({
        p_id: id,
        p_user_id: userId,
        p_platform: platform,
        p_secret_hash: await sha256Hex(secret),
        p_secret_hint: hint,
      }),
    });
    if (!res.ok) return json({ error: 'unavailable' }, 503, origin);
    const result = await res.json();
    if (result === 'limit') return json({ error: 'limit' }, 409, origin);
    if (result !== 'ok') return json({ error: 'invalid' }, 400, origin);

    return json({ token: `${id}.${secret}`, id, platform, hint, createdAt: new Date().toISOString() }, 200, origin);
  } catch {
    // Never log request details, tokens or user data.
    return json({ error: 'unavailable' }, 503, origin);
  }
});
