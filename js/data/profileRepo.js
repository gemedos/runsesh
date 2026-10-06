// Reads and writes the signed-in user's own row in public.profiles.
// RLS guarantees a user can only ever see/update their own row; the filters below are
// for clarity, not for security.

import { validateAvatar } from '../avatar/avatar.js';
import { cleanDisplayName, isTimezone } from '../auth/rules.js';
import { getSupabase } from '../supabaseClient.js';

const COLUMNS = 'id, display_name, avatar, timezone, created_at';

function toProfile(row) {
  return Object.freeze({
    id: row.id,
    displayName: typeof row.display_name === 'string' ? row.display_name : null,
    // Validated again on the way in: never trust stored data blindly.
    avatar: validateAvatar(row.avatar),
    timezone: isTimezone(row.timezone) ? row.timezone : 'UTC',
    joinedAt: typeof row.created_at === 'string' && !Number.isNaN(Date.parse(row.created_at)) ? row.created_at : null,
  });
}

/**
 * Another player's profile (name, avatar, join date). RLS only returns it for members of the
 * caller's party; anyone else gives null.
 */
export async function fetchMemberProfile(userId) {
  const { data, error } = await getSupabase().from('profiles').select('id, display_name, avatar, created_at').eq('id', userId).maybeSingle();
  if (error || !data) return null;
  return toProfile({ ...data, timezone: 'UTC' });
}

export async function fetchOwnProfile(userId) {
  const { data, error } = await getSupabase().from('profiles').select(COLUMNS).eq('id', userId).maybeSingle();
  if (error || !data) return null;
  return toProfile(data);
}

/**
 * Updates editable columns of the user's own profile.
 * @param {string} userId
 * @param {{ displayName?: string, avatar?: object, timezone?: string }} patch already validated by the caller
 * @returns {Promise<object|null>} the updated profile, or null if the server rejected it
 */
export async function updateOwnProfile(userId, patch) {
  const row = {};
  if ('displayName' in patch) {
    const name = cleanDisplayName(patch.displayName);
    if (!name) return null;
    row.display_name = name;
  }
  if ('avatar' in patch) {
    const avatar = validateAvatar(patch.avatar);
    if (!avatar) return null;
    row.avatar = avatar;
  }
  if ('timezone' in patch) {
    if (!isTimezone(patch.timezone)) return null;
    row.timezone = patch.timezone;
  }
  const { data, error } = await getSupabase().from('profiles').update(row).eq('id', userId).select(COLUMNS).maybeSingle();
  if (error || !data) return null;
  return toProfile(data);
}
