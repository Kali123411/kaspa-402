// Final-review fixes: the sheet shows exactly what gets signed, a contention rebuild is reviewed again,
// net amounts come from the built transaction, and vault boxes must be legitimate, not just on chain.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as kc from '../lib/kusd/wasm/kusd_client_wasm.mjs';
import { applyPreview } from '../lib/kusd/app/sheet.mjs';
import { runFlow, ContentionError } from '../lib/kusd/app/flow.mjs';
import { describeTx } from '../lib/kusd/app/review.mjs';
import { loadClient } from '../lib/kusd/client.mjs';
import { loadState } from '../lib/kusd/app/state.mjs';

kc.initSync({ module: readFileSync(new URL('../lib/kusd/wasm/kusd_client_wasm_bg.wasm', import.meta.url)) });
const golden = JSON.parse(readFileSync(new URL('./fixtures/kusd-golden.json', import.meta.url), 'utf8'));
const buildWasm = (req) => { const o = JSON.parse(kc.build(JSON.stringify(req))); if (o.error) throw new Error(o.error); return o; };

test('a late preview does not land in a newer sheet', () => {
  const redeem = { id: 2, flow: 'swap_out', status: 'building' };
  assert.equal(applyPreview(redeem, 1, { built: { txid: 'buy' } }), redeem);
  assert.deepEqual(applyPreview(redeem, 2, { built: { txid: 'redeem' } }), { ...redeem, built: { txid: 'redeem' }, status: 'review' });
  assert.equal(applyPreview(null, 1, { built: {} }), null);
});

test('a contention rebuild is not broadcast unseen', async () => {
  const req = golden.cases.swap_in.request;
  const ctx = { protocol: req.protocol, gate: req.gate, coins: req.coins, clock: req.clock + 5, testnet: true };
  const reviewed = buildWasm(req);
  const sent = [];
  const err = await runFlow({
    flow: 'swap_in', params: { cents: 400 }, secret: req.secret, prebuilt: reviewed,
    getState: async () => ctx, build: buildWasm,
    submit: async (b) => { sent.push(b.txid); throw new Error('transaction input #0 is already spent'); },
    publish: async () => {},
  }).catch((e) => e);
  assert.ok(err instanceof ContentionError, String(err));
  assert.deepEqual(sent, [reviewed.txid]);
  assert.notEqual(err.built.txid, reviewed.txid);
  assert.equal(err.built.txid, buildWasm({ ...req, clock: req.clock + 5 }).txid);
});

test('the review states what the user pays and receives, from the built transaction', () => {
  const req = golden.cases.swap_in.request;
  const owner = JSON.parse(kc.wallet(req.secret, true)).xonly;
  const d = describeTx(buildWasm(req), { request: req, owner });
  // 400 cents at 262 = 152.6718 KAS to the PSM + 1.5 KAS in the new kUSD box + 0.1 KAS fee
  assert.equal(d.net.kasSompi, -(15267180000 + 150000000 + 10000000 + 150000));
  assert.equal(d.net.kusdCents, 400);
  const redeem = golden.cases.swap_out.request;
  const r = describeTx(buildWasm(redeem), { request: redeem, owner: JSON.parse(kc.wallet(redeem.secret, true)).xonly });
  assert.equal(r.net.kusdCents, -redeem.params.holder.state.amount);
  assert.ok(r.net.kasSompi > 0);
});

test('a vault with attacker-chosen genesis state is not shown as yours', async () => {
  const { boxAddress } = loadClient();
  const hex = (a) => Buffer.from(a).toString('hex');
  const proto = golden.cases.mint.request.protocol;
  const real = golden.cases.mint.request.params.vault;
  const owner = hex(real.state.owner);
  const pins = Object.fromEntries(['oracle', 'psm', 'budget', 'authority', 'surplus', 'factory'].map((k) => [k, hex(proto[k].covid)]));
  const entry = (kind, l) => ({ kind, covid: hex(l.covid), outpoint: l.outpoint, value: l.value, state: l.state });
  const fake = (state, value = real.value, tx = 'f1') => entry('vault', { ...real, state: { ...real.state, ...state }, value, outpoint: { transactionId: tx.repeat(32), index: 0 } });
  const vaults = [
    entry('vault', real),
    fake({ collateral: 3_999_900_000_000 }, real.value, 'f1'),        // claims far more than the box holds
    fake({ oracle_id: Array(32).fill(9) }, real.value, 'f2'),          // wired to another oracle
    fake({ debt: -5 }, real.value, 'f3'),
  ];
  // the protocol's boxes plus its price receipts (the golden protocol carries them as a list)
  const boxes = Object.entries(proto).filter(([k, l]) => k !== 'receipts' && l);
  const receipts = (proto.receipts || []).map((l) => entry('receipt', l));
  const onChain = [...boxes.map(([k, l]) => entry(k, l)), ...receipts, ...vaults];
  const s = await loadState({
    relayUrl: 'https://relay.test/state', owner, pins, boxAddress,
    fetchJson: async () => ({ protocol: { ...Object.fromEntries(boxes.map(([k, l]) => [k, entry(k, l)])), receipts }, holders: [], vaults }),
    getUtxos: async (address) => onChain.filter((e) => boxAddress(e.kind, e.state) === address).map((e) => ({ outpoint: e.outpoint, amount: e.value, covenantId: e.covid })),
  });
  assert.deepEqual(s.vaults, [real]);
});

test('the copy does not claim signatures stay in the page', () => {
  const strip = readFileSync(new URL('../components/kusd/app/StatusStrip.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(strip, /signatures never leave/);
  assert.match(strip, /keys never leave this page/);
});
