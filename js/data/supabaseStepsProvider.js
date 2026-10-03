// StepsProvider (Phase 1 interface) backed by Supabase.
// RLS lets the signed-in user read their own daily totals and those of their party members;
// any other id simply returns no rows (shown as 0 steps).

import { fetchStepHistory } from '../steps/sync.js';
import { eachDay } from '../util/date.js';
import { StepsProvider } from './stepsProvider.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export class SupabaseStepsProvider extends StepsProvider {
  async getStepsForDay(memberId, isoDate) {
    const [row] = await this.getStepsForRange(memberId, isoDate, isoDate);
    return row ? row.steps : 0;
  }

  async getStepsForRange(memberId, startIso, endIso) {
    const rows = UUID_RE.test(memberId || '') ? await fetchStepHistory(memberId, startIso, endIso) : null;
    const byDay = new Map((rows || []).map((r) => [r.day, r.steps]));
    return eachDay(startIso, endIso).map((date) => ({ date, steps: byDay.get(date) || 0 }));
  }
}
