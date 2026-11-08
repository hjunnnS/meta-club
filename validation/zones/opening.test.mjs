import assert from 'node:assert/strict';
import test from 'node:test';
import { ZoneOpening, demandByThresholds } from '../../app/zone-opening.js';

// Small synthetic numbers for checking boundaries, not deployment defaults.
const byCount = demandByThresholds({
  humans: { openAt: 5, shrinkAt: 2 },
  hotspot: { openAt: 4, shrinkAt: 1 },
});
const sample = (humans, hotspot = 0, event = false, ai = 5) => ({ humans, hotspot, event, ai });
const makeZone = () =>
  new ZoneOpening({
    openDelayMs: 10,
    shrinkDelayMs: 20,
    minOpenMs: 100,
    demand: (s) => (s.event ? 'expand' : byCount(s)),
  });

test('independent count, hotspot, event and AI inputs; no implicit production thresholds', () => {
  for (const trigger of [sample(5), sample(4, 4), sample(0, 0, true)]) {
    const z = makeZone();
    z.observe(trigger, 0);
    assert.equal(z.observe(trigger, 10), 1);
  }
  const z = makeZone();
  z.observe(sample(1), 0);
  z.observe(sample(1, 0, false, 50), 100);
  assert.equal(z.state, 'CLOSED');
  assert.throws(() => demandByThresholds({ humans: { openAt: 2, shrinkAt: 2 } }));
});

test('hold band resets candidate; only a matching ready attempt admits visitors', () => {
  const z = makeZone();
  z.observe(sample(5), 0);
  z.observe(sample(4), 9);
  z.observe(sample(5), 10);
  assert.equal(z.observe(sample(5), 19), null);
  const first = z.observe(sample(5), 20);
  assert.equal(z.canEnter, false);
  assert.equal(z.observe(sample(5), 21), null);
  assert(z.finishOpening(first, false, 22));
  assert.equal(z.state, 'CLOSED');
  z.observe(sample(5), 23);
  const second = z.observe(sample(5), 33);
  assert.equal(z.finishOpening(first, true, 34), false);
  assert(z.finishOpening(second, true, 35));
  assert(z.canEnter);
});

test('minimum open time and continuous low demand must both elapse before draining', () => {
  const z = makeZone();
  z.observe(sample(5), 0);
  z.finishOpening(z.observe(sample(5), 10), true, 12);
  z.observe(sample(2, 1), 13);
  z.observe(sample(2, 1), 111);
  assert(z.canEnter);
  z.observe(sample(3, 1), 112);
  z.observe(sample(2, 1), 113);
  z.observe(sample(2, 1), 132);
  assert(z.canEnter);
  z.observe(sample(2, 1), 133);
  assert.equal(z.state, 'DRAINING');
  assert.equal(z.canEnter, false);
  z.observe(sample(0), 1000);
  assert.equal(z.state, 'DRAINING');
  assert.throws(() => z.observe(sample(0), 999));
});
