import { competitionStandings, dayStandings, isStepScoring, pointsForRank, rankDay, rankEntries } from '../js/rules/ranking.js';
import { eq, test } from './harness.js';

const ids = ['a', 'b', 'c', 'd'];
const today = '2026-10-05';
const days = [
  { date: '2026-10-01', steps: { a: 9000, b: 12000, c: 3000, d: 0 } },
  { date: '2026-10-02', steps: { a: 15000, b: 12000, c: 12000, d: 100 } },
  { date: '2026-10-03', steps: { a: 0, b: 0, c: 0, d: 0 } },
  { date: today, steps: { a: 1, b: 2, c: 99999, d: 4 } },
];
const byId = (standings) => Object.fromEntries([...standings].sort((x, y) => (x.id < y.id ? -1 : 1)).map((r) => [r.id, r.value]));

test('rankEntries sorts high to low and shares ranks on ties', () => {
  eq(rankEntries([{ id: 'x', value: 5 }, { id: 'y', value: 9 }, { id: 'z', value: 5 }, { id: 'w', value: 1 }]),
    [{ id: 'y', value: 9, rank: 1 }, { id: 'x', value: 5, rank: 2 }, { id: 'z', value: 5, rank: 2 }, { id: 'w', value: 1, rank: 4 }]);
});

test('rankDay treats missing and invalid steps as 0', () => {
  eq(rankDay({ a: 10, b: -5, c: NaN }, ['a', 'b', 'c', 'd']).map((r) => r.value), [10, 0, 0, 0]);
});

test('pointsForRank is 3-2-1', () => {
  eq([1, 2, 3, 4].map(pointsForRank), [3, 2, 1, 0]);
});

test('days won: finished days only, ties all win, empty day has no winner', () => {
  eq(byId(competitionStandings({ mode: 'days_won', days, memberIds: ids, today })), { a: 1, b: 1, c: 0, d: 0 });
});

test('points 3-2-1 with shared ranks', () => {
  // day 1: b 3, a 2, c 1. day 2: a 3, b and c tie for 2nd -> 2 each, d is 4th -> 0.
  const s = competitionStandings({ mode: 'points_321', days, memberIds: ids, today });
  eq(byId(s), { a: 5, b: 5, c: 3, d: 0 });
  eq(s.map((r) => r.rank), [1, 1, 3, 4]);
});

test('total steps includes today and ignores future days', () => {
  const s = competitionStandings({ mode: 'total_steps', days: [...days, { date: '2026-10-09', steps: { a: 1e6 } }], memberIds: ids, today });
  eq(byId(s), { a: 24001, b: 24002, c: 114999, d: 104 });
});

test('unknown mode throws', () => {
  let threw = false;
  try { competitionStandings({ mode: 'nope', days: [], memberIds: ids, today }); } catch { threw = true; }
  eq(threw, true);
});

test('step scoring accepts only the two documented values', () => {
  eq(['plain', 'elevation_bonus', 'bonus', '', null].map(isStepScoring), [true, true, false, false, false]);
});

test('dayStandings: one day ranked, points and day wins only for finished days', () => {
  const stepsById = { a: 9000, b: 12000, c: 9000, d: 0 };
  const ids = ['a', 'b', 'c', 'd'];
  const points = dayStandings({ mode: 'points_321', stepsById, memberIds: ids, dayDone: true });
  eq(points.map((r) => [r.id, r.rank, r.points]), [['b', 1, 3], ['a', 2, 2], ['c', 2, 2], ['d', 4, 0]]);
  const won = dayStandings({ mode: 'days_won', stepsById, memberIds: ids, dayDone: true });
  eq(won.filter((r) => r.wonDay).map((r) => r.id), ['b']);
  const running = dayStandings({ mode: 'points_321', stepsById, memberIds: ids, dayDone: false });
  eq(running.map((r) => r.points), [0, 0, 0, 0]);
  const total = dayStandings({ mode: 'total_steps', stepsById, memberIds: ids, dayDone: true });
  eq(total.map((r) => [r.id, r.value, r.points, r.wonDay]), [['b', 12000, 0, false], ['a', 9000, 0, false], ['c', 9000, 0, false], ['d', 0, 0, false]]);
  const empty = dayStandings({ mode: 'days_won', stepsById: {}, memberIds: ['a', 'b'], dayDone: true });
  eq(empty.filter((r) => r.wonDay).length, 0);
});
