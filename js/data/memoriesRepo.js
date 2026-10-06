// Memories: photos of the day (supabase/migrations/20261008120200_memories.sql).
// Posting: re-encode in the browser (util/image.js: JPEG, max 1600 px, no EXIF/GPS) → insert the
// row (the database checks owner, "today" and the 3-per-day limit) → upload the file to exactly
// that row's path (storage only accepts paths of the uploader's own rows). If the upload fails,
// the row is removed again. Reading is decided by RLS: owner, party members and friends.

import { SUPABASE_URL } from '../config.js';
import { getSupabase } from '../supabaseClient.js';
import { prepareImage } from '../util/image.js';

const BUCKET = 'memories';
export const MEMORIES_PER_DAY = 3;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const URL_TTL_SECONDS = 3600;

function toMemory(r) {
  if (!r || !UUID_RE.test(r.id) || !UUID_RE.test(r.user_id) || !DAY_RE.test(r.day)) return null;
  if (typeof r.path !== 'string' || !new RegExp(`^${r.user_id}/[0-9a-f-]{36}\\.jpg$`).test(r.path)) return null;
  return Object.freeze({ id: r.id, userId: r.user_id, day: r.day, path: r.path, createdAt: r.created_at });
}

const clean = (rows) => (Array.isArray(rows) ? rows.map(toMemory).filter(Boolean) : []);

/** All memories of one player, newest first (empty if not allowed). @returns {Promise<object[]|null>} */
export async function fetchMemories(userId) {
  if (!UUID_RE.test(userId)) return [];
  try {
    const { data, error } = await getSupabase().from('memories')
      .select('id, user_id, day, path, created_at').eq('user_id', userId)
      .order('day', { ascending: false }).order('created_at', { ascending: false }).limit(300);
    return error ? null : clean(data);
  } catch {
    return null;
  }
}

/** Memories of several players for one day, oldest first. @returns {Promise<object[]|null>} */
export async function fetchMemoriesForDay(userIds, day) {
  const ids = userIds.filter((id) => UUID_RE.test(id));
  if (!ids.length || !DAY_RE.test(day)) return [];
  try {
    const { data, error } = await getSupabase().from('memories')
      .select('id, user_id, day, path, created_at').in('user_id', ids).eq('day', day)
      .order('created_at', { ascending: true });
    return error ? null : clean(data);
  } catch {
    return null;
  }
}

/** Short-lived signed URLs for many files at once. @returns {Promise<Map<string, string>>} path -> url */
export async function signedUrls(paths) {
  const out = new Map();
  if (!paths.length) return out;
  try {
    const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrls(paths, URL_TTL_SECONDS);
    if (error || !Array.isArray(data)) return out;
    for (const item of data) {
      const url = item && item.signedUrl;
      if (item && !item.error && typeof url === 'string' && url.startsWith(`${SUPABASE_URL}/storage/v1/`)) out.set(item.path, url);
    }
  } catch { /* shown as unavailable */ }
  return out;
}

/**
 * Posts a photo for `day` (the user's local today).
 * @returns {Promise<{ok: true} | {ok: false, reason: 'type'|'size'|'decode'|'limit'|'failed'}>}
 */
export async function addMemory(userId, file, day) {
  const prepared = await prepareImage(file);
  if (!prepared.ok) return prepared;
  const sb = getSupabase();
  const id = crypto.randomUUID();
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  try {
    const { error: rowError } = await sb.from('memories').insert({ id, user_id: userId, day, path });
    if (rowError) return { ok: false, reason: /memory_limit/.test(rowError.message || '') ? 'limit' : 'failed' };
    const { error: upError } = await sb.storage.from(BUCKET).upload(path, prepared.blob, { contentType: 'image/jpeg', upsert: false });
    if (upError) {
      await sb.from('memories').delete().eq('id', id);
      return { ok: false, reason: 'failed' };
    }
    return { ok: true };
  } catch {
    try { await sb.from('memories').delete().eq('id', id); } catch { /* best effort */ }
    return { ok: false, reason: 'failed' };
  }
}

/** Deletes one of the user's own memories (file first, then the row). @returns {Promise<boolean>} */
export async function deleteMemory(memory) {
  const sb = getSupabase();
  try {
    await sb.storage.from(BUCKET).remove([memory.path]);
    const { error, count } = await sb.from('memories').delete({ count: 'exact' }).eq('id', memory.id);
    return !error && count === 1;
  } catch {
    return false;
  }
}
