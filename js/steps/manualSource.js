// "manual" StepsSource: values the user types in on the Health connect screen.

import { StepsSource } from './stepsSource.js';

export class ManualStepsSource extends StepsSource {
  #entries = new Map();

  get id() {
    return 'manual';
  }

  async isAvailable() {
    return true;
  }

  async connect() {
    return true;
  }

  async disconnect() {
    this.#entries.clear();
  }

  /** Records what the user typed. Validation happens in sync.js. */
  setEntry(day, steps) {
    this.#entries.set(day, steps);
  }

  async fetchDays(fromDay, toDay) {
    const out = [];
    for (const [day, steps] of this.#entries) {
      if (day >= fromDay && day <= toDay) out.push({ day, steps });
    }
    this.#entries.clear(); // hand each typed value over once
    return out;
  }
}
