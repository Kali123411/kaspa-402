// The app's pins and gate come from the committed snapshot through one function, covering every kind loadState checks.
// Regression: useKusd.js kept its own five-kind list after the factory became a checked kind (c2e939b), so PINS.factory
// was undefined, every visit ended in "factory: not under the pinned factory covenant", and the gate carried undefined.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { appPins, appGate, STATE_KINDS } from '../lib/kusd/app/state.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const snapshot = JSON.parse(read('public/kusd/snapshot.json'));

test('the pins cover every kind the state check pins, the factory included', () => {
  const pins = appPins(snapshot);
  assert.deepEqual(Object.keys(pins).sort(), [...STATE_KINDS].sort());
  assert.ok(STATE_KINDS.includes('factory'));
  assert.equal(pins.factory, snapshot.covenants.factory.covid);
  for (const k of STATE_KINDS) assert.match(pins[k], /^[0-9a-f]{64}$/, k);
});

test('the gate is the five covids in the order the builders expect, none missing', () => {
  const pins = appPins(snapshot);
  assert.deepEqual(appGate(pins), [pins.oracle, pins.psm, pins.surplus, pins.budget, pins.factory]);
});

test('a snapshot without a pinned kind is refused, not pinned to undefined', () => {
  const { factory, ...rest } = snapshot.covenants;
  assert.throws(() => appPins({ covenants: rest }), /factory/);
  assert.throws(() => appGate({ oracle: 'a'.repeat(64) }), /psm/);
});

test('the app hook takes its pins and gate from the state module', () => {
  const s = read('components/kusd/app/useKusd.js');
  assert.match(s, /appPins\(snapshot\)/);
  assert.match(s, /appGate\(PINS\)/);
  assert.ok(!/const KINDS = \[/.test(s), 'no second list of kinds to fall out of step');
});
