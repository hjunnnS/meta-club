import { Room } from '@colyseus/core';
import { ManagedChannelZones } from './managed-channel-zones.js';
import { playlist } from './music.js';
import { profile } from './store.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export class ReviewRoom extends Room {
  onAuth(_c, { identity }, ctx) {
    return this.constructor.verifyIdentity(ctx.headers, identity);
  }
  onCreate() {
    this.maxClients = 60;
    this.members = new Map();
    this.zones = new ManagedChannelZones();
    this.eventTier = 0;
    this.epoch = Date.now();
    this.preparing = [];
    this.registry.set(this.roomId, this);
    this.onMessage('clock', (c, sent) => {
      if (Number.isFinite(sent))
        c.send('clock', { now: Date.now(), sent, epoch: this.epoch, tracks: playlist() });
    });
    this.onMessage('snapshot', (c) => c.send('snapshot', this.snapshot()));
    this.onMessage('move', (c, p) => this.move(c, p));
    this.registerActivities();
    this.setSimulationInterval(() => {
      this.tickZones(performance.now());
      this.broadcast('snapshot', this.snapshot());
    }, 150);
  }
  tickZones(now) {
    for (const { tier, attempt } of this.preparing)
      this.zones.finishOpening(tier, attempt, true, now);
    this.preparing = this.zones.observe(now, this.eventTier);
    for (const tier of [2, 1])
      if (this.zones.state(tier) === 'DRAINING') this.zones.drain(tier, now);
  }
  snapshot() {
    return {
      actors: [...this.members.values()],
      zones: [this.zones.state(1), this.zones.state(2)],
      epoch: this.epoch,
    };
  }
  move(c, p) {
    const actor = this.members.get(c.sessionId);
    if (actor?.seat) return;
    if (!actor || !p || !['x', 'y', 'z', 'yaw'].every((k) => Number.isFinite(p[k]))) return;
    const now = performance.now(),
      d = distance(actor, p);
    if (d > Math.min(4, (now - c.userData.lastMove) * 0.004 + 0.18)) return c.send('place', actor);
    const steps = Math.max(1, Math.ceil(d / 0.12));
    let tier = this.zones.location('human', actor.id),
      dest;
    for (let i = 1; i <= steps; i++) {
      const f = i / steps;
      dest = this.area({
        x: actor.x + (p.x - actor.x) * f,
        y: actor.y + (p.y - actor.y) * f,
        z: actor.z + (p.z - actor.z) * f,
      });
      if (!dest || (tier !== dest.tier && !this.zones.canEnter(dest.tier)))
        return c.send('place', actor);
      tier = dest.tier;
    }
    if (
      !this.zones.move('human', actor.id, this.zones.location('human', actor.id), tier, dest.name)
    )
      return c.send('place', actor);
    Object.assign(actor, { x: p.x, y: p.y, z: p.z, yaw: p.yaw });
    if (d > 0.015) actor.action = 'idle';
    c.userData.lastMove = now;
  }
  onJoin(c, { identity, expires }) {
    if (
      !Number.isFinite(expires) ||
      expires <= Date.now() ||
      this.clients.some((v) => v !== c && v.userData?.identity === identity)
    )
      throw Error('Unavailable session');
    c.userData = {
      identity,
      lastMove: performance.now(),
      expiry: this.clock.setTimeout(() => c.leave(4003), expires - Date.now()),
    };
    this.members.set(c.sessionId, {
      id: c.sessionId,
      ...profile(identity),
      ...this.entry,
      yaw: 0,
      action: 'idle',
    });
    this.zones.move('human', c.sessionId, null, 0, 'entry');
  }
  onLeave(c) {
    c.userData?.expiry?.clear();
    this.members.delete(c.sessionId);
    this.zones.move('human', c.sessionId, this.zones.location('human', c.sessionId), null);
  }
  onDispose() {
    this.registry.delete(this.roomId);
  }
}
