// Parser tests for the ingest-steps Edge Function. Fake data only.
// Run from the repo root:  node tests/ingest-steps.node.mjs   (Node 23.6+ runs the TypeScript directly)
import assert from 'node:assert/strict';
import { parseBody } from '../supabase/functions/ingest-steps/index.ts';

const TODAY = '2026-10-10';
let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (err) {
    console.log(`FAIL  ${name}\n      ${err.message}`);
    process.exitCode = 1;
  }
}
const lifeDashboard = (extra) => ({
  timestamp: '2026-10-10T12:00:00Z', app_version: '1.23.0', source: 'health_connect', sequence: 9, ...extra,
});
const fakeRecord = { count: 12, start_time: '2026-10-10T08:00:00Z', end_time: '2026-10-10T08:01:00Z', uuid: '00000000-0000-4000-8000-000000000000', source: 'com.example.fake' };

test('generic: one day', () => {
  assert.deepEqual(parseBody({ day: '2026-10-10', steps: 8000 }, TODAY), { days: [{ day: '2026-10-10', steps: 8000 }] });
});

test('generic: rejects bad values', () => {
  for (const body of [
    { day: '2026-10-10', steps: -1 }, { day: '2026-10-10', steps: 100001 }, { day: '2026-10-10', steps: 12.5 },
    { day: '2026-10-10', steps: '9000' }, { day: '2026-02-30', steps: 1 }, { day: '10/10/2026', steps: 1 },
    { day: '2026-10-10' }, { steps: 10 }, null, [], 'x', 42, {},
  ]) assert.equal(parseBody(body, TODAY), null, JSON.stringify(body));
});

test('generic: several days, at most 3, no repeats', () => {
  const two = { days: [{ day: '2026-10-09', steps: 1 }, { day: '2026-10-10', steps: 2 }] };
  assert.deepEqual(parseBody(two, TODAY), two);
  const four = { days: ['07', '08', '09', '10'].map((d) => ({ day: `2026-10-${d}`, steps: 1 })) };
  assert.equal(parseBody(four, TODAY), null);
  assert.equal(parseBody({ days: [{ day: '2026-10-10', steps: 1 }, { day: '2026-10-10', steps: 2 }] }, TODAY), null);
});

test('life dashboard: reads only daily_totals date and steps', () => {
  const body = lifeDashboard({
    steps: [fakeRecord], distance: [{ meters: 3.5 }], _diagnostics: { steps: { permission_granted: true } },
    daily_totals: [
      { date: '2026-10-08', steps: 7000, distance_meters: 5000.5, active_calories: 300.0 },
      { date: '2026-10-09', steps: 9000 },
      { date: '2026-10-10', steps: 1200, total_calories: 900.5 },
    ],
  });
  assert.deepEqual(parseBody(body, TODAY), {
    days: [{ day: '2026-10-10', steps: 1200 }, { day: '2026-10-09', steps: 9000 }, { day: '2026-10-08', steps: 7000 }],
  });
});

test('life dashboard: no daily_totals (heartbeat, option off) writes nothing', () => {
  assert.deepEqual(parseBody(lifeDashboard({ steps: [fakeRecord] }), TODAY), { days: [] });
  assert.deepEqual(parseBody(lifeDashboard({}), TODAY), { days: [] });
});

test('life dashboard: entries without steps are skipped', () => {
  const body = lifeDashboard({ daily_totals: [{ date: '2026-10-10', distance_meters: 10.5 }, { date: '2026-10-09', steps: 5 }] });
  assert.deepEqual(parseBody(body, TODAY), { days: [{ day: '2026-10-09', steps: 5 }] });
});

test('life dashboard: a malformed entry rejects the whole payload', () => {
  for (const bad of [
    { date: '2026-10-10', steps: 12.5 }, { date: '2026-10-10', steps: -3 }, { date: '2026-10-10', steps: '100' },
    { date: '2026-10-10', steps: 100001 }, { date: '2026-13-01', steps: 1 }, { steps: 1 }, 'x', null,
  ]) assert.equal(parseBody(lifeDashboard({ daily_totals: [{ date: '2026-10-09', steps: 1 }, bad] }), TODAY), null, JSON.stringify(bad));
  assert.equal(parseBody(lifeDashboard({ daily_totals: { date: '2026-10-10', steps: 1 } }), TODAY), null);
  assert.equal(parseBody(lifeDashboard({ daily_totals: [{ date: '2026-10-10', steps: 1 }, { date: '2026-10-10', steps: 2 }] }), TODAY), null);
});

test('life dashboard: backfill keeps the 3 newest days inside the window', () => {
  const totals = [];
  for (let d = 1; d <= 12; d += 1) totals.push({ date: `2026-10-${String(d).padStart(2, '0')}`, steps: d * 100 });
  assert.deepEqual(parseBody(lifeDashboard({ daily_totals: totals }), TODAY), {
    days: [{ day: '2026-10-11', steps: 1100 }, { day: '2026-10-10', steps: 1000 }, { day: '2026-10-09', steps: 900 }],
  });
  const old = lifeDashboard({ daily_totals: [{ date: '2026-09-01', steps: 5 }] });
  assert.deepEqual(parseBody(old, TODAY), { days: [] });
});

test('life dashboard: window crosses a month boundary', () => {
  const body = lifeDashboard({ daily_totals: [{ date: '2026-09-28', steps: 1 }, { date: '2026-09-27', steps: 2 }] });
  assert.deepEqual(parseBody(body, '2026-10-01'), { days: [{ day: '2026-09-28', steps: 1 }] });
});

test('life dashboard: too many entries is rejected', () => {
  const totals = Array.from({ length: 61 }, (_, i) => ({ date: '2026-10-10', steps: i }));
  assert.equal(parseBody(lifeDashboard({ daily_totals: totals }), TODAY), null);
});

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
