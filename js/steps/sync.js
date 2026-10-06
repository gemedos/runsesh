// Takes values from a StepsSource, validates them, and upserts the valid ones into
// public.daily_steps for the signed-in user. Never trusts values blindly, even from our
// own sources. The database re-checks everything (constraints + window trigger + RLS).

import { getSupabase } from '../supabaseClient.js';
import { addDays, isISODate, toISODate } from '../util/date.js';

export const STEPS_MAX = 100000;
export const ALLOWED_SOURCES = Object.freeze(['manual', 'health_connect', 'shortcut']);
// Same window as the database trigger: from 3 days before today (UTC) to 1 day after.
const DAYS_BACK = 3;
const DAYS_AHEAD = 1;

function utcToday(now = new Date()) {
  return toISODate(new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Pure check, exported for tests. */
export function isValidEntry(entry, now = new Date()) {
  if (!entry || typeof entry !== 'object') return false;
  const { day, steps } = entry;
  if (!Number.isInteger(steps) || steps < 0 || steps > STEPS_MAX) return false;
  if (!isISODate(day)) return false;
  const today = utcToday(now);
  return day >= addDays(today, -DAYS_BACK) && day <= addDays(today, DAYS_AHEAD);
}

/**
 * @param {import('./stepsSource.js').StepsSource} source
 * @param {string} userId the signed-in user's id (RLS rejects any other id anyway)
 * @param {string} fromDay
 * @param {string} toDay
 * @returns {Promise<{ ok: boolean, saved: number, discarded: number }>}
 */
export async function syncFromSource(source, userId, fromDay, toDay) {
  if (!ALLOWED_SOURCES.includes(source.id) || typeof userId !== 'string') return { ok: false, saved: 0, discarded: 0 };
  let values;
  try {
    values = await source.fetchDays(fromDay, toDay);
  } catch {
    return { ok: false, saved: 0, discarded: 0 };
  }
  const list = Array.isArray(values) ? values : [];
  const seen = new Set();
  const rows = [];
  for (const entry of list) {
    if (!isValidEntry(entry) || seen.has(entry.day)) continue;
    seen.add(entry.day);
    rows.push({ user_id: userId, day: entry.day, steps: entry.steps, source: source.id });
  }
  const discarded = list.length - rows.length;
  if (!rows.length) return { ok: discarded === 0, saved: 0, discarded };

  const { error } = await getSupabase().from('daily_steps').upsert(rows, { onConflict: 'user_id,day' });
  if (error) return { ok: false, saved: 0, discarded };
  return { ok: discarded === 0, saved: rows.length, discarded };
}

/**
 * One day for several players (the caller and their party members; RLS decides), with when
 * each total was last updated. @returns {Promise<Map<string, {steps, updatedAt}>|null>}
 */
export async function fetchDayForUsers(userIds, day) {
  if (!userIds.length) return new Map();
  const { data, error } = await getSupabase()
    .from('daily_steps')
    .select('user_id, steps, updated_at')
    .eq('day', day)
    .in('user_id', userIds);
  if (error || !Array.isArray(data)) return null;
  return new Map(data.filter((r) => Number.isInteger(r.steps)).map((r) => [r.user_id, { steps: r.steps, updatedAt: r.updated_at }]));
}

/** Saved days of the signed-in user, or of a member of their party (RLS decides), newest first. */
export async function fetchStepHistory(userId, fromDay, toDay) {
  const { data, error } = await getSupabase()
    .from('daily_steps')
    .select('day, steps, source')
    .eq('user_id', userId)
    .gte('day', fromDay)
    .lte('day', toDay)
    .order('day', { ascending: false });
  if (error || !Array.isArray(data)) return null;
  return data.filter((r) => isISODate(r.day) && Number.isInteger(r.steps));
}
