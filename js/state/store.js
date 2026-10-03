// Local app state. Rendering code only uses getState / subscribe / the action helpers,
// so a backend-backed store can replace this module later without touching the views.
//
// Persisted in localStorage (Phase 1 only, nothing sensitive): the avatar JSON,
// locally created mock competitions and the party's step-scoring setting.
// Everything read back is validated again.

import { DEFAULT_AVATAR, validateAvatar } from '../avatar/avatar.js';
import { MOCK_ACCOUNT, MOCK_ME_ID, MOCK_MEMBERS, MOCK_PARTY, MOCK_PARTY_RULES, mockDefaultCompetition } from '../data/mockData.js';
import { isStepScoring } from '../rules/ranking.js';
import { STRINGS } from '../strings.js';
import { todayISO } from '../util/date.js';
import { DEFAULT_COMPETITION_THEME, isCompetitionTheme, validateCompetitionInput, validateStoredCompetition } from './competition.js';

const STORAGE_KEY = 'runsesh.local.v1';
const MAX_COMPETITIONS = 20;

let state = createInitialState(loadPersisted());
const listeners = new Set();

function createInitialState(saved) {
  const mockCompetition = mockDefaultCompetition(todayISO());
  const competitions = [mockCompetition, ...saved.competitions];
  const activeId = competitions.some((c) => c.id === saved.activeCompetitionId) ? saved.activeCompetitionId : mockCompetition.id;
  return Object.freeze({
    meId: MOCK_ME_ID,
    account: MOCK_ACCOUNT, // MOCK
    party: MOCK_PARTY, // MOCK
    members: MOCK_MEMBERS, // MOCK
    partyRules: Object.freeze({ ...MOCK_PARTY_RULES, stepScoring: saved.stepScoring || MOCK_PARTY_RULES.stepScoring }), // MOCK
    avatar: saved.avatar,
    competitions: Object.freeze(competitions),
    activeCompetitionId: activeId,
    // Competition id -> visual theme. Only non-default choices are stored.
    competitionThemes: Object.freeze(Object.fromEntries(
      Object.entries(saved.competitionThemes).filter(([id]) => competitions.some((c) => c.id === id)),
    )),
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
  persist();
  for (const listener of listeners) listener(state);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** @returns {boolean} false if the avatar was rejected */
export function saveAvatar(input) {
  const avatar = validateAvatar(input);
  if (!avatar) return false;
  setState({ avatar });
  return true;
}

/** @returns {{ ok: boolean, errors?: object }} */
export function createCompetition(input) {
  const res = validateCompetitionInput(input);
  if (!res.ok) return res;
  const competition = Object.freeze({ id: newLocalId(), ...res.value });
  const userMade = state.competitions.filter((c) => !c.mock);
  if (userMade.length >= MAX_COMPETITIONS) return { ok: false, errors: { form: STRINGS.competition.errors.tooMany(MAX_COMPETITIONS) } };
  setState({
    competitions: Object.freeze([...state.competitions, competition]),
    activeCompetitionId: competition.id,
  });
  return { ok: true };
}

export function setActiveCompetition(id) {
  if (state.competitions.some((c) => c.id === id)) setState({ activeCompetitionId: id });
}

/** Sets a competition's visual theme (local only). @returns {boolean} false if rejected */
export function setCompetitionTheme(id, theme) {
  if (!isCompetitionTheme(theme) || !state.competitions.some((c) => c.id === id)) return false;
  const themes = { ...state.competitionThemes };
  if (theme === DEFAULT_COMPETITION_THEME) delete themes[id];
  else themes[id] = theme;
  setState({ competitionThemes: Object.freeze(themes) });
  return true;
}

/** MOCK: party setting, local only. @returns {boolean} false if the value was rejected */
export function setStepScoring(value) {
  if (!isStepScoring(value)) return false;
  setState({ partyRules: Object.freeze({ ...state.partyRules, stepScoring: value }) });
  return true;
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** Party members with a validated avatar each ("me" uses the editable avatar). */
export function getPartyMembers(s = state) {
  return s.party.memberIds
    .map((id) => s.members.find((m) => m.id === id))
    .filter(Boolean)
    .map((m) => ({
      id: m.id,
      name: m.name,
      isMe: m.id === s.meId,
      avatar: m.id === s.meId ? s.avatar : validateAvatar(m.avatar) || DEFAULT_AVATAR,
    }));
}

export function getActiveCompetition(s = state) {
  return s.competitions.find((c) => c.id === s.activeCompetitionId) || null;
}

export function getCompetitionTheme(competition, s = state) {
  return (competition && s.competitionThemes[competition.id]) || DEFAULT_COMPETITION_THEME;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function loadPersisted() {
  const fallback = { avatar: DEFAULT_AVATAR, competitions: [], activeCompetitionId: null, stepScoring: null, competitionThemes: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || raw.length > 20000) return fallback;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return fallback;
    const competitions = Array.isArray(data.competitions)
      ? data.competitions.slice(0, MAX_COMPETITIONS).map(validateStoredCompetition).filter(Boolean)
      : [];
    return {
      avatar: validateAvatar(data.avatar) || DEFAULT_AVATAR,
      competitions,
      activeCompetitionId: typeof data.activeCompetitionId === 'string' ? data.activeCompetitionId : null,
      stepScoring: isStepScoring(data.stepScoring) ? data.stepScoring : null,
      competitionThemes: readThemes(data.competitionThemes),
    };
  } catch {
    return fallback;
  }
}

/** Keeps only entries with a safe id and a whitelisted theme. */
function readThemes(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [id, theme] of Object.entries(raw).slice(0, MAX_COMPETITIONS + 1)) {
    if (/^[\w-]{1,64}$/.test(id) && isCompetitionTheme(theme)) out[id] = theme;
  }
  return out;
}

function persist() {
  try {
    const data = {
      avatar: state.avatar,
      competitions: state.competitions.filter((c) => !c.mock),
      activeCompetitionId: state.activeCompetitionId,
      stepScoring: state.partyRules.stepScoring,
      competitionThemes: state.competitionThemes,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be unavailable (private mode, quota). The app keeps working in memory.
  }
}

function newLocalId() {
  if (globalThis.crypto && typeof crypto.randomUUID === 'function') return `local-${crypto.randomUUID()}`;
  return `local-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}
