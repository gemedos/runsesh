// StepsProvider: the only way the app reads step counts.
// Phase 4 swaps MockStepsProvider for a real source by changing createStepsProvider().

import { eachDay, todayISO } from '../util/date.js';
import { MOCK_STEP_PROFILES } from './mockData.js';

/**
 * Interface. Methods are async so a network or health-data source can drop in later.
 * @abstract
 */
export class StepsProvider {
  /** @returns {Promise<number>} steps for one member on one local date ('YYYY-MM-DD') */
  async getStepsForDay(memberId, isoDate) {
    throw new Error('StepsProvider.getStepsForDay not implemented');
  }

  /** @returns {Promise<{date: string, steps: number}[]>} one entry per day, inclusive */
  async getStepsForRange(memberId, startIso, endIso) {
    throw new Error('StepsProvider.getStepsForRange not implemented');
  }
}

/**
 * MOCK: deterministic fake steps. The same member and date always give the same number.
 * Today's value grows during the day; future dates are 0.
 */
export class MockStepsProvider extends StepsProvider {
  constructor(profiles, clock = () => new Date()) {
    super();
    this.profiles = profiles;
    this.clock = clock;
  }

  async getStepsForDay(memberId, isoDate) {
    return this.#steps(memberId, isoDate);
  }

  async getStepsForRange(memberId, startIso, endIso) {
    return eachDay(startIso, endIso).map((date) => ({ date, steps: this.#steps(memberId, date) }));
  }

  #steps(memberId, isoDate) {
    const profile = this.profiles[memberId];
    if (!profile) return 0;
    const now = this.clock();
    const today = todayISO(now);
    if (isoDate > today) return 0;
    const rand = mulberry32(hashString(`${memberId}|${isoDate}`));
    const full = Math.round(profile.base * (0.55 + rand() * 0.9));
    if (isoDate < today) return full;
    const dayFraction = (now.getHours() * 60 + now.getMinutes()) / 1440;
    return Math.round(full * Math.max(0.15, dayFraction));
  }
}

export function createStepsProvider() {
  return new MockStepsProvider(MOCK_STEP_PROFILES);
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
