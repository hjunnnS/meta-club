import { readFileSync } from 'node:fs';
import { matchMaker } from '@colyseus/core';
import { seatSeconds } from './club-room.js';
import { ReviewRoom } from './review-room.js';
// The inspection GLB owns the landmarks, walkable footprints and gateway geometry.
const bytes = readFileSync(new URL('../stage/hiphop/hiphop-empty.glb', import.meta.url));
const doc = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
const { placements, anchors } = doc.extras;
const floors = doc.meshes
  .filter((m) => m.name.startsWith('floor/'))
  .map((m) => {
    const { min, max } = doc.accessors[m.primitives[0].attributes.POSITION];
    return { name: m.name.slice(6), min, max };
  });
function area({ x, y, z }) {
  const floor = floors.find(({ name, min, max }) => {
    const h = name === 'ramp' ? (-8 - z) * 0.35 : max[1];
    return x >= min[0] && x <= max[0] && z >= min[2] && z <= max[2] && Math.abs(h - y) < 0.12;
  });
  if (!floor) return null;
  const name = floor.name;
  return {
    name,
    tier: ['battle', 'street'].includes(name)
      ? 1
      : ['crew', 'roof', 'landing', 'ramp'].includes(name)
        ? 2
        : 0,
  };
}
function point([x, y, z]) {
  return { x, y, z };
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const hiphopRooms = new Map();
const reservations = new Map();
const admitted = new Map();

// Both entry URLs share one seat per member, including while matchmaking is in flight.
export function reserveHipHop(identity, expires) {
  if (admitted.has(identity)) throw Error('already_joined');
  if (reservations.has(identity)) return reservations.get(identity);
  const release = () => {
    if (reservations.get(identity) === request) reservations.delete(identity);
  };
  const request = matchMaker.joinOrCreate('hiphop', { identity, expires }).then(seat => {
    setTimeout(release, seatSeconds * 1000).unref();
    return seat;
  }).catch(error => {
    release();
    throw error;
  });
  reservations.set(identity, request);
  return request;
}

export class HipHopRoom extends ReviewRoom {
  onCreate() {
    super.onCreate();
    this.setSeatReservationTime(seatSeconds);
  }
  onJoin(client, options) {
    if (admitted.has(options.identity)) throw Error('already_joined');
    super.onJoin(client, options);
    admitted.set(options.identity, client);
    reservations.delete(options.identity);
  }
  onLeave(client) {
    const identity = client.userData?.identity;
    if (admitted.get(identity) === client) admitted.delete(identity);
    if (this.members.has(client.sessionId)) super.onLeave(client);
  }
  registry = hiphopRooms;
  area = area;
  entry = point(anchors['입구']);
  registerActivities() {
    this.onMessage('activity', (c, key) => {
      const actor = this.members.get(c.sessionId);
      if (!actor) return;
      if (key === 'stop') {
        actor.action = 'idle';
        return;
      }
      if (
        typeof key !== 'string' ||
        !Object.hasOwn(placements, key) ||
        distance(actor, point(placements[key])) > 1.65
      )
        return c.send('notice', '활동 표시 가까이로 이동하세요.');
      actor.action = key === 'photo' ? 'pose' : 'dance';
    });
  }
}
