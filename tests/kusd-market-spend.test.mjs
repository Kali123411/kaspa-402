// Operator spending controls in the browser: the same bounds, codes and ordering as k402's SpendPolicy /
// SpendLedger (DESIGN-kusd-spend-controls.md), over a storage interface (localStorage in the page, a Map here).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpendPolicy, SpendLedger, SpendRefused, DEFAULT_POLICY, CODES } from '../lib/kusd/market/spend.mjs';

const T0 = 1_700_000_000_000;
const PAYEE = 'ab'.repeat(32);

function storage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m };
}
const ledger = (s = storage()) => new SpendLedger(s, 'kusd.market.spend.v1:test');

function refused(led, policy, code, opts) {
  const before = led.status(policy, opts.now ?? T0);
  assert.throws(() => led.reserve(policy, { cents: 5, ...opts }), (e) => e instanceof SpendRefused && e.code === code);
  assert.deepEqual(led.status(policy, opts.now ?? T0), before, 'a refusal leaves no row behind');
}

test('SpendPolicy validates like k402 and tightens the agent cap', () => {
  const p = SpendPolicy.from({ maxPerCallCents: 25, maxTotalCents: 1000, windowSeconds: 600, maxWindowCents: 200, maxWindowCalls: 20,
    maxWindowFailures: 2, allowCapabilities: ['summarize'] });
  assert.equal(p.maxPerCallCents, 25);
  assert.deepEqual(p.allowCapabilities, ['summarize']);
  assert.equal(p.cap(null), 25);
  assert.equal(p.cap(10), 10);
  assert.equal(p.cap(50), 25);
  assert.equal(SpendPolicy.from({}).cap(7), 7);
  assert.equal(SpendPolicy.from({}).cap(null), null);
  assert.equal(SpendPolicy.from({}).windowSeconds, 3600);
  assert.deepEqual(SpendPolicy.from(p.toJSON()), p);
  assert.throws(() => SpendPolicy.from({ maxTotalCents: -1 }), /maxTotalCents/);
  assert.throws(() => SpendPolicy.from({ windowSeconds: 0 }), /windowSeconds/);
  assert.throws(() => SpendPolicy.from({ maxPerCallCents: '10' }), /maxPerCallCents/);
  assert.throws(() => SpendPolicy.from({ maxPerCal: 1 }), /unknown/);
  assert.throws(() => SpendPolicy.from({ allowCapabilities: 'summarize' }), /allowCapabilities/);
  const d = SpendPolicy.from(DEFAULT_POLICY);
  assert.deepEqual([d.maxPerCallCents, d.maxWindowCents, d.maxWindowCalls, d.maxWindowFailures, d.windowSeconds, d.maxTotalCents], [25, 200, 20, 2, 3600, null]);
  assert.ok(['frozen', 'failures', 'per_call', 'total', 'window_cents', 'window_calls', 'capability'].every((c) => CODES.has(c)));
  assert.throws(() => new SpendRefused('nope', 'x', {}), /code/);
});

test('reserve counts toward total and window; settle keeps the amount and records the outcome', () => {
  const led = ledger();
  const pol = SpendPolicy.from({ maxTotalCents: 100, maxWindowCents: 50, maxWindowCalls: 10 });
  const id = led.reserve(pol, { cents: 5, provider: PAYEE.toUpperCase(), capability: 'summarize', now: T0 });
  let st = led.status(pol, T0);
  assert.equal(st.totalCents, 5);
  assert.deepEqual(st.window, { seconds: 3600, cents: 5, calls: 1, failures: 0 });
  assert.deepEqual(st.remaining, { totalCents: 95, windowCents: 45, windowCalls: 9, windowFailures: null });
  led.settle(id, { txid: 'D3'.repeat(32), http: 200 });
  st = led.status(pol, T0);
  assert.equal(st.totalCents, 5, 'settling changes the state, not the amount');
  const [row] = led.history();
  assert.equal(row.txid, 'd3'.repeat(32));
  assert.equal(row.http, 200);
  assert.equal(row.state, 'sent');
  assert.equal(row.provider, PAYEE, 'keys are kept lower case');
  assert.equal(row.capability, 'summarize');
});

test('each bound refuses with its code and leaves no row', () => {
  let led = ledger();
  let pol = SpendPolicy.from({ maxTotalCents: 12 });
  led.reserve(pol, { cents: 5, now: T0 });
  led.reserve(pol, { cents: 5, now: T0 });
  refused(led, pol, 'total', { cents: 5, now: T0 });
  led = ledger(); pol = SpendPolicy.from({ maxWindowCents: 9 });
  led.reserve(pol, { cents: 5, now: T0 });
  refused(led, pol, 'window_cents', { cents: 5, now: T0 });
  led = ledger(); pol = SpendPolicy.from({ maxWindowCalls: 1 });
  led.reserve(pol, { cents: 1, now: T0 });
  refused(led, pol, 'window_calls', { cents: 1, now: T0 });
  // failures: paid calls that were not served — an error status, or 0 = no HTTP answer after the box was built
  led = ledger(); pol = SpendPolicy.from({ maxWindowFailures: 1 });
  led.settle(led.reserve(pol, { cents: 5, now: T0 }), { txid: 'aa'.repeat(32), http: 0 });
  refused(led, pol, 'failures', { cents: 5, now: T0 });
  // an in-flight row (sent, no http yet) is not a failure
  led = ledger();
  led.settle(led.reserve(pol, { cents: 5, now: T0 }), { txid: 'aa'.repeat(32) });
  assert.equal(led.status(pol, T0).window.failures, 0);
  // frozen beats everything, including an otherwise unbounded policy
  led = ledger(); led.freeze();
  assert.equal(led.frozen, true);
  refused(led, SpendPolicy.from({}), 'frozen', { now: T0 });
  led.unfreeze();
  assert.equal(led.frozen, false);
  assert.ok(led.reserve(SpendPolicy.from({}), { cents: 1, now: T0 }) >= 1);
});

test('void frees the reservation; the window slides; equal-to-limit is allowed', () => {
  const led = ledger();
  const pol = SpendPolicy.from({ maxTotalCents: 5, maxWindowCents: 5, windowSeconds: 600 });
  const id = led.reserve(pol, { cents: 5, now: T0 });
  refused(led, pol, 'total', { cents: 1, now: T0 });
  led.void(id);
  assert.equal(led.status(pol, T0).totalCents, 0);
  assert.deepEqual(led.history().map((r) => r.state), ['void']);
  led.reserve(pol, { cents: 5, now: T0 });
  const pol2 = SpendPolicy.from({ maxWindowCents: 5, windowSeconds: 600 });   // no lifetime cap: the window is what refuses
  refused(led, pol2, 'window_cents', { cents: 5, now: T0 + 599_000 });
  assert.ok(led.reserve(pol2, { cents: 5, now: T0 + 600_000 }) >= 1, 'the first row has left the window');
  assert.equal(led.status(pol2, T0 + 600_000).window.cents, 5);
  assert.equal(led.status(pol2, T0 + 600_000).totalCents, 10);
});

test('the ledger is the memory: a second handle on the same storage sees the same spend; history is newest first', () => {
  const s = storage();
  const a = new SpendLedger(s, 'k');
  const pol = SpendPolicy.from({ maxTotalCents: 100 });
  a.settle(a.reserve(pol, { cents: 5, provider: PAYEE, capability: 'summarize', now: T0 }), { txid: 'cc'.repeat(32), http: 500 });
  a.reserve(pol, { cents: 7, now: T0 + 1 });
  const b = new SpendLedger(s, 'k');
  assert.equal(b.status(pol, T0 + 2).totalCents, 12);
  assert.equal(b.status(pol, T0 + 2).window.failures, 1);
  assert.deepEqual(b.history().map((r) => r.cents), [7, 5]);
  assert.equal(b.history(1).length, 1);
  assert.equal(b.frozen, false);
  a.freeze();
  assert.equal(new SpendLedger(s, 'k').frozen, true, 'the freeze travels with the storage');
  // a different key is a different ledger (one per wallet)
  assert.equal(new SpendLedger(s, 'other').status(pol, T0).totalCents, 0);
  // corrupt storage is treated as empty, not a crash
  s.setItem('bad', '{not json');
  assert.equal(new SpendLedger(s, 'bad').status(pol, T0).totalCents, 0);
});
