// Shared by the four club maps. Only real people count toward channel and local thresholds.
import { ZoneOpening, demandByThresholds } from './zone-opening.js';

const targets = [
  { humans: { openAt: 20, shrinkAt: 15 }, hotspot: { openAt: 16, shrinkAt: 11 } },
  { humans: { openAt: 40, shrinkAt: 30 }, hotspot: { openAt: 32, shrinkAt: 24 } },
];

export class ChannelZones {
  #zones = targets.map((thresholds, i) => {
    const measure = demandByThresholds(thresholds);
    return new ZoneOpening({
      openDelayMs: 10_000, shrinkDelayMs: 30_000, minOpenMs: 180_000,
      // An event upstairs also keeps its prerequisite tier open.
      demand: sample => sample.eventTier >= i + 1 ? 'expand' : measure(sample),
    });
  });

  #zone(tier) {
    if (tier !== 1 && tier !== 2) throw new RangeError('Expected expansion tier 1 or 2');
    return this.#zones[tier - 1];
  }

  state(tier) { return this.#zone(tier).state; }
  canEnter(tier) { return this.#zone(tier).canEnter; }
  finishOpening(tier, attempt, ready, now) {
    return this.#zone(tier).finishOpening(attempt, ready, now);
  }

  // Server sample: total humans including the base area, and disjoint occupancy counts.
  // eventTier is the highest expansion tier needed by an active operator event (0 if none).
  observe({ humans, humansByArea, eventTier = 0 }, now) {
    if (!Number.isSafeInteger(humans) || humans < 0 ||
        !Array.isArray(humansByArea) || !humansByArea.every(n => Number.isSafeInteger(n) && n >= 0) ||
        humansByArea.reduce((sum, n) => sum+n, 0) > humans || ![0,1,2].includes(eventTier))
      throw new RangeError('Invalid channel occupancy or event tier');
    const sample = {humans, hotspot: Math.max(0, ...humansByArea), eventTier};
    const [first, second] = this.#zones;
    const attempts = [];
    const a = first.observe(sample, now, {allowShrink:second.state === 'CLOSED'});
    if (a !== null) attempts.push({tier:1, attempt:a});
    const b = second.observe(sample, now, {allowOpen:first.state === 'OPEN'});
    if (b !== null) attempts.push({tier:2, attempt:b});
    return attempts;
  }
}
