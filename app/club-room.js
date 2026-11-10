import { DanceTrain, onTrainFloor } from './dance-train.js';
import { effects } from '../stage/festival/events.js';
import { localTest } from './local-test.js';
import { ManagedChannelZones } from './managed-channel-zones.js';
import { edmArea, permittedPath } from './edm-layout.js';
import { blockedMessage } from './message-filter.js';
import { background, extraGuestPlaces } from './visitors.js';
import { performanceStatus } from './club-performances.js';
import { playlistPosition } from './public/music.js';
import { playlist } from './music.js';
import { Room } from '@colyseus/core';
import { profile } from './store.js';

export const capacity = 60;
export const seatSeconds = 15;
export const connected = new Map(),
  pending = new Map(),
  recent = new Map(),
  rooms = new Map();
// Additional background visitors use only spare human places, never reserved seats.
const extraVisitors = Number(process.env.CLUB_AI_EXTRA_WHEN_EMPTY || 15);
if (!Number.isInteger(extraVisitors) || extraVisitors < 0 || extraVisitors > capacity)
  throw Error('CLUB_AI_EXTRA_WHEN_EMPTY must be an integer from 0 to ' + capacity);
const floorEntry = { x: -1.8, y: 0.018, z: 6.4, yaw: -1.0 };
const seats = [-17.6, -15.65, -13.7, -11.75, -9.8].map((x) => ({ x, y: 0, z: 17.95, yaw: 0 }));
for (const x of [11.1, 16.9])
  for (const z of [14, 18.65]) seats.push({ x, y: 0, z, yaw: z > 16 ? 0 : Math.PI });
import { dances } from './public/free-dance.js';
const emotions = new Set(['idle', 'dance', 'wave', ...dances.keys()]);
function text(value, max) {
  return typeof value === 'string' && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value)
    ? value.trim()
    : '';
}
export class EdmRoom extends Room {
  onAuth(_client, options, context) {
    return EdmRoom.verifyIdentity(context.headers, options.identity);
  }
  onCreate() {
    this.maxClients = capacity;
    this.setSeatReservationTime(seatSeconds);
    this.members = new Map();
    this.train = new DanceTrain();
    this.zones = new ManagedChannelZones();
    this.preparing = [];
    this.eventTier = 0;
    this.epoch = Date.now();
    rooms.set(this.roomId, this);
    this.ai = Array.from({ length: 5 }, (_, i) => ({
      id: 'ai-' + i,
      ai: true,
      nickname: 'AI 손님 ' + (i + 1),
      avatar: 'gold',
      x: 4 * Math.cos(i * 1.25),
      y: 0.018,
      z: 4 * Math.sin(i * 1.25),
      yaw: i * 1.25,
      action: 'dance',
    }));
    this.refreshVisitors();
    this.dirty = false;
    if (localTest) {
      this.eventSequence = 0;
      this.onMessage('preview-event', (client, input) => {
        const actor = this.member(client);
        if (!actor || !client.userData.identity.startsWith('local-test:')) return;
        if (input?.kind === 'stop') {
          this.stageEvent = null;
        } else {
          if (typeof input?.kind !== 'string' || !Object.hasOwn(effects, input.kind)) return;
          const event = { id: ++this.eventSequence, kind: input.kind, start: Date.now(), bpm:playlistPosition(playlist(),this.epoch,Date.now())?.track.bpm || 120 };
          if (event.kind === 'led') {
            const message = text(input.message, 80);
            if (!message || /[\p{Cc}\p{Cf}]/u.test(message + actor.nickname) ||
                blockedMessage(message) || blockedMessage(actor.nickname))
              return this.notice(client, '닉네임과 전광판 문구를 확인해 주세요.');
            Object.assign(event, { message, nickname: actor.nickname });
          }
          this.stageEvent = event;
        }
        this.dirty = true;
      });
    }
    this.onMessage('train', (client, command) => {
      const actor = this.member(client);
      if (!actor || !this.allowActivity(client)) return;
      if (command === 'leave') return this.leaveTrain(actor.id);
      if (!['start', 'join'].includes(command)) return;
      if (!this.train.board(actor, command))
        return this.notice(client, '기차 상태를 확인하세요. 착석 중에는 먼저 일어서 주세요.');
      const next = this.train.pose(actor.id);
      if (!this.positionMember(actor.id, actor, next)) {
        this.train.leave(actor.id);
        return this.notice(client, '열린 동선에서만 기차에 참여할 수 있습니다.');
      }
      Object.assign(actor, next);
      if (command === 'start') {
        const distance = a => Math.hypot(a.x - next.x, a.z - next.z);
        const nearby = this.ai.filter(a => a.action !== 'sit').sort((a, b) => distance(a) - distance(b));
        for (const guest of nearby.slice(0, 2)) this.train.board(guest, 'join');
        this.refreshVisitors();
      }
      client.send('place', actor);
      this.notice(client, command === 'start' ? '중앙 플로어에서 WASD로 기차를 이끄세요.' : '댄스 기차에 합류했습니다.');
      this.dirty = true;
    });
    this.onMessage('wand', (client, enabled) => {
      const actor = this.member(client);
      if (actor && typeof enabled === 'boolean' && this.allowActivity(client)) {
        actor.wand = enabled;
        this.dirty = true;
      }
    });
    this.onMessage('occupancy', (c) => c.send('occupancy', this.population()));
    this.onMessage('snapshot', (c) => c.send('snapshot', this.snapshot()));
    this.onMessage('clock', (c, sent) => {
      if (Number.isFinite(sent))
        c.send('clock', { sent, now: Date.now(), epoch: this.epoch, tracks: playlist() });
    });
    this.onMessage('move', (c, p) => this.move(c, p));
    this.onMessage('action', (c, a) => {
      const m = this.member(c);
      if (!m || !this.allowActivity(c) || !emotions.has(a) || m.seat !== null || this.train.riders.has(m.id)) return;
      m.action = a;
      this.dirty = true;
      if (a === 'wave' || a === 'dance') this.react(m, a, true);
    });
    this.onMessage('seat', (c) => {
      const m = this.member(c);
      if (!m || !this.allowActivity(c) || this.train.riders.has(m.id)) return;
      if (m.seat !== null) {
        if (!this.positionMember(c.sessionId, m, c.userData.preSeat)) return;
        Object.assign(m, c.userData.preSeat);
        m.seat = null;
        m.action = 'idle';
      } else {
        const idx = seats.findIndex(
          (s) => Math.hypot(m.x - s.x, m.z - s.z) < 2 && Math.abs(m.y - s.y) < 0.5,
        );
        if (idx < 0 || [...this.members.values()].some((other) => other.seat === idx))
          return this.notice(c, '가까운 빈 좌석이 필요합니다.');
        if (!this.positionMember(c.sessionId, m, seats[idx])) return;
        c.userData.preSeat = { x: m.x, y: m.y, z: m.z, yaw: m.yaw };
        Object.assign(m, seats[idx], { seat: idx, action: 'sit' });
      }
      this.dirty = true;
      c.send('place', m);
    });
    this.setSimulationInterval(() => {
      if (this.dirty) {
        this.broadcast('snapshot', this.snapshot());
        this.dirty = false;
      }
    }, 100);
    this.clock.setInterval(() => {
      this.tickZones(performance.now());
      this.refreshVisitors();
      for (const ai of this.ai.slice(3, 5)) if (Date.now() > (ai.until || 0)) ai.action = 'dance';
      this.dirty = true;
    }, 300);
  }
  leaveTrain(id) {
    for (const rider of this.train.leave(id)) {
      const actor = this.members.get(rider);
      if (!actor) continue; // AI resumes its usual pose on the next snapshot.
      actor.trainSlot = null;
      actor.action = 'idle';
      const client = this.clients.find(c => c.sessionId === rider);
      if (client) {
        client.userData.lastMove = Date.now();
        client.send('place', actor);
      }
    }
    this.dirty = true;
  }
  zoneStates() {
    return [this.zones.state(1), this.zones.state(2)];
  }

  tickZones(now) {
    // All geometry is prebuilt. Publish OPENING for a tick before allowing entry.
    for (const { tier, attempt } of this.preparing)
      this.zones.finishOpening(tier, attempt, true, now);
    this.preparing = this.zones.observe(now, this.eventTier);
    for (const tier of [2, 1]) {
      if (this.zones.state(tier) !== 'DRAINING') continue;
      for (const id of this.zones.drain(tier, now).movedAI) {
        const actor = this.ai.find((a) => a.id === id);
        if (actor)
          Object.assign(actor, { x: actor.x < 0 ? -4 : 4, y: 0.018, z: 1, action: 'dance' });
      }
    }
  }

  positionMember(id, from, to) {
    if (from && !permittedPath(from, to, this.zoneStates())) return false;
    const { tier, group } = edmArea(to);
    return this.zones.move('human', id, this.zones.location('human', id), tier, group);
  }

  refreshVisitors() {
    const before = new Set(this.ai.map((a) => a.id));
    const elapsed = (Date.now() - this.epoch) / 1000;
    for (let i = 0; i < 3; i++) {
      if (!this.train.riders.has(this.ai[i].id)) this.ai[i] = background(i, elapsed);
    }
    const extra = Math.min(extraGuestPlaces.length, extraVisitors, capacity - this.members.size);
    this.ai.length = 5 + extra;
    for (let i = 0; i < extra; i++) {
      if (this.ai[5 + i]) continue;
      this.ai[5 + i] = {
        id: 'floor-dancer-' + i, ai: true, nickname: 'AI 손님 ' + (6 + i),
        avatar: ['teal', 'rose', 'gold', 'indigo'][i % 4],
        ...extraGuestPlaces[i],
      };
    }
    // Two reactive dancers use the reviewed side floors once available.
    for (const [i, actor] of this.ai.entries()) {
      if (i === 3 || i === 4) {
        const sign = i === 3 ? -1 : 1;
        const side = this.zones.canEnter(1);
        Object.assign(actor, {
          x: sign * (side ? 14.6 : 4),
          y: side ? 0.045 : 0.018,
          z: side ? 6 : 1,
        });
      }
      actor.wand = i === 3 || i === 4;
      before.delete(actor.id);
      const { tier, group } = edmArea(this.train.riders.has(actor.id) ? this.train.pose(actor.id) : actor);
      if (!this.zones.move('ai', actor.id, this.zones.location('ai', actor.id), tier, group)) {
        Object.assign(actor, { x: 0, y: 0.018, z: 0, action: 'dance' });
        this.zones.move('ai', actor.id, this.zones.location('ai', actor.id), 0, 'dancefloor');
      }
    }
    for (const id of before) {
      this.train.leave(id);
      this.zones.move('ai', id, this.zones.location('ai', id), null);
    }
  }
  react(member, action, explicit = false) {
    for (const ai of this.ai.slice(3, 5)) {
      if (
        Math.hypot(ai.x - member.x, ai.z - member.z) < 4 &&
        (explicit || Date.now() > (ai.until || 0))
      ) {
        ai.action = action;
        ai.yaw = Math.atan2(ai.x - member.x, ai.z - member.z);
        ai.until = Date.now() + 2400;
      }
    }
  }
  notice(c, msg) {
    c.send('notice', msg);
  }
  member(c) {
    return this.members.get(c.sessionId);
  }
  allowActivity(c) {
    if (!c.userData.identity.startsWith('guest:')) return true;
    this.notice(c, '이 활동은 로그인 후 사용할 수 있습니다.');
    return false;
  }
  population() {
    return { channelId: this.roomId, people: this.members.size, ai: this.ai.length, capacity };
  }
  snapshot() {
    const event = this.stageEvent;
    if (event && Date.now() >= event.start + effects[event.kind].seconds * 1000) this.stageEvent = null;
    const performances = performanceStatus(this.epoch, Date.now(), playlist());
    return {
      stageEvent: this.stageEvent ?? performances.active,
      nextPerformance: performances.next,
      performanceNow: Date.now(),
      trainLeader: this.train.leader,
      actors: [...this.members.values(), ...this.ai.map(a =>
        this.train.riders.has(a.id) ? { ...a, ...this.train.pose(a.id) } : a)],
      epoch: this.epoch,
      zones: this.zoneStates(),
    };
  }
  move(c, p) {
    const m = this.member(c);
    if (!m || m.seat !== null || m.trainSlot > 0 || !p || !['x', 'y', 'z', 'yaw'].every((k) => Number.isFinite(p[k])))
      return;
    const elapsed = (Date.now() - c.userData.lastMove) / 1000;
    if (elapsed < 0.045) return;
    if (
      Math.abs(p.x) > 22.6 ||
      p.z < -21.5 ||
      p.z > 27 ||
      p.y < -0.08 ||
      p.y > 4.1 ||
      Math.hypot(p.x - m.x, p.y - m.y, p.z - m.z) > Math.min(5, elapsed * 4.5 + 0.16)
    ) {
      c.send('place', m);
      return;
    }
    if ((m.trainSlot === 0 && !onTrainFloor(p)) || !this.positionMember(c.sessionId, m, p)) {
      c.send('place', m);
      return;
    }
    const walking = Math.hypot(p.x - m.x, p.z - m.z) > 0.025;
    Object.assign(m, { x: p.x, y: p.y, z: p.z, yaw: p.yaw });
    if (m.trainSlot === 0) {
      this.train.step(p);
      for (const id of this.train.riders.keys()) {
        if (id === m.id) continue;
        const rider = this.members.get(id);
        if (!rider) continue; // AI poses are sampled directly from the train path.
        const next = this.train.pose(id);
        if (this.positionMember(id, rider, next)) Object.assign(rider, next);
        else this.leaveTrain(id);
      }
    } else if (walking) {
      m.action = 'walk';
      this.react(m, 'wave');
    } else if (m.action === 'walk') m.action = 'idle';
    c.userData.lastMove = Date.now();
    this.dirty = true;
  }
  onJoin(client, { identity, restore, transfer, expires }) {
    const old = connected.get(identity);
    if (old && (!transfer || old.room === this)) throw Error('Already joined');
    if (expires && Date.now() >= expires) throw Error('Session expired');
    if (old) {
      old.room.removeMember(old.client, false);
      old.client.leave(4001);
    }
    const previous = recent.get(identity);
    let place = restore && previous?.room === this.roomId ? previous.place : floorEntry;
    if (!this.positionMember(client.sessionId, null, place)) {
      place = floorEntry;
      this.positionMember(client.sessionId, null, place);
    }
    const m = {
      ...profile(identity),
      ...place,
      id: client.sessionId,
      ai: false,
      action: 'idle',
      seat: null,
    };
    client.userData = { identity, lastMove: Date.now() };
    this.members.set(client.sessionId, m);
    connected.set(identity, { room: this, client });
    pending.delete(identity);
    recent.delete(identity);
    if (expires)
      client.userData.expiry = this.clock.setTimeout(
        () => client.leave(4003),
        Math.max(0, expires - Date.now()),
      );
    this.refreshVisitors();
    this.broadcast('occupancy', this.population());
    this.dirty = true;
  }
  removeMember(client, remember) {
    if (!client.userData) return;
    const m = this.member(client);
    if (!m) return;
    this.leaveTrain(client.sessionId);
    client.userData.expiry?.clear();
    const { identity } = client.userData;
    this.zones.move(
      'human',
      client.sessionId,
      this.zones.location('human', client.sessionId),
      null,
    );
    this.members.delete(client.sessionId);
    if (connected.get(identity)?.client === client) connected.delete(identity);
    if (remember) {
      const { x, y, z, yaw } = m;
      const entry = { room: this.roomId, place: m.seat === null ? { x, y, z, yaw } : floorEntry };
      recent.set(identity, entry);
      setTimeout(() => {
        if (recent.get(identity) === entry) recent.delete(identity);
      }, 60000).unref();
    }
    this.refreshVisitors();
    this.broadcast('occupancy', this.population());
    this.dirty = true;
  }
  onLeave(c, consented) {
    this.removeMember(c, !consented);
  }
  onDispose() {
    rooms.delete(this.roomId);
  }
}
