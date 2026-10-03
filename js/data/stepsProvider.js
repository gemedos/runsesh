// StepsProvider: the only way the app reads step counts.
// Implementation: SupabaseStepsProvider (daily totals stored in public.daily_steps).

/**
 * Interface. Methods are async so a network or health-data source can drop in.
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
