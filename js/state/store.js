// App state. Rendering code only uses getState / subscribe / the action helpers.
//
// Everything comes from Supabase and lives in memory only (nothing in localStorage):
// - the signed-in user (id, email) and their profile (display name, avatar, timezone);
// - their party (if any), their role, the members, the active competition, past
//   competitions and their frozen results.
// Access rules are enforced by the database (RLS + functions); this module only reflects them.

import { DEFAULT_AVATAR, validateAvatar } from '../avatar/avatar.js';
import { fetchCompetitions, fetchResults, finalizeDue } from '../data/competitionRepo.js';
import { fetchMyParty } from '../data/partyRepo.js';
import { updateOwnProfile } from '../data/profileRepo.js';

// Local data from Phase 1 (mock competitions etc.) is obsolete; remove it once.
try { localStorage.removeItem('runsesh.local.v1'); } catch { /* ignore */ }

let state = createInitialState();
const listeners = new Set();
let partyLoad = null;

function createInitialState() {
  return Object.freeze({
    auth: null, // { userId, email } while signed in
    profile: null, // { id, displayName, avatar, timezone } from public.profiles
    avatar: DEFAULT_AVATAR, // the signed-in user's avatar
    partyStatus: 'idle', // 'idle' | 'loading' | 'ready' | 'error'
    party: null, // { id, name, stepScoring } or null when in no party
    myRole: null, // 'leader' | 'member' | null
    members: Object.freeze([]), // { id, name, avatar, role, joinedAt }
    competition: null, // the active competition, or null
    history: Object.freeze([]), // finished competitions, newest first
    results: Object.freeze({}), // finished competition id -> frozen standings
  });
}

export function getState() {
  return state;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setState(patch) {
  state = Object.freeze({ ...state, ...patch });
  for (const listener of listeners) listener(state);
}

// ---------------------------------------------------------------------------
// Auth / profile
// ---------------------------------------------------------------------------

/** Called by the auth module after sign-in / session restore. */
export function setSignedIn(user, profile) {
  setState({
    auth: Object.freeze({ userId: user.id, email: user.email || '' }),
    profile,
    avatar: (profile && profile.avatar) || DEFAULT_AVATAR,
  });
  refreshParty();
}

export function setProfile(profile) {
  setState({ profile, avatar: (profile && profile.avatar) || DEFAULT_AVATAR });
}

/** In-memory reset after sign-out (local storage is wiped separately). */
export function resetState() {
  state = createInitialState();
  for (const listener of listeners) listener(state);
}

/**
 * Validates in the browser, then saves to the user's own profile row.
 * If the database rejects it, the previous avatar stays.
 * @returns {Promise<boolean>}
 */
export async function saveAvatar(input) {
  const avatar = validateAvatar(input);
  if (!avatar || !state.auth) return false;
  try {
    const profile = await updateOwnProfile(state.auth.userId, { avatar });
    if (!profile) return false;
    setProfile(profile);
    refreshParty(); // the member list shows the new avatar
    return true;
  } catch {
    return false;
  }
}

/** @returns {Promise<boolean>} */
export async function saveDisplayName(name) {
  if (!state.auth) return false;
  try {
    const profile = await updateOwnProfile(state.auth.userId, { displayName: name });
    if (!profile) return false;
    setProfile(profile);
    refreshParty();
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Party and competitions (reloaded after every change)
// ---------------------------------------------------------------------------

/** Reloads party, members and competitions from the server. Concurrent calls share one load. */
export function refreshParty() {
  if (!state.auth) return Promise.resolve();
  if (partyLoad) return partyLoad;
  const userId = state.auth.userId;
  if (state.partyStatus === 'idle') setState({ partyStatus: 'loading' });
  partyLoad = (async () => {
    try {
      await finalizeDue();
      const mine = await fetchMyParty(userId);
      if (!state.auth || state.auth.userId !== userId) return;
      if (!mine) {
        setState({ partyStatus: 'ready', party: null, myRole: null, members: Object.freeze([]), competition: null, history: Object.freeze([]), results: Object.freeze({}) });
        return;
      }
      const { active, history } = await fetchCompetitions(mine.party.id);
      const results = await fetchResults(history.map((c) => c.id));
      if (!state.auth || state.auth.userId !== userId) return;
      setState({
        partyStatus: 'ready',
        party: mine.party,
        myRole: mine.myRole,
        members: mine.members,
        competition: active,
        history: Object.freeze(history),
        results: Object.freeze(results),
      });
    } catch {
      setState({ partyStatus: 'error' });
    } finally {
      partyLoad = null;
    }
  })();
  return partyLoad;
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function isLeader(s = state) {
  return s.myRole === 'leader';
}

/** Party members for display ("me" uses the freshest avatar and name). */
export function getPartyMembers(s = state) {
  const me = s.auth ? s.auth.userId : null;
  return s.members.map((m) => ({
    id: m.id,
    name: m.id === me ? (s.profile && s.profile.displayName) || m.name : m.name,
    role: m.role,
    isMe: m.id === me,
    avatar: m.id === me ? s.avatar : m.avatar || DEFAULT_AVATAR,
  }));
}

export function getLeader(s = state) {
  return getPartyMembers(s).find((m) => m.role === 'leader') || null;
}
