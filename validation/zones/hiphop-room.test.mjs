import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.CLUB_DB = join(mkdtempSync(join(tmpdir(), 'hiphop-review-')), 'club.sqlite');
const { HipHopRoom } = await import('../../app/hiphop-room.js');

test('hiphop roof protects a visitor and an existing reservation while winding down', () => {
  const room = new HipHopRoom();
  room.roomId = 'roof-review';
  room.onMessage = room.setSimulationInterval = () => {};
  room.onCreate();
  const clients = ['walker', 'waiting'].map((sessionId) => {
    const c = { sessionId, send() {} };
    room.clients.push(c);
    room.onJoin(c, { identity: 'local-test:' + sessionId, expires: Date.now() + 60000 });
    return c;
  });
  function walk(c, x, y, z) {
    const actor = room.members.get(c.sessionId),
      from = { ...actor };
    const count = Math.max(1, Math.ceil(Math.hypot(x - from.x, y - from.y, z - from.z) / 1.5));
    for (let i = 1; i <= count; i++) {
      const f = i / count;
      c.userData.lastMove = performance.now() - 1000;
      room.move(c, {
        x: from.x + (x - from.x) * f,
        y: from.y + (y - from.y) * f,
        z: from.z + (z - from.z) * f,
        yaw: 0,
      });
    }
    return Math.hypot(x - actor.x, y - actor.y, z - actor.z) < 0.01;
  }
  try {
    for (const c of clients)
      for (const pt of [
        [0, 0, 12],
        [-7, 0, 12],
        [-7, 0, -8],
      ])
        assert(walk(c, ...pt));
    const [walker, waiting] = clients;
    assert.equal(walk(waiting, -7, 0.7, -10), false);
    room.eventTier = 2;
    for (const now of [0, 10000, 10001, 10002]) room.tickZones(now);
    for (const pt of [
      [-7, 3.5, -18],
      [-7, 3.5, -19],
      [-13, 3.5, -19],
      [-13, 3.5, -16],
    ])
      assert(walk(walker, ...pt));
    assert(room.zones.protectReservation(2, 'existing'));
    room.eventTier = 0;
    room.tickZones(11000);
    room.tickZones(190003);
    assert.equal(room.snapshot().zones[1], 'DRAINING');
    assert.equal(walk(waiting, -7, 0.7, -10), false);
    assert.equal(room.members.get(walker.sessionId).y, 3.5);
    for (const pt of [
      [-13, 3.5, -19],
      [-7, 3.5, -19],
      [-7, 3.5, -18],
      [-7, 0, -8],
      [-7, 0, -7],
    ])
      assert(walk(walker, ...pt));
    room.tickZones(190004);
    assert.equal(room.zones.state(2), 'DRAINING');
    room.zones.releaseReservation(2, 'existing');
    room.tickZones(190005);
    room.tickZones(190006);
    assert.deepEqual(room.snapshot().zones, ['CLOSED', 'CLOSED']);
  } finally {
    clients.forEach((c) => room.onLeave(c));
    room.clock.clear();
    room.onDispose();
  }
});
