import { checkEmail, checkPassword, cleanDisplayName, isTimezone, PASSWORD_MIN, safeNext } from '../js/auth/rules.js';
import { isValidEntry } from '../js/steps/sync.js';
import { eq, test } from './harness.js';

test('password: minimum 15, up to 72 bytes, no composition rules', () => {
  eq(checkPassword('a'.repeat(PASSWORD_MIN - 1)), 'too_short');
  eq(checkPassword('a'.repeat(PASSWORD_MIN)), null);
  eq(checkPassword('correct horse battery staple'), null);
  eq(checkPassword('x'.repeat(64)), null);
  eq(checkPassword('x'.repeat(73)), 'too_long');
  eq(checkPassword(undefined), 'too_short');
});

test('display name: trimmed, 2 to 30 characters', () => {
  eq(cleanDisplayName('  Sam  '), 'Sam');
  eq(cleanDisplayName('S'), null);
  eq(cleanDisplayName('x'.repeat(31)), null);
  eq(cleanDisplayName(42), null);
});

test('email and timezone checks', () => {
  eq([checkEmail('a@b.co'), checkEmail('nope'), checkEmail('a b@c.d')], [true, false, false]);
  eq([isTimezone('Europe/Madrid'), isTimezone('America/Argentina/Buenos_Aires'), isTimezone('UTC'), isTimezone('../etc'), isTimezone('')], [true, true, true, false, false]);
});

test('"next" redirect values are limited to internal routes', () => {
  eq(safeNext('profile/account'), 'profile/account');
  eq(safeNext('https://evil.example'), null);
  eq(safeNext('//evil.example'), null);
  eq(safeNext('login'), null);
});

test('steps entries: integers 0..100000 inside the day window only', () => {
  const now = new Date(Date.UTC(2026, 9, 10, 12));
  eq(isValidEntry({ day: '2026-10-10', steps: 8000 }, now), true);
  eq(isValidEntry({ day: '2026-10-07', steps: 0 }, now), true);
  eq(isValidEntry({ day: '2026-10-11', steps: 100000 }, now), true);
  eq(isValidEntry({ day: '2026-10-06', steps: 10 }, now), false); // 4 days back
  eq(isValidEntry({ day: '2026-10-12', steps: 10 }, now), false); // 2 days ahead
  eq(isValidEntry({ day: '2026-10-10', steps: -1 }, now), false);
  eq(isValidEntry({ day: '2026-10-10', steps: 100001 }, now), false);
  eq(isValidEntry({ day: '2026-10-10', steps: 12.5 }, now), false);
  eq(isValidEntry({ day: '2026-10-10', steps: '9000' }, now), false);
  eq(isValidEntry({ day: '2026-02-30', steps: 1 }, now), false);
});
