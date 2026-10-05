// All ranking and scoring rules live here. Pure functions only: no DOM, no storage,
// no clock (callers pass `today`). Tested in tests/ranking.test.js.
//
// MOCK RULES (Phase 1): these are placeholder rules until Phase 5 defines the real ones.
//  - Ties share a rank (1, 1, 3 ...).
//  - "Days won" and "Points 3-2-1" only score finished days, so today never counts yet.
//  - "Total steps" includes today's steps so far.
//  - A day where nobody walked has no winner and gives no points.

export const RANKING_MODES = Object.freeze({
  DAYS_WON: 'days_won',
  POINTS_321: 'points_321',
  TOTAL_STEPS: 'total_steps',
});

export function isRankingMode(value) {
  return Object.values(RANKING_MODES).includes(value);
}

/**
 * How a party counts steps. Only stored and shown in Phase 1: the elevation bonus
 * needs real elevation data, so its rule is defined in a later phase.
 */
export const STEP_SCORING = Object.freeze({
  PLAIN: 'plain',
  ELEVATION_BONUS: 'elevation_bonus',
});

export function isStepScoring(value) {
  return Object.values(STEP_SCORING).includes(value);
}

/**
 * Sorts entries by value (high to low) and assigns standard competition ranks.
 * @param {{id: string, value: number}[]} entries
 * @returns {{id: string, value: number, rank: number}[]}
 */
export function rankEntries(entries) {
  const sorted = [...entries].sort((a, b) => b.value - a.value || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let rank = 0;
  return sorted.map((entry, i) => {
    if (i === 0 || entry.value !== sorted[i - 1].value) rank = i + 1;
    return { id: entry.id, value: entry.value, rank };
  });
}

/** Points for a daily rank in the 3-2-1 mode. */
export function pointsForRank(rank) {
  return rank === 1 ? 3 : rank === 2 ? 2 : rank === 3 ? 1 : 0;
}

/**
 * Ranks one day's steps. Members without data count as 0 steps.
 * @param {Record<string, number>} stepsById
 * @param {string[]} memberIds
 */
export function rankDay(stepsById, memberIds) {
  return rankEntries(memberIds.map((id) => ({ id, value: safeSteps(stepsById[id]) })));
}

/**
 * Competition standings.
 * @param {object} args
 * @param {string} args.mode one of RANKING_MODES
 * @param {{date: string, steps: Record<string, number>}[]} args.days days inside the competition
 * @param {string[]} args.memberIds
 * @param {string} args.today 'YYYY-MM-DD'
 * @returns {{id: string, value: number, rank: number}[]}
 */
export function competitionStandings({ mode, days, memberIds, today }) {
  if (!isRankingMode(mode)) throw new Error('Unknown ranking mode');
  const score = Object.fromEntries(memberIds.map((id) => [id, 0]));

  for (const day of days) {
    if (day.date > today) continue;
    if (mode === RANKING_MODES.TOTAL_STEPS) {
      for (const id of memberIds) score[id] += safeSteps(day.steps[id]);
      continue;
    }
    if (day.date === today) continue; // per-day modes only score finished days
    const ranked = rankDay(day.steps, memberIds).filter((r) => r.value > 0);
    for (const r of ranked) {
      if (mode === RANKING_MODES.DAYS_WON && r.rank === 1) score[r.id] += 1;
      if (mode === RANKING_MODES.POINTS_321) score[r.id] += pointsForRank(r.rank);
    }
  }

  return rankEntries(memberIds.map((id) => ({ id, value: score[id] })));
}

/**
 * One competition day, as shown in the calendar: everyone's steps ranked high to low, plus what
 * the day earned under the competition's mode. Uses the same rules as competitionStandings:
 * per-day modes only score finished days (`dayDone`), and only members with more than 0 steps.
 * @param {object} args
 * @param {string} args.mode one of RANKING_MODES
 * @param {Record<string, number>} args.stepsById
 * @param {string[]} args.memberIds
 * @param {boolean} args.dayDone the day is over (before today)
 * @returns {{id: string, value: number, rank: number, points: number, wonDay: boolean}[]}
 */
export function dayStandings({ mode, stepsById, memberIds, dayDone }) {
  if (!isRankingMode(mode)) throw new Error('Unknown ranking mode');
  const scores = dayDone && mode !== RANKING_MODES.TOTAL_STEPS;
  return rankDay(stepsById, memberIds).map((r) => {
    const counts = scores && r.value > 0;
    return {
      ...r,
      points: counts && mode === RANKING_MODES.POINTS_321 ? pointsForRank(r.rank) : 0,
      wonDay: counts && mode === RANKING_MODES.DAYS_WON && r.rank === 1,
    };
  });
}

function safeSteps(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}
