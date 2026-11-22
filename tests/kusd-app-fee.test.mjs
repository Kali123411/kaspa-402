// The PSM fee switch in the app: quotes, funding needs and the review sheet follow the covenant's fee
// entries (fee = kas * spread_bps / 10000, to the surplus box).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as kc from '../lib/kusd/wasm/kusd_client_wasm.mjs';
import { swapInQuote, swapOutQuote, fundingNeed } from '../lib/kusd/app/quotes.mjs';
import { describeTx } from '../lib/kusd/app/review.mjs';
import { relayEntries } from '../lib/kusd/app/flow.mjs';

kc.initSync({ module: readFileSync(new URL('../lib/kusd/wasm/kusd_client_wasm_bg.wasm', import.meta.url)) });
const golden = JSON.parse(readFileSync(new URL('./fixtures/kusd-golden.json', import.meta.url), 'utf8'));
const build = (req) => { const o = JSON.parse(kc.build(JSON.stringify(req))); if (o.error) throw new Error(o.error); return o; };
const oracle = { price: 262, mint: 262, liq: 262 };
const HOLDER_VALUE = 150_000_000, FEE = 10_000_000; // a new holder box: 1 KAS floor + 0.5 KAS for its own fee

test('fee quotes mirror the covenant', () => {
  assert.deepEqual(swapInQuote(400, oracle, 50), { sompi: 15_267_180_000, fee: 76_335_900, total: 15_343_515_900, price: 262 });
  const gross = 15_267_170_000; // sompi_of(400, 262)
  const fee = Math.floor(gross * 50 / 10000);
  assert.deepEqual(swapOutQuote(400, oracle, 50), { sompi: gross, fee, net: gross - fee, price: 262, paidCents: 400, coveragePct: 100 });
});

test('fee quote follows the protocol spread', () => {
  assert.equal(swapInQuote(400, oracle).fee, 0);
  assert.equal(swapInQuote(400, oracle, 0).total, 15_267_180_000);
  assert.equal(swapOutQuote(400, oracle, 0).net, 15_267_170_000);
});

test('funding need includes the fee', () => {
  const p = structuredClone(golden.cases.swap_in_fee.request.protocol);
  assert.equal(fundingNeed('swap_in', { cents: 400 }, p), 15_343_515_900 + HOLDER_VALUE + FEE);
});

test('describe_fee_swap_in', () => {
  const req = golden.cases.swap_in_fee.request;
  const owner = JSON.parse(kc.wallet(req.secret, true)).xonly;
  const d = describeTx(build(req), { request: req, owner });
  assert.equal(d.net.kasSompi, -(15_267_180_000 + 76_335_900 + HOLDER_VALUE + FEE));
  // the fee stays in the PSM box (fees_sompi) until swept; the surplus is not touched
  assert.ok(!d.inputs.some((i) => i.what === 'surplus (PSM fee)'));
  const psmIn = d.inputs.find((i) => i.what === 'PSM reserve');
  const psmOut = d.outputs.find((o) => o.what === 'PSM reserve');
  assert.equal(psmOut.sompi - psmIn.sompi, 15_267_180_000 + 76_335_900);
});

test('a fee swap publishes the PSM box carrying its held fee', () => {
  const req = golden.cases.swap_out_fee.request;
  const psm = relayEntries(build(req)).find((e) => e.kind === 'psm');
  assert.ok(psm.state.fees > req.protocol.psm.state.fees);
});

test('the golden fee cases rebuild identically in this WASM', () => {
  for (const k of ['swap_in_fee', 'swap_out_fee']) assert.equal(build(golden.cases[k].request).txid, golden.cases[k].txid);
});
