// Edge Function: shortcut-key  (CLAUDE.md §2.1 exception, approved 2026-10-04)
//
// Called by the runsesh web app for the SIGNED-IN user. Keep "Verify JWT" ON for this function.
//   GET    -> { hasKey, hint, createdAt, lastUsedAt }   (never the key or its hash)
//   POST   -> creates or replaces the user's key and returns it ONCE: { key, hint, createdAt }
//   DELETE -> revokes the key: { ok: true }
//
// Only the SHA-256 hash is stored. The key is never logged, stored in plain text, or put in a URL.
// Uses the service-role key that Supabase injects into its own functions (never in the repo).
// No packages: plain fetch + Web Crypto.

const ALLOWED_ORIGINS = new Set(['https://gemedos.github.io', 'http://localhost:8080']);

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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

const rest = (path: string) => `${SUPABASE_URL}/rest/v1/${path}`;

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) return json({ error: 'method_not_allowed' }, 405, origin);
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) return json({ error: 'unavailable' }, 503, origin);

  try {
    const userId = await getUserId(req);
    if (!userId) return json({ error: 'unauthorized' }, 401, origin);
    const filter = `user_id=eq.${userId}`;

    if (req.method === 'GET') {
      const res = await fetch(rest(`shortcut_keys?select=key_hint,created_at,last_used_at&${filter}`), { headers: serviceHeaders() });
      if (!res.ok) return json({ error: 'unavailable' }, 503, origin);
      const rows = await res.json();
      const row = Array.isArray(rows) ? rows[0] : null;
      return json(row
        ? { hasKey: true, hint: row.key_hint, createdAt: row.created_at, lastUsedAt: row.last_used_at }
        : { hasKey: false }, 200, origin);
    }

    if (req.method === 'DELETE') {
      const res = await fetch(rest(`shortcut_keys?${filter}`), { method: 'DELETE', headers: serviceHeaders() });
      return res.ok ? json({ ok: true }, 200, origin) : json({ error: 'unavailable' }, 503, origin);
    }

    // POST: create or replace the key (one active key per user).
    const key = `rs_${base64url(crypto.getRandomValues(new Uint8Array(32)))}`;
    const row = {
      user_id: userId,
      key_hash: await sha256Hex(key),
      key_hint: key.slice(-4),
      created_at: new Date().toISOString(),
      last_used_at: null,
      window_start: null,
      uses_in_window: 0,
    };
    const res = await fetch(rest('shortcut_keys?on_conflict=user_id'), {
      method: 'POST',
      headers: { ...serviceHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(row),
    });
    if (!res.ok) return json({ error: 'unavailable' }, 503, origin);
    return json({ key, hint: row.key_hint, createdAt: row.created_at }, 200, origin);
  } catch {
    // Never log request details, keys or user data.
    return json({ error: 'unavailable' }, 503, origin);
  }
});
