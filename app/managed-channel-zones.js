import { ChannelZones } from './channel-zones.js';

// Single server owner for membership, demand sampling and closure. No async gap
// between blocking admission, moving AI and reading the live protection records.
export class ManagedChannelZones {
  #zones = new ChannelZones();
  #groups = new Map();
  // Channel-local membership; 0 is the always-open base area.
  #humans = new Map();
  #ai = new Map();
  #reservations = [new Map(), new Map()];
  #lastTime = -1;
  #clock(now) {
    if (!Number.isFinite(now) || now < this.#lastTime || now < 0)
      throw new RangeError('Invalid channel clock');
    this.#lastTime = now;
  }
  state(tier) {
    return this.#zones.state(tier);
  }
  canEnter(tier) {
    return tier === 0 || this.#zones.canEnter(tier);
  }
  finishOpening(tier, attempt, ready, now) {
    this.#clock(now);
    return this.#zones.finishOpening(tier, attempt, ready, now);
  }
  observe(now, eventTier = 0) {
    this.#clock(now);
    const counts = new Map();
    for (const [id, tier] of this.#humans) {
      const key = JSON.stringify([tier, this.#groups.get(id)]);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return this.#zones.observe(
      { humans: this.#humans.size, humansByArea: [...counts.values()], eventTier },
      now,
    );
  }

  #roster(kind) {
    if (kind === 'human') return this.#humans;
    if (kind === 'ai') return this.#ai;
    throw new TypeError('Unknown visitor kind');
  }

  // Compare the expected origin before moving, so a delayed leave cannot evict a returning visitor.
  // null is outside the channel. Refusing the destination preserves the current membership.
  move(kind, id, from, to, group = to) {
    if (typeof id !== 'string' || !id) throw new TypeError('Missing visitor ID');
    const members = this.#roster(kind);
    const current = members.get(id) ?? null;
    if (current !== from) return false;
    if (to !== null && typeof group !== 'string' && group !== to)
      throw new TypeError('Invalid crowd counting area');
    if (current === to) {
      if (kind === 'human' && to !== null && this.canEnter(to)) this.#groups.set(id, group);
      return true;
    }
    if (to !== null && to !== 0 && !this.canEnter(to)) return false;
    if (to === null) members.delete(id);
    else members.set(id, to);
    if (kind === 'human') {
      if (to === null) this.#groups.delete(id);
      else this.#groups.set(id, group);
    }
    return true;
  }

  location(kind, id) {
    return this.#roster(kind).get(id) ?? null;
  }

  // Mirror existing rights only. No sale or entitlement is created here. Deadlines,
  // when known, use the same monotonic clock as observe(); null requires explicit release.
  protectReservation(tier, id, expiresAt = null) {
    const state = this.#zones.state(tier);
    if (typeof id !== 'string' || !id) throw new TypeError('Missing reservation ID');
    if (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt < 0))
      throw new RangeError('Invalid reservation deadline');
    if (state !== 'OPEN' && state !== 'DRAINING') return false;
    this.#reservations[tier - 1].set(id, expiresAt);
    return true;
  }

  releaseReservation(tier, id) {
    this.#zones.state(tier);
    return this.#reservations[tier - 1].delete(id);
  }

  // Synchronous server turn: relocate only AI, inspect current blockers, then commit closure.
  drain(tier, now) {
    const state = this.#zones.state(tier);
    this.#clock(now);
    const movedAI = [];
    if (state !== 'DRAINING') return { state, movedAI };
    for (const [id, area] of this.#ai) {
      if (area === tier) {
        this.#ai.set(id, 0);
        movedAI.push(id);
      }
    }
    let humans = 0;
    for (const area of this.#humans.values()) if (area === tier) humans++;
    const reservations = this.#reservations[tier - 1];
    for (const [id, deadline] of reservations) {
      if (deadline !== null && now >= deadline) reservations.delete(id);
    }
    this.#zones.finishDraining(tier, now, { humans, ai: 0, reservations: reservations.size });
    return { state: this.state(tier), movedAI, humans, reservations: reservations.size };
  }
}
