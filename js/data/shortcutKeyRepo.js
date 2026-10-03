// Talks to the `shortcut-key` Edge Function for the signed-in user (the SDK sends the session).
// The Shortcut key itself is returned only once, by createShortcutKey(); the app shows it on
// screen for copying and never stores it anywhere (CLAUDE.md §2.1 exception).

import { getSupabase } from '../supabaseClient.js';

const FN = 'shortcut-key';
const HINT_RE = /^[A-Za-z0-9_-]{4}$/;
const KEY_RE = /^rs_[A-Za-z0-9_-]{43}$/;

const isoOrNull = (v) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null);

/** @returns {Promise<{hasKey: boolean, hint?: string, createdAt?: string|null, lastUsedAt?: string|null}|null>} */
export async function getShortcutKeyStatus() {
  try {
    const { data, error } = await getSupabase().functions.invoke(FN, { method: 'GET' });
    if (error || !data || typeof data.hasKey !== 'boolean') return null;
    if (!data.hasKey) return { hasKey: false };
    return {
      hasKey: true,
      hint: HINT_RE.test(data.hint) ? data.hint : '????',
      createdAt: isoOrNull(data.createdAt),
      lastUsedAt: isoOrNull(data.lastUsedAt),
    };
  } catch {
    return null;
  }
}

/** Creates or replaces the key. @returns {Promise<string|null>} the new key, shown once */
export async function createShortcutKey() {
  try {
    const { data, error } = await getSupabase().functions.invoke(FN, { method: 'POST' });
    if (error || !data || !KEY_RE.test(data.key)) return null;
    return data.key;
  } catch {
    return null;
  }
}

/** @returns {Promise<boolean>} */
export async function revokeShortcutKey() {
  try {
    const { data, error } = await getSupabase().functions.invoke(FN, { method: 'DELETE' });
    return !error && Boolean(data && data.ok);
  } catch {
    return false;
  }
}
