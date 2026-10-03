// ============================================================================
// MOCK DATA (Phase 1 only)
// Everything in this file is fake: invented people, a fake example.com email
// and made-up step profiles. It is replaced by the backend in Phase 2+.
// ============================================================================

import { addDays } from '../util/date.js';

export const MOCK_ME_ID = 'me';

/** MOCK: the signed-in account (no real person, no password). */
export const MOCK_ACCOUNT = Object.freeze({
  name: 'Sam Runner',
  email: 'sam.runner@example.com',
});

/** MOCK: party members. "me" takes its avatar from local state instead. */
export const MOCK_MEMBERS = Object.freeze([
  { id: MOCK_ME_ID, name: 'You' },
  { id: 'mock-alex', name: 'Alex', avatar: { v: 1, skin: '#c68642', hair: 'h_curly', hairColor: 'hc_black', top: 't_jersey', bottom: 'b_shorts', shoes: 's_white', acc: 'a_headband' } },
  { id: 'mock-bea', name: 'Bea', avatar: { v: 1, skin: '#ffdbac', hair: 'h_ponytail', hairColor: 'hc_blonde', top: 't_tank', bottom: 'b_leggings', shoes: 's_runner', acc: 'a_sunglasses' } },
  { id: 'mock-chen', name: 'Chen', avatar: { v: 1, skin: '#f1c27d', hair: 'h_spiky', hairColor: 'hc_black', top: 't_hoodie', bottom: 'b_joggers', shoes: 's_blue', acc: 'a_headphones' } },
  { id: 'mock-dani', name: 'Dani', avatar: { v: 1, skin: '#8d5524', hair: 'h_bun', hairColor: 'hc_brown', top: 't_singlet', bottom: 'b_skirt', shoes: 's_pink', acc: 'a_medal' } },
  { id: 'mock-eli', name: 'Eli', avatar: { v: 1, skin: '#e0ac69', hair: 'h_mohawk', hairColor: 'hc_green', top: 't_tracksuit', bottom: 'b_joggers', shoes: 's_white', acc: 'a_cap' } },
]);

/** MOCK: the current party. */
export const MOCK_PARTY = Object.freeze({
  id: 'mock-party-1',
  name: 'Lunch Break Runners',
  memberIds: MOCK_MEMBERS.map((m) => m.id),
});

/** MOCK: party rules shown on the Party rules placeholder. */
export const MOCK_PARTY_RULES = Object.freeze({
  dayResetsAt: 'Midnight (each member\'s local time)',
  stepScoring: 'plain', // 'plain' or 'elevation_bonus' (see STEP_SCORING in rules/ranking.js)
  inviteOnly: true,
});

/** MOCK: typical daily steps per member, used by MockStepsProvider. */
export const MOCK_STEP_PROFILES = Object.freeze({
  [MOCK_ME_ID]: { base: 9000 },
  'mock-alex': { base: 12500 },
  'mock-bea': { base: 10500 },
  'mock-chen': { base: 7000 },
  'mock-dani': { base: 8500 },
  'mock-eli': { base: 5500 },
});

/** MOCK: a running competition, always placed around today so there is something to show. */
export function mockDefaultCompetition(today) {
  return {
    id: 'mock-competition-1',
    name: 'Autumn Sprint',
    start: addDays(today, -6),
    end: addDays(today, 7),
    mode: 'points_321',
    golden: true,
    mock: true,
  };
}
