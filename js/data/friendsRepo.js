// Friends (supabase/migrations/20261008120100_friends.sql). Every change goes through database
// functions that take the caller from the session; the app only passes usertags. Search and
// invite lists return ONLY usertags; the friends list returns name and avatar too (friends may
// see each other). Rate limits and visibility are enforced by the database.

import { validateAvatar } from '../avatar/avatar.js';
import { cleanHandle, HANDLE_RE } from '../auth/rules.js';
import { getSupabase } from '../supabaseClient.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const STATUSES = new Set(['sent', 'accepted', 'already_friends', 'already_sent', 'not_found', 'self', 'rate_limited', 'invalid', 'declined', 'cancelled', 'removed']);

let friendsCache = null; // in memory only; cleared after every change

async function rpcStatus(name, args) {
  try {
    const { data, error } = await getSupabase().rpc(name, args);
    return !error && STATUSES.has(data) ? data : 'failed';
  } catch {
    return 'failed';
  }
}

/** @returns {Promise<{status: 'ok'|'invalid'|'rate_limited'|'failed', handles: string[]}>} */
export async function searchUsertags(prefix) {
  const q = typeof prefix === 'string' ? prefix.trim().replace(/^@/, '').toLowerCase() : '';
  if (!/^[a-z0-9._]{2,20}$/.test(q)) return { status: 'invalid', handles: [] };
  try {
    const { data, error } = await getSupabase().rpc('search_usertags', { p_prefix: q });
    if (error || !data || typeof data.status !== 'string') return { status: 'failed', handles: [] };
    const handles = Array.isArray(data.handles) ? data.handles.filter((x) => typeof x === 'string' && HANDLE_RE.test(x)).slice(0, 10) : [];
    return { status: ['ok', 'invalid', 'rate_limited'].includes(data.status) ? data.status : 'failed', handles };
  } catch {
    return { status: 'failed', handles: [] };
  }
}

const withHandle = (handle, fn) => {
  const clean = cleanHandle(handle);
  if (!clean) return Promise.resolve('invalid');
  friendsCache = null;
  return fn(clean);
};

export const sendFriendInvite = (handle) => withHandle(handle, (h) => rpcStatus('send_friend_invite', { p_handle: h }));
export const respondFriendInvite = (handle, accept) => withHandle(handle, (h) => rpcStatus('respond_friend_invite', { p_handle: h, p_accept: Boolean(accept) }));
export const cancelFriendInvite = (handle) => withHandle(handle, (h) => rpcStatus('cancel_friend_invite', { p_handle: h }));
export const removeFriend = (handle) => withHandle(handle, (h) => rpcStatus('remove_friend', { p_handle: h }));

/** @returns {Promise<{handle: string, direction: 'in'|'out'}[]|null>} pending invites */
export async function fetchFriendRequests() {
  try {
    const { data, error } = await getSupabase().rpc('my_friend_requests');
    if (error || !Array.isArray(data)) return null;
    return data
      .filter((r) => r && HANDLE_RE.test(r.handle) && (r.direction === 'in' || r.direction === 'out'))
      .map((r) => ({ handle: r.handle, direction: r.direction }));
  } catch {
    return null;
  }
}

/** @returns {Promise<{id, handle, name, avatar}[]|null>} the caller's friends (cached in memory) */
export async function fetchFriends({ refresh = false } = {}) {
  if (friendsCache && !refresh) return friendsCache;
  try {
    const { data, error } = await getSupabase().rpc('my_friends');
    if (error || !Array.isArray(data)) return null;
    friendsCache = Object.freeze(data
      .filter((r) => r && UUID_RE.test(r.id) && HANDLE_RE.test(r.handle))
      .map((r) => Object.freeze({
        id: r.id,
        handle: r.handle,
        name: typeof r.display_name === 'string' ? r.display_name : null,
        avatar: validateAvatar(r.avatar),
      })));
    return friendsCache;
  } catch {
    return null;
  }
}

export function clearFriendsCache() {
  friendsCache = null;
}

/**
 * Daily totals of several players (the caller, party members, friends; RLS decides) for a range.
 * @returns {Promise<Map<string, Map<string, number>>|null>} user id -> (day -> steps)
 */
export async function fetchStepsForUsers(userIds, fromDay, toDay) {
  const ids = userIds.filter((id) => UUID_RE.test(id));
  if (!ids.length) return new Map();
  try {
    const { data, error } = await getSupabase()
      .from('daily_steps')
      .select('user_id, day, steps')
      .in('user_id', ids)
      .gte('day', fromDay)
      .lte('day', toDay);
    if (error || !Array.isArray(data)) return null;
    const out = new Map(ids.map((id) => [id, new Map()]));
    for (const r of data) if (out.has(r.user_id) && Number.isInteger(r.steps)) out.get(r.user_id).set(r.day, r.steps);
    return out;
  } catch {
    return null;
  }
}
