import assert from 'node:assert/strict';
import test from 'node:test';
import { ManagedChannelZones } from '../../app/managed-channel-zones.js';

function open(tier = 1) {
  const z = new ManagedChannelZones();
  z.observe(0, tier);
  const [a] = z.observe(10000, tier);
  assert(!z.move('human', 'early', null, 1));
  z.finishOpening(1, a.attempt, true, 10000);
  if (tier === 2) {
    const [b] = z.observe(10000, 2);
    z.finishOpening(2, b.attempt, true, 10000);
  }
  return z;
}

test('five AI move first; a person alone then an active reservation alone each block closure', () => {
  const z = open();
  z.move('human', 'resident', null, 1);
  z.move('human', 'arrival', null, 0);
  for (let i = 0; i < 5; i++) assert(z.move('ai', 'bot' + i, null, 1));
  z.observe(20000);
  z.observe(190000);
  assert.equal(z.state(1), 'DRAINING');
  assert(!z.move('human', 'arrival', 0, 1));
  assert.equal(z.location('human', 'arrival'), 0);
  assert(!z.move('ai', 'new', null, 1));
  const initial = z.drain(1, 190000);
  assert.equal(initial.movedAI.length, 5);
  assert.equal(initial.state, 'DRAINING');
  assert(initial.movedAI.every((id) => z.location('ai', id) === 0));
  assert.equal(z.location('human', 'resident'), 1);
  z.protectReservation(1, 'held');
  z.move('human', 'resident', 1, 0);
  assert.deepEqual(z.drain(1, 190001), {
    state: 'DRAINING',
    movedAI: [],
    humans: 0,
    reservations: 1,
  });
  z.releaseReservation(1, 'held');
  assert.equal(z.drain(1, 190002).state, 'CLOSED');
  assert.deepEqual(z.drain(1, 190002).movedAI, []);
  assert(!z.move('human', 'resident', 0, 1));
});

test('reservation renewal, expiry boundary and tier isolation', () => {
  const z = open(2);
  z.protectReservation(1, 'base-ticket');
  z.protectReservation(2, 'renewed', 200000);
  z.protectReservation(2, 'renewed', 210000);
  z.observe(20000);
  z.observe(190000);
  assert(z.canEnter(1));
  assert(!z.canEnter(2));
  assert.equal(z.drain(2, 209999).reservations, 1);
  assert.equal(z.drain(2, 210000).state, 'CLOSED');
  z.observe(210000);
  assert.equal(z.state(1), 'DRAINING');
  assert.equal(z.drain(1, 210000).reservations, 1);
});

test('event retains prepared zone and stale drain cannot relocate its visitors', () => {
  const z = open();
  z.move('ai', 'bot', null, 1);
  z.observe(20000);
  z.observe(190000);
  z.observe(190001, 1);
  assert.equal(z.drain(1, 190002).state, 'OPEN');
  assert.equal(z.location('ai', 'bot'), 1);
});

test('membership is the shared source for hotspot demand and admission', () => {
  const z = new ManagedChannelZones();
  for (let i = 0; i < 16; i++) z.move('human', 'p' + i, null, 0, i % 2 ? 'hall' : 'garden');
  z.observe(0);
  assert.deepEqual(z.observe(10000), []);
  for (let i = 0; i < 16; i++) z.move('human', 'p' + i, 0, 0, 'hall');
  z.observe(10001);
  assert.equal(z.observe(20001)[0].tier, 1);
  z.finishOpening(1, 1, true, 20001);
  assert(z.move('human', 'p0', 0, 1));
  assert(!z.move('human', 'p0', 0, null));
  assert.equal(z.location('human', 'p0'), 1);
});
