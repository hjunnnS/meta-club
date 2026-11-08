// One expansion zone in one channel. A caller supplies its approved demand policy
// and monotonic sample times. DRAINING is handed off to the protection rules in #69.
export class ZoneOpening {
  #state = 'CLOSED';
  #since;
  #last;
  #candidateSince;
  #generation = 0;
  #timing;
  #demand;

  constructor({ openDelayMs, shrinkDelayMs, minOpenMs, demand }) {
    for (const ms of [openDelayMs, shrinkDelayMs, minOpenMs]) {
      if (!Number.isSafeInteger(ms) || ms < 0) throw new RangeError('Invalid zone timing');
    }
    if (typeof demand !== 'function') throw new TypeError('Missing zone demand policy');
    this.#timing = { openDelayMs, shrinkDelayMs, minOpenMs };
    this.#demand = demand;
  }

  get state() {
    return this.#state;
  }
  get canEnter() {
    return this.#state === 'OPEN';
  }

  #checkTime(now) {
    if (!Number.isFinite(now) || now < 0 || now < this.#last)
      throw new RangeError('Invalid zone clock');
    this.#last = now;
  }

  #transition(state, now) {
    this.#state = state;
    this.#since = now;
    this.#candidateSince = undefined;
  }

  // Returns an opening attempt number only once, or null if no preparation is needed.
  observe(snapshot, now, { allowOpen = true, allowShrink = true } = {}) {
    this.#checkTime(now);
    if (this.#state !== 'CLOSED' && this.#state !== 'OPEN') return null;
    const demand = this.#demand(snapshot);
    if (!['expand', 'hold', 'shrink'].includes(demand)) throw new TypeError('Invalid zone demand');
    const opening = this.#state === 'CLOSED';
    if (demand !== (opening ? 'expand' : 'shrink')) {
      this.#candidateSince = undefined;
      return null;
    }
    this.#candidateSince ??= now;
    const delay = opening ? this.#timing.openDelayMs : this.#timing.shrinkDelayMs;
    if (now - this.#candidateSince < delay) return null;
    if (opening) {
      if (!allowOpen) return null;
      this.#transition('OPENING', now);
      return ++this.#generation;
    }
    if (allowShrink && now - this.#since >= this.#timing.minOpenMs) this.#transition('DRAINING', now);
    return null;
  }

  finishOpening(attempt, ready, now) {
    if (this.#state !== 'OPENING' || attempt !== this.#generation) return false;
    this.#checkTime(now);
    if (typeof ready !== 'boolean') throw new TypeError('Expected zone preparation result');
    this.#transition(ready ? 'OPEN' : 'CLOSED', now);
    return true;
  }
}

// Different high/low limits avoid flapping. The caller chooses which measurements
// participate (e.g. humans only, or a configured local density including AI).
export function demandByThresholds(limits) {
  const entries = Object.entries(limits).map(([name, { openAt, shrinkAt }]) => {
    if (![openAt, shrinkAt].every(Number.isFinite) || shrinkAt < 0 || shrinkAt >= openAt)
      throw new RangeError('Invalid zone thresholds for ' + name);
    return { name, openAt, shrinkAt };
  });
  if (!entries.length) throw new TypeError('Missing zone measurements');
  return (sample) => {
    let high = false,
      low = true;
    for (const { name, openAt, shrinkAt } of entries) {
      const value = sample[name];
      if (!Number.isFinite(value) || value < 0)
        throw new RangeError('Invalid measurement: ' + name);
      high ||= value >= openAt;
      low &&= value <= shrinkAt;
    }
    return high ? 'expand' : low ? 'shrink' : 'hold';
  };
}
