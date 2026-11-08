import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { socialTables } from '../../stage/social/tables.js';

process.env.CLUB_DB = join(mkdtempSync(join(tmpdir(), 'social-room-')), 'test.sqlite');
const { SocialRoom } = await import('../../app/social-room.js');
const bytes = readFileSync(new URL('../../stage/social/social-empty.glb', import.meta.url));
const { extras } = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
test('terrace keeps its seated guest and reservation; seats and chat stay isolated', () => {
  const room = new SocialRoom(),
    handlers = {};
  room.roomId = 'social-check';
  room.onMessage = (kind, fn) => (handlers[kind] = fn);
  room.setSimulationInterval = () => {};
  room.onCreate();
  const clients = ['a', 'b', 'c'].map((sessionId) => {
    const c = {
      sessionId,
      messages: [],
      send(k, v) {
        this.messages.push([k, v]);
      },
    };
    room.clients.push(c);
    room.onJoin(c, { identity: 'local-test:' + sessionId, expires: Date.now() + 60000 });
    return c;
  });
  const [a, b, c] = clients;
  function walk(c, pt) {
    const actor = room.members.get(c.sessionId),
      from = [actor.x, actor.y, actor.z];
    const n = Math.max(1, Math.ceil(Math.hypot(...pt.map((x, i) => x - from[i])) / 1.5));
    for (let i = 1; i <= n; i++) {
      const [x, y, z] = pt.map((v, k) => from[k] + ((v - from[k]) * i) / n);
      c.userData.lastMove = performance.now() - 1000;
      room.move(c, { x, y, z, yaw: 0 });
    }
    return Math.hypot(actor.x - pt[0], actor.y - pt[1], actor.z - pt[2]) < 0.01;
  }
  const tables = socialTables(extras);
  const sit = (client, seat) => {
    assert(walk(client, [seat.x, seat.y, seat.z]));
    handlers.sit(client, seat.id);
  };
  try {
    room.eventTier = 2;
    for (const n of [0, 10000, 10001, 10002]) room.tickZones(n);
    for (const client of clients)
      for (const pt of extras.reviewRoute.slice(1, 8)) assert(walk(client, pt));
    const roof = tables.find((t) => t.id === 'roof'),
      garden = tables.find((t) => t.id === 'garden');
    sit(c, garden.seats[0]);
    for (const client of [a, b])
      for (const pt of extras.gateways['garden-roof']) assert(walk(client, pt));
    sit(a, roof.seats[0]);
    sit(b, roof.seats[0]);
    assert(!room.members.get('b').seat);
    sit(b, roof.seats[1]);
    handlers['table-chat'](a, 'hello');
    assert(b.messages.some(([k]) => k === 'table-chat'));
    assert(!c.messages.some(([k]) => k === 'table-chat'));
    assert(!walk(a, extras.zones.roof.center));
    room.onLeave(b);
    assert(room.zones.protectReservation(2, 'held'));
    room.eventTier = 0;
    room.tickZones(11000);
    room.tickZones(190003);
    assert.equal(room.zones.state(2), 'DRAINING');
    assert.equal(room.members.get('a').seat, roof.seats[0].id);
    handlers.stand(c);
    assert(walk(c, extras.zones.garden.center));
    const [low, high] = extras.gateways['garden-roof'];
    assert(walk(c, low));
    assert(!walk(c, high));
    handlers.stand(a);
    assert(walk(a, high));
    assert(walk(a, low));
    assert(walk(a, extras.zones.garden.center));
    room.tickZones(190004);
    assert.equal(room.zones.state(2), 'DRAINING');
    room.zones.releaseReservation(2, 'held');
    room.tickZones(190005);
    assert.equal(room.zones.state(2), 'CLOSED');
  } finally {
    for (const client of clients) if (room.members.has(client.sessionId)) room.onLeave(client);
    room.clock.clear();
    room.onDispose();
  }
});
