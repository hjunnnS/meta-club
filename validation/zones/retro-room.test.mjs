import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.CLUB_DB = join(mkdtempSync(join(tmpdir(), 'retro-room-')), 'test.sqlite');
const { RetroRoom } = await import('../../app/retro-room.js');

test('wing transitions preserve dancers and existing reservations and reject new entry', () => {
  const room = new RetroRoom(),
    handlers = {};
  room.roomId = 'retro-review';
  room.onMessage = (key, fn) => (handlers[key] = fn);
  room.setSimulationInterval = () => {};
  room.onCreate();
  const clients = ['dancer', 'newcomer'].map((sessionId) => {
    const c = { sessionId, send() {} };
    room.clients.push(c);
    room.onJoin(c, { identity: 'local-test:' + sessionId, expires: Date.now() + 60000 });
    return c;
  });
  function walk(c, x, z) {
    const actor = room.members.get(c.sessionId),
      start = { ...actor };
    const n = Math.max(1, Math.ceil(Math.hypot(x - start.x, z - start.z) / 1.6));
    for (let i = 1; i <= n; i++) {
      c.userData.lastMove = performance.now() - 1000;
      room.move(c, {
        x: start.x + ((x - start.x) * i) / n,
        y: 0,
        z: start.z + ((z - start.z) * i) / n,
        yaw: 0,
      });
    }
    return Math.hypot(actor.x - x, actor.z - z) < 0.01;
  }
  try {
    const [dancer, newcomer] = clients;
    for (const c of clients) assert(walk(c, 0, -4));
    assert(!walk(newcomer, 12, -4));
    handlers.activity(newcomer, 'danceB');
    assert.equal(room.members.get('newcomer').action, 'idle');
    room.eventTier = 2;
    for (const n of [0, 10000, 10001, 10002]) room.tickZones(n);
    assert(walk(dancer, 12, -4));
    handlers.activity(dancer, 'danceB');
    assert.equal(room.members.get('dancer').action, 'disco');
    assert(room.zones.protectReservation(2, 'existing'));
    room.eventTier = 0;
    room.tickZones(11000);
    room.tickZones(190003);
    assert.equal(room.zones.state(2), 'DRAINING');
    assert(!walk(newcomer, 12, -4));
    assert.equal(room.members.get('dancer').action, 'disco');
    handlers.activity(dancer, 'stop');
    assert(walk(dancer, 0, -4));
    room.tickZones(190004);
    assert.equal(room.zones.state(2), 'DRAINING');
    room.zones.releaseReservation(2, 'existing');
    room.tickZones(190005);
    room.tickZones(190006);
    assert.deepEqual(room.snapshot().zones, ['CLOSED', 'CLOSED']);
  } finally {
    for (const c of clients) room.onLeave(c);
    room.clock.clear();
    room.onDispose();
  }
});
