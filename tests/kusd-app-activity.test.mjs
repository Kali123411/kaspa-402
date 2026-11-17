// Activity log, recipients, swap limits, broadcasting exactly what was reviewed, and the tabs' copy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as kc from '../lib/kusd/wasm/kusd_client_wasm.mjs';
import { record, list, ACTIVITY_KEY } from '../lib/kusd/app/activity.mjs';
import { recipientKey } from '../lib/kusd/app/recipient.mjs';
import { swapInLimits } from '../lib/kusd/app/quotes.mjs';
import { runFlow } from '../lib/kusd/app/flow.mjs';

kc.initSync({ module: readFileSync(new URL('../lib/kusd/wasm/kusd_client_wasm_bg.wasm', import.meta.url)) });
const golden = JSON.parse(readFileSync(new URL('./fixtures/kusd-golden.json', import.meta.url), 'utf8'));

function memoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), raw: m };
}

test('activity is listed newest first', () => {
  const s = memoryStorage();
  record(s, 'k1', { txid: 'a'.repeat(64), flow: 'swap_in', at: 1, summary: 'one' });
  record(s, 'k1', { txid: 'b'.repeat(64), flow: 'mint', at: 2, summary: 'two' });
  assert.deepEqual(list(s, 'k1').map((e) => e.summary), ['two', 'one']);
});

test('activity keeps the latest 200', () => {
  const s = memoryStorage();
  for (let i = 0; i < 205; i++) record(s, 'k1', { txid: i.toString(16).padStart(64, '0'), flow: 'send', at: i, summary: String(i) });
  const l = list(s, 'k1');
  assert.equal(l.length, 200);
  assert.equal(l[0].summary, '204');
  assert.equal(l[199].summary, '5');
});

test('a corrupted activity value resets', () => {
  const s = memoryStorage({ [ACTIVITY_KEY]: '{not json' });
  assert.deepEqual(list(s, 'k1'), []);
  record(s, 'k1', { txid: 'c'.repeat(64), flow: 'close', at: 3, summary: 'x' });
  assert.equal(list(s, 'k1').length, 1);
  assert.deepEqual(list(memoryStorage({ [ACTIVITY_KEY]: '{"k1":"not a list"}' }), 'k1'), []);
});

test('storage that throws does not break the app', () => {
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.deepEqual(list(broken, 'k1'), []);
  assert.doesNotThrow(() => record(broken, 'k1', { txid: 'd'.repeat(64), flow: 'send', at: 1, summary: '' }));
});

test('recipients: x-only keys and Schnorr wallet addresses', () => {
  const key = '4d4b6cd1361032ca9bd2aeb9d900aa4d45d9ead80ac9423374c451a7254d0766';
  const scriptOf = (addr) => {
    if (addr === 'kaspatest:good') return `20${key}ac`;
    if (addr === 'kaspatest:ecdsa') return `21${'02'}${key}ab`;
    throw new Error('Invalid address');
  };
  assert.equal(recipientKey(key, scriptOf), key);
  assert.equal(recipientKey(` ${key.toUpperCase()} `, scriptOf), key);
  assert.equal(recipientKey('kaspatest:good', scriptOf), key);
  assert.throws(() => recipientKey('kaspatest:ecdsa', scriptOf), /Schnorr/);
  assert.throws(() => recipientKey('kaspa:qmainnet', scriptOf), /TN10/);
  assert.throws(() => recipientKey('nonsense', scriptOf), /address/);
});

test('swap-in limits: PSM headroom and the refilled mint budget', () => {
  const p = golden.cases.swap_in.request.protocol;
  const l = swapInLimits(p, p.budget.state.last + 432_000); // half a day after the last refill
  assert.equal(l.psmHeadroomCents, p.psm.state.ceiling - p.psm.state.minted);
  assert.equal(l.budgetCents, Math.min(p.budget.state.limit, p.budget.state.available + Math.floor(p.budget.state.limit / 2)));
  assert.equal(l.maxCents, Math.min(l.psmHeadroomCents, l.budgetCents));
});

test('a reviewed transaction is broadcast as reviewed', async () => {
  const req = golden.cases.swap_in.request;
  const reviewed = JSON.parse(kc.build(JSON.stringify(req)));
  let builds = 0;
  let sent;
  const r = await runFlow({
    flow: 'swap_in', params: { cents: 400 }, secret: req.secret, prebuilt: reviewed,
    getState: async () => { throw new Error('no fresh read needed'); },
    build: () => { builds++; return reviewed; },
    submit: async (b) => { sent = b; },
    publish: async () => {},
  });
  assert.equal(builds, 0);
  assert.equal(sent, reviewed);
  assert.equal(r.txid, reviewed.txid);
});

test('the swap tab names which price applies', () => {
  const swap = readFileSync(new URL('../components/kusd/app/SwapTab.jsx', import.meta.url), 'utf8');
  assert.match(swap, /mint price/);
  assert.match(swap, /liquidation price/);
});
