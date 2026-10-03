// Edge Function: ingest-steps  (CLAUDE.md §2.1 exception, approved 2026-10-04)
//
// Called by the user's Apple Shortcut. Turn "Verify JWT" OFF for this function only: the
// Shortcut has no Supabase session; its personal Shortcut key is the authentication.
//
//   POST  Authorization: Bearer rs_…     Content-Type: application/json
//         body: { "day": "YYYY-MM-DD", "steps": 1234 }
//   200 { ok: true } | 400 { error: 'invalid' } | 401 { error: 'unauthorized' }
//   405 method not allowed | 413 too large | 429 { error: 'rate_limited' } | 503 unavailable
//
// The key can only write its owner's own daily_steps row (source 'shortcut') for the allowed
// days; the owner comes from the key, never from the request. Nothing is logged.
// No CORS: no browser calls this function.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const KEY_RE = /^Bearer (rs_[A-Za-z0-9_-]{43})$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BODY_BYTES = 1024;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function serviceHeaders(): Record<string, string> {
  const h: Record<string, string> = { apikey: SERVICE_KEY, 'Content-Type': 'application/json' };
  if (SERVICE_KEY.startsWith('eyJ')) h.Authorization = `Bearer ${SERVICE_KEY}`;
  return h;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function isRealDate(day: string): boolean {
  if (!DAY_RE.test(day)) return false;
  const d = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'unavailable' }, 503);

  const match = KEY_RE.exec(req.headers.get('Authorization') ?? '');
  if (!match) return json({ error: 'unauthorized' }, 401);

  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return json({ error: 'too_large' }, 413);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: 'invalid' }, 400);
    }
    const { day, steps } = (body ?? {}) as { day?: unknown; steps?: unknown };
    if (typeof day !== 'string' || !isRealDate(day)) return json({ error: 'invalid' }, 400);
    if (typeof steps !== 'number' || !Number.isInteger(steps) || steps < 0 || steps > 100000) {
      return json({ error: 'invalid' }, 400);
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ingest_shortcut_steps`, {
      method: 'POST',
      headers: serviceHeaders(),
      body: JSON.stringify({ p_key_hash: await sha256Hex(match[1]), p_day: day, p_steps: steps }),
    });
    if (!res.ok) return json({ error: 'unavailable' }, 503);
    const result = await res.json();
    if (result === 'ok') return json({ ok: true }, 200);
    if (result === 'unknown_key') return json({ error: 'unauthorized' }, 401);
    if (result === 'rate_limited') return json({ error: 'rate_limited' }, 429);
    return json({ error: 'invalid' }, 400);
  } catch {
    // Never log the key, the steps or the user.
    return json({ error: 'unavailable' }, 503);
  }
});
