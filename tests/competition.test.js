import { validateCompetitionInput, validateStoredCompetition } from '../js/state/competition.js';
import { eq, ok, test } from './harness.js';

const base = { name: '', start: '2026-10-01', end: '', mode: 'days_won', golden: false };

test('valid input with open end date', () => {
  const r = validateCompetitionInput(base);
  ok(r.ok);
  eq(r.value, { name: 'Competition', start: '2026-10-01', end: null, mode: 'days_won', golden: false });
});

test('end before start is rejected', () => {
  eq(validateCompetitionInput({ ...base, end: '2026-09-30' }).ok, false);
});

test('impossible dates and bad modes are rejected', () => {
  eq(validateCompetitionInput({ ...base, start: '2026-02-30' }).ok, false);
  eq(validateCompetitionInput({ ...base, mode: 'most_fun' }).ok, false);
  eq(validateCompetitionInput({ ...base, golden: 'yes' }).ok, false);
});

test('names are trimmed and length-limited; markup stays plain text', () => {
  eq(validateCompetitionInput({ ...base, name: 'x'.repeat(41) }).ok, false);
  eq(validateCompetitionInput({ ...base, name: '  <img src=x onerror=alert(1)>  ' }).value.name, '<img src=x onerror=alert(1)>');
});

test('stored competitions need a safe id', () => {
  eq(validateStoredCompetition({ ...base, id: 'local-abc' }).id, 'local-abc');
  eq(validateStoredCompetition({ ...base, id: '../x' }), null);
});
