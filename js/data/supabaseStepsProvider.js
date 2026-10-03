// StepsProvider (Phase 1 interface) backed by Supabase for the signed-in user's OWN steps.
// Every other party member still comes from the MOCK provider until Phase 3 adds parties.

import { fetchOwnHistory } from '../steps/sync.js';
import { eachDay } from '../util/date.js';
import { MOCK_ME_ID } from './mockData.js';
import { StepsProvider } from './stepsProvider.js';

export class SupabaseStepsProvider extends StepsProvider {
  /**
   * @param {() => string|null} getUserId current signed-in user id
   * @param {StepsProvider} mockProvider MOCK data for the other (fake) party members
   */
  constructor(getUserId, mockProvider) {
    super();
    this.getUserId = getUserId;
    this.mock = mockProvider;
  }

  async getStepsForDay(memberId, isoDate) {
    if (memberId !== MOCK_ME_ID) return this.mock.getStepsForDay(memberId, isoDate); // MOCK
    const [row] = await this.getStepsForRange(memberId, isoDate, isoDate);
    return row ? row.steps : 0;
  }

  async getStepsForRange(memberId, startIso, endIso) {
    if (memberId !== MOCK_ME_ID) return this.mock.getStepsForRange(memberId, startIso, endIso); // MOCK
    const userId = this.getUserId();
    const rows = userId ? await fetchOwnHistory(userId, startIso, endIso) : null;
    const byDay = new Map((rows || []).map((r) => [r.day, r.steps]));
    return eachDay(startIso, endIso).map((date) => ({ date, steps: byDay.get(date) || 0 }));
  }
}
