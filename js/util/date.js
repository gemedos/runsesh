// Local-calendar date helpers. Dates are passed around as 'YYYY-MM-DD' strings.

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 400;

export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Returns a Date for a valid 'YYYY-MM-DD' string, otherwise null. */
export function parseISODate(value) {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

export function isISODate(value) {
  return parseISODate(value) !== null;
}

export function todayISO(now = new Date()) {
  return toISODate(now);
}

export function addDays(iso, days) {
  const date = parseISODate(iso);
  if (!date) throw new Error('Invalid date');
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** Inclusive list of dates from start to end. Empty if end < start. */
export function eachDay(startIso, endIso) {
  const out = [];
  let cur = startIso;
  while (cur <= endIso && out.length < MAX_RANGE_DAYS) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function formatDate(iso) {
  const date = parseISODate(iso);
  return date ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}
