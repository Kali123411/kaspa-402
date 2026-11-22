// Mainnet work items 5 and 6 in the app: the swap-in fee rises as the day's mint budget empties (psm.ag
// surge_fee) and a vault with debt needs 5 KAS (vault.ag MIN_COLLATERAL, enough for a full liquidation).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as kc from '../lib/kusd/wasm/kusd_client_wasm.mjs';
import { swapInQuote, swapInRate, fundingNeed, MIN_COLLATERAL } from '../lib/kusd/app/quotes.mjs';
import { loadClient } from '../lib/kusd/client.mjs';
import { loadState } from '../lib/kusd/app/state.mjs';

kc.initSync({ module: readFileSync(new URL('../lib/kusd/wasm/kusd_client_wasm_bg.wasm', import.meta.url)) });
const golden = JSON.parse(readFileSync(new URL('./fixtures/kusd-golden.json', import.meta.url), 'utf8'));
const build = (req) => { const o = JSON.parse(kc.build(JSON.stringify(req))); if (o.error) throw new Error(o.error); return o; };
const oracle = { price: 262, mint: 262, liq: 262 };
const HOLDER_VALUE = 150_000_000, FEE = 10_000_000;

test('the quote follows the budget curve', () => {
  const kas = 15_267_180_000; // 400c at 262
  const units = kas / 10_000;
  assert.equal(swapInQuote(400, oracle, 50, { limit: 1_000, avail: 1_000 }).fee, units * 50, 'above half: flat');
  assert.equal(swapInQuote(400, oracle, 50, { limit: 1_000, avail: 500 }).fee, Math.floor(units * 130_000 / 1_000), '500 -> 100: 130 bps');
  assert.equal(swapInQuote(400, oracle, 50, { limit: 1_000, avail: 700 }).fee, Math.floor(units * 70_000 / 1_000), 'across half: 70 bps');
  assert.equal(swapInQuote(400, oracle, 300, { limit: 1_000, avail: 400 }).fee, units * 300, 'spread over the top: no surge');
  assert.equal(swapInQuote(400, oracle, 50).fee, units * 50, 'no budget given: the flat spread');
});

test('the surge quote is what the WASM builder charges', () => {
  const req = golden.cases.swap_in_surge.request;
  const built = build(req);
  // the fee stays in the PSM box: its fees counter rises by exactly the fee
  const psm = built.created.find((c) => c.kind === 'psm');
  const fee = psm.state.fees - req.protocol.psm.state.fees;
  const q = swapInQuote(400, req.protocol.oracle.state, 50, { limit: 1_000, avail: 700 });
  assert.equal(q.fee, fee);
  assert.equal(fundingNeed('swap_in', { cents: 400 }, req.protocol, req.clock), q.total + HOLDER_VALUE + FEE + 150_000);
});

test('the current rate is shown from the refilled budget', () => {
  const p = structuredClone(golden.cases.swap_in_surge.request.protocol);
  assert.equal(swapInRate(p, p.budget.state.last), 50, '70% left: the flat 0.50%');
  p.budget.state.available = 250;
  assert.equal(swapInRate(p, p.budget.state.last), 150, 'a quarter left: halfway up the line to 2.50%');
  p.budget.state.available = 0;
  assert.equal(swapInRate(p, p.budget.state.last), 250);
  p.psm.state.spread = 0;
  assert.equal(swapInRate(p, p.budget.state.last), 0, 'fee switch off: no fee at all');
});

test('a vault with debt needs 5 KAS; a debt-free one is still shown to close', async () => {
  assert.equal(MIN_COLLATERAL, 500_000_000);
  const { boxAddress } = loadClient();
  const hex = (a) => Buffer.from(a).toString('hex');
  const proto = golden.cases.mint.request.protocol;
  const real = golden.cases.mint.request.params.vault;
  const owner = hex(real.state.owner);
  const pins = Object.fromEntries(['oracle', 'psm', 'budget', 'authority', 'surplus', 'factory'].map((k) => [k, hex(proto[k].covid)]));
  const entry = (kind, l) => ({ kind, covid: hex(l.covid), outpoint: l.outpoint, value: l.value, state: l.state });
  const mk = (state, tx) => entry('vault', { ...real, state: { ...real.state, ...state }, value: 100_000_000 + state.collateral, outpoint: { transactionId: tx.repeat(32), index: 0 } });
  const small = mk({ collateral: 499_999_999, debt_mc: 100_000 }, 'a1');
  const five = mk({ collateral: 500_000_000, debt_mc: 100_000 }, 'a2');
  const debtFree = mk({ collateral: 300_000_000, debt_mc: 0 }, 'a3');
  const vaults = [small, five, debtFree];
  // the protocol's boxes plus its price receipts (the golden protocol carries them as a list)
  const boxes = Object.entries(proto).filter(([k, l]) => k !== 'receipts' && l);
  const receipts = (proto.receipts || []).map((l) => entry('receipt', l));
  const onChain = [...boxes.map(([k, l]) => entry(k, l)), ...receipts, ...vaults];
  const s = await loadState({
    relayUrl: 'https://relay.test/state', owner, pins, boxAddress,
    fetchJson: async () => ({ protocol: { ...Object.fromEntries(boxes.map(([k, l]) => [k, entry(k, l)])), receipts }, holders: [], vaults }),
    getUtxos: async (address) => onChain.filter((e) => boxAddress(e.kind, e.state) === address).map((e) => ({ outpoint: e.outpoint, amount: e.value, covenantId: e.covid })),
  });
  assert.deepEqual(s.vaults.map((v) => v.state.collateral).sort(), [300_000_000, 500_000_000]);
});

test('a huge low-price buy is priced without overflow, as in the covenant', () => {
  // $400M at $0.01/KAS emptying a full $400M budget at 2 bps: 64 bps over the whole buy (kusd-client test)
  const q = swapInQuote(40_000_000_000, { price: 100, mint: 100, liq: 100 }, 2, { limit: 40_000_000_000, avail: 40_000_000_000 });
  assert.equal(BigInt(q.sompi) * 64n / 10_000n, BigInt(25_600_000_000_000_000));
  assert.equal(q.fee, 25_600_000_000_000_000);
});
