import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.CLUB_DB = join(mkdtempSync(join(tmpdir(), 'edm-zones-')), 'club.sqlite');
const { EdmRoom } = await import('../../app/club-room.js');

test('EDM opens the side floors and balcony, then protects people and reservations during contraction', () => {
  const room = new EdmRoom();
  room.roomId = 'edm-check';
  room.onMessage = room.setSimulationInterval = room.broadcast = () => {};
  room.onCreate();
  const clients = Array.from({ length: 40 }, (_, i) => {
    const client = { sessionId: 'u' + i, send() {} };
    room.onJoin(client, { identity: 'local-test:' + i });
    return client;
  });
  const west = { x: -14.6, y: 0.045, z: 6 },
    base = { x: -14.6, y: 0, z: 0.2 };
  const ramp = { x: -14.6, y: 0.5, z: -1 },
    deck = { x: -14.6, y: 4, z: -13 };
  const relocate = (id, to) => room.positionMember(id, null, to);
  assert.equal(relocate('u0', west), false);
  for (const now of [0, 10000, 10001, 10002]) room.tickZones(now);
  assert.deepEqual(room.snapshot().zones, ['OPEN', 'OPEN']);
  room.refreshVisitors();
  assert.equal(room.zones.location('ai', 'ai-3'), 1);
  function walk(client, to) {
    const m = room.member(client);
    const start = { ...m };
    const steps = Math.ceil(Math.hypot(to.x - m.x, to.y - m.y, to.z - m.z) / 2);
    for (let i = 1; i <= steps; i++) {
      client.userData.lastMove = Date.now() - 1000;
      const p = { yaw: 0 };
      for (const axis of ['x', 'y', 'z'])
        p[axis] = start[axis] + ((to[axis] - start[axis]) * i) / steps;
      room.move(client, p);
    }
    return Math.hypot(m.x - to.x, m.y - to.y, m.z - to.z) < 0.001;
  }
  for (const point of [west, base, ramp, { ...deck, z: -8 }, deck]) assert(walk(clients[0], point));
  assert(walk(clients[1], base));
  assert(room.zones.protectReservation(2, 'held'));
  for (const client of clients.slice(2)) room.onLeave(client, true);
  room.tickZones(11000);
  room.tickZones(190003);
  assert.deepEqual(room.zoneStates(), ['OPEN', 'DRAINING']);
  assert.equal(walk(clients[1], ramp), false);
  assert.equal(room.member(clients[0]).z, deck.z);
  for (const point of [{ ...deck, z: -8 }, ramp, base]) assert(walk(clients[0], point));
  room.tickZones(190004);
  assert.equal(room.zones.state(2), 'DRAINING');
  room.zones.releaseReservation(2, 'held');
  room.tickZones(190005);
  room.tickZones(190006);
  assert.deepEqual(room.zoneStates(), ['CLOSED', 'CLOSED']);
  assert.equal(room.zones.location('ai', 'ai-3'), 0);
  assert.equal(room.zones.location('ai', 'ai-4'), 0);
  assert.equal(room.snapshot().actors.filter((a) => a.ai).length, 5);
  for (const client of clients.slice(0, 2)) room.onLeave(client, true);
  room.clock.clear();
  room.onDispose();
});
