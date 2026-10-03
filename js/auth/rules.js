// Client-side input rules. They mirror CLAUDE.md §3 and the database constraints for a
// better user experience; the server (Supabase Auth + Postgres constraints) always re-checks.

/** No MFA yet, so the minimum is 15 characters (CLAUDE.md §3). Set the same minimum in the dashboard. */
export const PASSWORD_MIN = 15;
/** Supabase Auth hashes passwords with bcrypt, which only uses the first 72 bytes. */
export const PASSWORD_MAX_BYTES = 72;

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 30;
export const EMAIL_MAX = 254;

const TIMEZONE_RE = /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const utf8Length = (s) => new TextEncoder().encode(s).length;

/** @returns {'too_short'|'too_long'|null} No composition rules, no hints. */
export function checkPassword(password) {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN) return 'too_short';
  if (utf8Length(password) > PASSWORD_MAX_BYTES) return 'too_long';
  return null;
}

export function checkEmail(email) {
  return typeof email === 'string' && email.length <= EMAIL_MAX && EMAIL_RE.test(email.trim());
}

/** @returns {string|null} the trimmed name, or null if it is not 2–30 characters. */
export function cleanDisplayName(name) {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  return trimmed.length >= DISPLAY_NAME_MIN && trimmed.length <= DISPLAY_NAME_MAX ? trimmed : null;
}

/** The browser's IANA time zone if it looks valid, otherwise 'UTC'. */
export function browserTimezone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof tz === 'string' && tz.length <= 64 && TIMEZONE_RE.test(tz) ? tz : 'UTC';
  } catch {
    return 'UTC';
  }
}

export function isTimezone(value) {
  return typeof value === 'string' && value.length >= 1 && value.length <= 64 && TIMEZONE_RE.test(value);
}

/** Routes the app may return to after login ("next"). Anything else is ignored. */
export const SAFE_NEXT_ROUTES = Object.freeze([
  'race', 'competition', 'profile', 'profile/avatar', 'profile/members', 'profile/rules',
  'profile/competition', 'profile/login', 'profile/account', 'profile/health',
]);

export function safeNext(value) {
  return typeof value === 'string' && SAFE_NEXT_ROUTES.includes(value) ? value : null;
}
