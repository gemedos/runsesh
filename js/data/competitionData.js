// Glue between StepsProvider and the pure ranking rules.

import { competitionStandings } from '../rules/ranking.js';
import { eachDay } from '../util/date.js';

/**
 * @param {object} competition validated competition
 * @param {{id: string}[]} members
 * @param {import('./stepsProvider.js').StepsProvider} steps
 * @param {string} today 'YYYY-MM-DD'
 */
export async function loadStandings(competition, members, steps, today) {
  const memberIds = members.map((m) => m.id);
  const last = competition.end && competition.end < today ? competition.end : today;
  const dates = competition.start <= last ? eachDay(competition.start, last) : [];

  let days = [];
  if (dates.length) {
    const ranges = await Promise.all(memberIds.map((id) => steps.getStepsForRange(id, dates[0], dates[dates.length - 1])));
    const byMember = ranges.map((range) => new Map(range.map((d) => [d.date, d.steps])));
    days = dates.map((date) => ({
      date,
      steps: Object.fromEntries(memberIds.map((id, i) => [id, byMember[i].get(date) || 0])),
    }));
  }

  return competitionStandings({ mode: competition.mode, days, memberIds, today });
}
