import { cleanTokenRows, TOKEN_RE } from '../js/data/ingestTokenRepo.js';
import { eq, test } from './harness.js';

const ID = '00000000-0000-4000-8000-000000000001';

test('ingest token format: <uuid>.<43 base64url characters>', () => {
  eq(TOKEN_RE.test(`${ID}.${'A'.repeat(43)}`), true);
  eq(TOKEN_RE.test(`${ID}.${'A'.repeat(42)}`), false);
  eq(TOKEN_RE.test(`${ID}.${'A'.repeat(42)}+`), false);
  eq(TOKEN_RE.test(`rs_${'A'.repeat(43)}`), false);
  eq(TOKEN_RE.test(`Bearer ${ID}.${'A'.repeat(43)}`), false);
});

test('token rows: only well-formed rows, never more than the listed fields', () => {
  const rows = cleanTokenRows([
    { id: ID, platform: 'android', secret_hint: 'ab_1', created_at: '2026-10-04T10:00:00Z', last_used_at: null, secret_hash: 'x' },
    { id: 'nope', platform: 'android', secret_hint: 'ab12' },
    { id: ID, platform: 'web', secret_hint: 'ab12' },
    { id: ID, platform: 'ios', secret_hint: '<img>', created_at: 'later', last_used_at: '2026-10-04T11:00:00Z' },
    null,
  ]);
  eq(rows, [
    { id: ID, platform: 'android', hint: 'ab_1', createdAt: '2026-10-04T10:00:00Z', lastUsedAt: null },
    { id: ID, platform: 'ios', hint: '????', createdAt: null, lastUsedAt: '2026-10-04T11:00:00Z' },
  ]);
  eq(cleanTokenRows(null), []);
});
