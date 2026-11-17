// The stability fee in the app (kusd-framework #40): what a vault owes is its debt rebased at the oracle's
// rate index, rounded up to the cent; a repayment box at or above that clears the vault.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as kc from '../lib/kusd/wasm/kusd_client_wasm.mjs';
import { INDEX_SCALE, REPAY_SLACK, owedMc, owedCents, vaultOwed, vaultView, repayPlan, borrowRisk } from '../lib/kusd/app/quotes.mjs';

kc.initSync({ module: readFileSync(new URL('../lib/kusd/wasm/kusd_client_wasm_bg.wasm', import.meta.url)) });
const golden = JSON.parse(readFileSync(new URL('./fixtures/kusd-golden.json', import.meta.url), 'utf8'));
const build = (req) => { const o = JSON.parse(kc.build(JSON.stringify(req))); if (o.error) throw new Error(o.error); return o; };
const S = INDEX_SCALE;
const oracle = (index) => ({ price: 262, mint: 262, liq: 262, rate: 200, next_rate: 200, index, rem: 0 });

test('owed follows the oracle index (the spec examples)', () => {
  assert.equal(S, 1_000_000_000);
  assert.equal(owedMc(400_000, S, S + 190), 400_001, '400,000 mc at 1.000000190, rounded up to the milli-cent');
  assert.equal(owedCents(400_001), 401);
  assert.equal(owedMc(400_000, S, S), 400_000, 'unmoved index: exact');
  assert.equal(owedMc(40_000_000_000_000, S, 2 * S), 80_000_000_000_000, 'a maximum vault at 2.0 owes twice');
  assert.equal(vaultOwed({ debt_mc: 400_000, index_at: S }, oracle(S + 190)), 401);
  assert.equal(vaultOwed({ debt_mc: 0, index_at: S }, oracle(S + 190)), 0);
});

test('vault view ratios use owed, not the minted principal', () => {
  // 300 KAS = $7.86: 200c minted is 393%; with the index 5% up the vault owes 210c, 374%
  const v = { collateral: 30_000_000_000, debt_mc: 200_000, index_at: S };
  assert.equal(vaultView(v, oracle(S)).ratioAtMint, 393);
  const up = vaultView(v, oracle(S + S / 20));
  assert.equal(up.owedCents, 210);
  assert.equal(up.ratioAtMint, 374);
  assert.equal(up.maxMintCents, 449 - 210);
  assert.equal(borrowRisk(v, oracle(S + S / 20), 0).ratioAfter, 374);
});

test('a box at or above owed repays all; one below is partial or refused', () => {
  const v = { collateral: 30_000_000_000, debt_mc: 400_000, index_at: S };
  const o = oracle(S + S / 400); // owed 401
  assert.deepEqual(repayPlan(v, o, 402), { owed: 401, full: true, excess: 1, remaining: 0 });
  assert.deepEqual(repayPlan(v, o, 401), { owed: 401, full: true, excess: 0, remaining: 0 });
  const partial = repayPlan(v, o, 400);
  assert.equal(partial.full, false);
  assert.equal(partial.remaining, 1, 'a cent would be left: under the $1.00 floor, so the tab refuses it');
  assert.deepEqual(repayPlan({ ...v, debt_mc: 800_000 }, o, 400), { owed: 802, full: false, excess: 0, remaining: 402 });
  assert.equal(REPAY_SLACK, 5);
  assert.equal(repayPlan(v, o, 401 + REPAY_SLACK).full, true);
  assert.equal(repayPlan(v, o, 401 + REPAY_SLACK + 1).tooBig, true, 'far above the debt: split it first (the builder refuses it too)');
});

test('the golden repay case rebuilds in this WASM with the oracle on board', () => {
  const req = golden.cases.repay.request;
  const built = build(req);
  assert.equal(built.txid, golden.cases.repay.txid);
  assert.ok(built.created.some((c) => c.kind === 'oracle'), 'repay republishes the oracle it rode on');
});
