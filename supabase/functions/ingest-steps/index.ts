// Edge Function: ingest-steps  (CLAUDE.md "Health data ingest tokens", approved 2026-10-04)
//
// Called by the user's phone, never by a browser. Turn "Verify JWT" OFF for this function only:
// the phone has no Supabase session; its personal ingest token is the authentication.
//
//   POST  Authorization: Bearer <token id>.<secret>      Content-Type: application/json
//   Accepted bodies (at most 16 KB):
//     { "day": "YYYY-MM-DD", "steps": 1234 }                        iPhone Shortcut / generic
//     { "days": [{ "day": "YYYY-MM-DD", "steps": 1234 }, ...] }     generic, up to 3 days
//       (generic: any invalid item, or a day outside the allowed window, rejects everything)
//     Life Dashboard Companion payload: only `daily_totals[].date` and `.steps` are read;
//       raw records, distance, diagnostics and everything else are ignored, never stored or logged.
//       A payload without `daily_totals` (heartbeat, option off) is accepted and writes nothing.
//   200 { ok: true, days: n } | 400 { error: 'invalid' } | 401 { error: 'unauthorized' }
//   405 method not allowed | 413 too large | 415 not JSON | 429 { error: 'rate_limited' } | 503 unavailable
//
// Every authentication failure (missing, malformed, unknown or revoked token, wrong secret) gets
// the identical 401. The token can only write its owner's own daily_steps (source by platform)
// for the allowed days; the owner comes from the token, never from the request.
// Logs: only the outcome and the first 8 characters of the token id. Never the token, the body,
// step values or dates. No CORS: no browser calls this function.

const inDeno = typeof Deno !== 'undefined';
const SUPABASE_URL = inDeno ? Deno.env.get('SUPABASE_URL') ?? '' : '';
const SERVICE_KEY = inDeno ? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' : '';

export const MAX_BODY_BYTES = 16 * 1024;
const MAX_DAYS = 3;
const MAX_DAILY_TOTALS = 60; // a backfill carries one entry per day of its window
const TOKEN_RE = /^bearer ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export type Day = { day: string; steps: number };
/** `days` to write, or `null` when the body is not acceptable (400). */
export type Parsed = { days: Day[] } | null;

export function isRealDate(day: unknown): day is string {
  if (typeof day !== 'string' || !DAY_RE.test(day)) return false;
  const d = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day;
}

export function isSteps(steps: unknown): steps is number {
  return typeof steps === 'number' && Number.isInteger(steps) && steps >= 0 && steps <= 100000;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Life Dashboard Companion: read only `daily_totals[].date` / `.steps` (format from the app's
 * docs/webhook.md, "Daily totals"). Every entry must be well-formed; an entry without `steps`
 * (Steps not enabled in the app) is skipped. A backfill can carry many days: keep the 3 newest
 * inside the database's window (UTC today - 3 .. today + 1).
 */
function parseLifeDashboard(body: Record<string, unknown>, todayUtc: string): Parsed {
  const totals = body.daily_totals;
  if (totals === undefined) return { days: [] }; // heartbeat or totals switched off
  if (!Array.isArray(totals) || totals.length > MAX_DAILY_TOTALS) return null;

  const byDay = new Map<string, number>();
  for (const entry of totals) {
    if (!isObject(entry) || !isRealDate(entry.date)) return null;
    if (entry.steps === undefined) continue;
    if (!isSteps(entry.steps)) return null;
    if (byDay.has(entry.date)) return null;
    byDay.set(entry.date, entry.steps);
  }

  const from = addDays(todayUtc, -3);
  const to = addDays(todayUtc, 1);
  const days = [...byDay]
    .filter(([day]) => day >= from && day <= to)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, MAX_DAYS)
    .map(([day, steps]) => ({ day, steps }));
  return { days };
}

/** Turns any accepted body into the days to write. Pure; exported for tests. */
export function parseBody(body: unknown, todayUtc: string): Parsed {
  if (!isObject(body)) return null;

  // Life Dashboard Companion envelope: { timestamp, app_version, source: "health_connect", ... }
  if (body.source === 'health_connect' && typeof body.app_version === 'string') {
    return parseLifeDashboard(body, todayUtc);
  }

  // Generic format (iPhone Shortcut and others): strict. A day outside the database's window
  // (UTC today - 3 .. today + 1) rejects the request, so the sender sees the error.
  const from = addDays(todayUtc, -3);
  const to = addDays(todayUtc, 1);
  const inWindow = (day: string) => day >= from && day <= to;

  // Generic: one day.
  if ('day' in body || 'steps' in body) {
    return isRealDate(body.day) && inWindow(body.day) && isSteps(body.steps)
      ? { days: [{ day: body.day, steps: body.steps }] }
      : null;
  }

  // Generic: several days.
  if (Array.isArray(body.days)) {
    if (body.days.length > MAX_DAYS) return null;
    const seen = new Set<string>();
    const days: Day[] = [];
    for (const entry of body.days) {
      if (!isObject(entry) || !isRealDate(entry.day) || !inWindow(entry.day) || !isSteps(entry.steps) || seen.has(entry.day)) return null;
      seen.add(entry.day);
      days.push({ day: entry.day, steps: entry.steps });
    }
    return { days };
  }

  return null;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

const unauthorized = () => json({ error: 'unauthorized' }, 401);

function serviceHeaders(): Record<string, string> {
  const h: Record<string, string> = { apikey: SERVICE_KEY, 'Content-Type': 'application/json' };
  if (SERVICE_KEY.startsWith('eyJ')) h.Authorization = `Bearer ${SERVICE_KEY}`;
  return h;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Reads at most `max` bytes; returns null as soon as the body is larger. */
async function readLimited(req: Request, max: number): Promise<string | null> {
  const declared = Number(req.headers.get('Content-Length') ?? '0');
  if (declared > max) return null;
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error('rpc_failed');
  return res.json();
}

function log(outcome: string, tokenId: string): void {
  console.log(`ingest-steps outcome=${outcome} token=${tokenId.slice(0, 8)}`);
}

async function handle(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'unavailable' }, 503);

  const auth = req.headers.get('Authorization') ?? '';
  const token = TOKEN_RE.exec(auth);
  if (!token) return unauthorized();

  const type = (req.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') return json({ error: 'unsupported_media_type' }, 415);

  let raw: string | null;
  try {
    raw = await readLimited(req, MAX_BODY_BYTES);
  } catch {
    return json({ error: 'invalid' }, 400); // not valid UTF-8, or the upload broke off
  }
  if (raw === null) return json({ error: 'too_large' }, 413);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'invalid' }, 400);
  }
  const todayUtc = new Date().toISOString().slice(0, 10);

  const tokenId = token[1].toLowerCase();
  const parsed = parseBody(body, todayUtc);
  if (!parsed) {
    log('invalid_body', tokenId);
    return json({ error: 'invalid' }, 400);
  }

  // Also called with no days: that still checks the token and counts towards the rate limit.
  const result = await rpc('record_ingest', {
    p_token_id: tokenId,
    p_secret_hash: await sha256Hex(token[2]),
    p_days: parsed.days,
  });
  log(typeof result === 'string' ? result : 'unexpected', tokenId);
  if (result === 'ok') return json({ ok: true, days: parsed.days.length }, 200);
  if (result === 'unauthorized') return unauthorized();
  if (result === 'rate_limited') return json({ error: 'rate_limited' }, 429);
  return json({ error: 'invalid' }, 400);
}

// Only start the server inside Supabase (Deno); the tests import the pure functions above.
if (inDeno) {
  Deno.serve(async (req: Request) => {
    try {
      return await handle(req);
    } catch {
      // Never log the token, the body or the user.
      return json({ error: 'unavailable' }, 503);
    }
  });
}
