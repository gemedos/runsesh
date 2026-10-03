// StepsSource: anything that can provide the signed-in user's daily step totals.
// Phase 2 has one implementation ("manual"). Part B adds "health_connect" (Android).
// Values from ANY source are validated again by js/steps/sync.js before they are saved.

/** @abstract */
export class StepsSource {
  /** One of the database's allowed sources: 'manual' | 'health_connect' | 'shortcut'. */
  get id() {
    throw new Error('StepsSource.id not implemented');
  }

  /** @returns {Promise<boolean>} whether this source can be used on this device */
  async isAvailable() {
    return false;
  }

  /** Ask for permission / set up. @returns {Promise<boolean>} */
  async connect() {
    return false;
  }

  async disconnect() {}

  /**
   * @param {string} fromDay 'YYYY-MM-DD'
   * @param {string} toDay 'YYYY-MM-DD' inclusive
   * @returns {Promise<{day: string, steps: number}[]>}
   */
  async fetchDays(fromDay, toDay) {
    throw new Error('StepsSource.fetchDays not implemented');
  }
}
