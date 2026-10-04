// Personal ingest tokens (CLAUDE.md "Health data ingest tokens", approved 2026-10-04).
//
// Listing and revoking go straight to public.ingest_tokens: RLS limits both to the user's own
// rows, and the column grants never let the app read the secret's hash.
// Creating goes through the `ingest-tokens` Edge Function (the SDK sends the session). The token
// it returns is shown once on screen for copying and is never stored or logged by the app.

import { getSupabase } from '../supabaseClient.js';

export const MAX_TOKENS = 2;
export const PLATFORMS = ['android', 'ios'];
export const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/;
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HINT_RE = /^[A-Za-z0-9_-]{4}$/;

const isoOrNull = (v) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null);

/** Keeps only well-formed rows. Exported for tests. */
export function cleanTokenRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r && ID_RE.test(r.id) && PLATFORMS.includes(r.platform))
    .map((r) => ({
      id: r.id,
      platform: r.platform,
      hint: HINT_RE.test(r.secret_hint) ? r.secret_hint : '????',
      createdAt: isoOrNull(r.created_at),
      lastUsedAt: isoOrNull(r.last_used_at),
    }));
}

/** @returns {Promise<{id, platform, hint, createdAt, lastUsedAt}[] | null>} all of the user's tokens; null on errors */
export async function listIngestTokens() {
  try {
    const { data, error } = await getSupabase()
      .from('ingest_tokens')
      .select('id, platform, secret_hint, created_at, last_used_at')
      .order('created_at');
    return error ? null : cleanTokenRows(data);
  } catch {
    return null;
  }
}

/**
 * @param {'android'|'ios'} platform
 * @returns {Promise<{token: string} | {error: 'limit'|'failed'}>} the token is shown once
 */
export async function createIngestToken(platform) {
  if (!PLATFORMS.includes(platform)) return { error: 'failed' };
  try {
    const { data, error } = await getSupabase().functions.invoke('ingest-tokens', { body: { platform } });
    if (error) return { error: error.context && error.context.status === 409 ? 'limit' : 'failed' };
    return data && TOKEN_RE.test(data.token) ? { token: data.token } : { error: 'failed' };
  } catch {
    return { error: 'failed' };
  }
}

/** @returns {Promise<boolean>} */
export async function revokeIngestToken(id) {
  if (!ID_RE.test(id)) return false;
  try {
    const { error, count } = await getSupabase().from('ingest_tokens').delete({ count: 'exact' }).eq('id', id);
    return !error && count === 1;
  } catch {
    return false;
  }
}
