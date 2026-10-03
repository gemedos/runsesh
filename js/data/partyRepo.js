// Party data: the caller's party, members, invites. Membership changes go through the
// database functions (supabase/migrations/20261005120100_*), which check roles themselves;
// RLS limits every read to the caller's own party. The UI hiding buttons is not security.

import { validateAvatar } from '../avatar/avatar.js';
import { getSupabase } from '../supabaseClient.js';

export const INVITE_CODE_RE = /^[A-Za-z0-9_-]{24}$/;
export const PARTY_NAME_MIN = 2;
export const PARTY_NAME_MAX = 30;
const KNOWN_ERRORS = ['already_in_party', 'not_in_party', 'invalid_name', 'not_leader', 'invalid_member', 'too_many_invites'];

/** Maps a database error to one of our short codes (or 'error'). Never exposes details. */
function errorCode(error) {
  const msg = (error && error.message) || '';
  return KNOWN_ERRORS.find((code) => msg.includes(code)) || 'error';
}

export function cleanPartyName(name) {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  return trimmed.length >= PARTY_NAME_MIN && trimmed.length <= PARTY_NAME_MAX ? trimmed : null;
}

/**
 * @returns {Promise<null | { party: {id, name, stepScoring}, myRole: 'leader'|'member',
 *   members: {id, name, avatar, role, joinedAt}[] }>} null when the user is in no party
 * @throws on network/database errors (callers show a generic message)
 */
export async function fetchMyParty(userId) {
  const sb = getSupabase();
  const { data: me, error: meError } = await sb.from('party_members').select('party_id, role').eq('user_id', userId).maybeSingle();
  if (meError) throw new Error('party');
  if (!me) return null;

  const [partyRes, membersRes] = await Promise.all([
    sb.from('parties').select('id, name, step_scoring').eq('id', me.party_id).maybeSingle(),
    sb.from('party_members').select('user_id, role, joined_at').eq('party_id', me.party_id).order('joined_at'),
  ]);
  if (partyRes.error || !partyRes.data || membersRes.error) throw new Error('party');

  const ids = membersRes.data.map((m) => m.user_id);
  const { data: profiles, error: profError } = await sb.from('profiles').select('id, display_name, avatar').in('id', ids);
  if (profError) throw new Error('party');
  const byId = new Map((profiles || []).map((p) => [p.id, p]));

  return {
    party: Object.freeze({
      id: partyRes.data.id,
      name: partyRes.data.name,
      stepScoring: partyRes.data.step_scoring,
    }),
    myRole: me.role === 'leader' ? 'leader' : 'member',
    members: Object.freeze(membersRes.data.map((m) => {
      const p = byId.get(m.user_id) || {};
      return Object.freeze({
        id: m.user_id,
        name: typeof p.display_name === 'string' ? p.display_name : null,
        avatar: validateAvatar(p.avatar), // validated again; null -> default avatar
        role: m.role === 'leader' ? 'leader' : 'member',
        joinedAt: m.joined_at,
      });
    })),
  };
}

async function rpc(name, args) {
  try {
    const { data, error } = await getSupabase().rpc(name, args);
    if (error) return { ok: false, code: errorCode(error) };
    return { ok: true, data };
  } catch {
    return { ok: false, code: 'error' };
  }
}

export const createParty = (name) => rpc('create_party', { p_name: name });
export const leaveParty = () => rpc('leave_party');
export const kickMember = (userId) => rpc('kick_member', { p_user: userId });
export const revokeMyInvites = () => rpc('revoke_my_invites');
export const expireAllInvites = () => rpc('expire_all_invites');

/** @returns {Promise<{ok: boolean, code?: string, data?: string}>} data = the invite code (shown once) */
export async function createInvite() {
  const res = await rpc('create_invite');
  if (res.ok && !INVITE_CODE_RE.test(res.data)) return { ok: false, code: 'error' };
  return res;
}

/** @returns {Promise<{partyName: string, memberCount: number, leaderName: string|null}|null>} */
export async function previewInvite(code) {
  if (!INVITE_CODE_RE.test(code)) return null;
  const res = await rpc('preview_invite', { p_code: code });
  const row = res.ok && Array.isArray(res.data) ? res.data[0] : null;
  if (!row || typeof row.party_name !== 'string') return null;
  return {
    partyName: row.party_name,
    memberCount: Number.isInteger(row.member_count) ? row.member_count : 0,
    leaderName: typeof row.leader_name === 'string' ? row.leader_name : null,
  };
}

const JOIN_RESULTS = ['ok', 'invalid_invite', 'already_in_party', 'party_full', 'rate_limited'];

/** @returns {Promise<'ok'|'invalid_invite'|'already_in_party'|'party_full'|'rate_limited'|'error'>} */
export async function joinParty(code) {
  if (!INVITE_CODE_RE.test(code)) return 'invalid_invite';
  const res = await rpc('join_party', { p_code: code });
  return res.ok && JOIN_RESULTS.includes(res.data) ? res.data : 'error';
}

/** Number of the caller's own invite links that still work. */
export async function countMyActiveInvites(userId) {
  try {
    const { data, error } = await getSupabase()
      .from('party_invites')
      .select('uses, max_uses, expires_at, revoked_at')
      .eq('created_by', userId)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString());
    if (error || !Array.isArray(data)) return null;
    return data.filter((r) => r.uses < r.max_uses).length;
  } catch {
    return null;
  }
}

/** Leader only (RLS enforces it): rename and/or change the step-scoring rule. */
export async function updateParty(partyId, patch) {
  const row = {};
  if ('name' in patch) {
    const name = cleanPartyName(patch.name);
    if (!name) return false;
    row.name = name;
  }
  if ('stepScoring' in patch) {
    if (!['plain', 'elevation_bonus'].includes(patch.stepScoring)) return false;
    row.step_scoring = patch.stepScoring;
  }
  try {
    const { data, error } = await getSupabase().from('parties').update(row).eq('id', partyId).select('id');
    return !error && Array.isArray(data) && data.length === 1;
  } catch {
    return false;
  }
}

/** Full link to share. The code goes after '#' only (CLAUDE.md invite-code exception). */
export function inviteLink(baseUrl, code) {
  return `${new URL('./', baseUrl).href}#/join/${code}`;
}
