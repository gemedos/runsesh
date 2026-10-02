// Validation for the "Create a competition" form. The backend must re-validate in Phase 5.

import { isRankingMode } from '../rules/ranking.js';
import { isISODate } from '../util/date.js';

export const COMPETITION_NAME_MAX = 40;

/**
 * @param {object} input raw form values { name, start, end, mode, golden }
 * @returns {{ ok: true, value: object } | { ok: false, errors: Record<string, string> }}
 */
export function validateCompetitionInput(input) {
  const errors = {};
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const start = input.start;
  const end = input.end === '' || input.end === null || input.end === undefined ? null : input.end;

  if (name.length > COMPETITION_NAME_MAX) errors.name = `Use at most ${COMPETITION_NAME_MAX} characters.`;
  if (!isISODate(start)) errors.start = 'Pick a start date.';
  if (end !== null && !isISODate(end)) errors.end = 'That end date is not valid.';
  else if (end !== null && isISODate(start) && end < start) errors.end = 'The end date must be on or after the start date.';
  if (!isRankingMode(input.mode)) errors.mode = 'Pick a ranking mode.';
  if (typeof input.golden !== 'boolean') errors.golden = 'Invalid value.';

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name: name || 'Competition', start, end, mode: input.mode, golden: input.golden } };
}

/** Validates a stored competition (from localStorage) including its id. */
export function validateStoredCompetition(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !/^[\w-]{1,64}$/.test(raw.id)) return null;
  const res = validateCompetitionInput(raw);
  return res.ok ? Object.freeze({ id: raw.id, ...res.value }) : null;
}
