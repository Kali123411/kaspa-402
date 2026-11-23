// The origination fee in the app (option (e)): no interest — a vault owes exactly what it minted and
// hasn't repaid; each borrow pays a one-time fee of the receipt's rate in KAS from the collateral; burns are exact.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as kc from '../lib/kusd/wasm/kusd_client_wasm.mjs';
import { FEE_MAX_BPS, MIN_COLLATERAL, originationFee, mintQuote, vaultOwed, vaultView, repayPlan, borrowRisk, safeBorrowCents } from '../lib/kusd/app/quotes.mjs';

kc.initSync({ module: readFileSync(new URL('../lib/kusd/wasm/kusd_client_wasm_bg.wasm', import.meta.url)) });
const golden = JSON.parse(readFileSync(new URL('./fixtures/kusd-golden.json', import.meta.url), 'utf8'));
const build = (req) => { const o = JSON.parse(kc.build(JSON.stringify(req))); if (o.error) throw new Error(o.error); return o; };
const oracle = (fee = 50) => ({ price: 262, mint: 262, liq: 262, fee });
const usdCentsOf = (sompi, price) => Math.floor(Math.floor(sompi / 100) * price / 100_000_000);

test('the fee matches the covenant formula: ceil(d·fee·100 / price) units of 1e-4 KAS', () => {
  assert.equal(FEE_MAX_BPS, 200);
  assert.equal(originationFee(200, 50, 262), 38_170_000, '200c at 0.5% and 2.62¢/KAS: 3,817 units (kusd-client test)');
  assert.equal(originationFee(1, 50, 1_000_000), 10_000, 'a fraction of a unit rounds up to one');
  assert.equal(originationFee(200, 0, 262), 0);
  assert.equal(originationFee(40_000_000_000, 200, 1), 8_000_000_000_000_000_000, 'the worst case still fits i64');
});

test('a vault owes exactly its debt; the oracle never changes it', () => {
  assert.equal(vaultOwed({ collateral: 30_000_000_000, debt: 401 }), 401);
  assert.equal(vaultOwed({ collateral: 30_000_000_000, debt: 0 }), 0);
  const v = { collateral: 30_000_000_000, debt: 200 };
  assert.equal(vaultView(v, oracle(0)).ratioAtMint, 393, '300 KAS = $7.86 against 200c');
  assert.equal(vaultView(v, oracle(200)).owedCents, 200);
});

test('the largest borrow pays its fee and still sits at 200% on what is left', () => {
  const v = { collateral: 30_000_000_000, debt: 200 };
  for (const fee of [0, 50, FEE_MAX_BPS]) {
    const o = oracle(fee);
    const max = vaultView(v, o).maxMintCents;
    const fits = (d) => { const after = v.collateral - originationFee(d, fee, o.mint); return after >= MIN_COLLATERAL && (v.debt + d) * 200 <= usdCentsOf(after, o.mint) * 100; };
    assert.ok(fits(max), `fee ${fee}: the maximum fits`);
    assert.ok(!fits(max + 1), `fee ${fee}: one cent more does not`);
  }
  assert.ok(vaultView(v, oracle(FEE_MAX_BPS)).maxMintCents < vaultView(v, oracle(0)).maxMintCents, 'a higher fee leaves less to borrow');
  const safe = safeBorrowCents(v, oracle(50));
  assert.ok(borrowRisk(v, oracle(50), safe).ratioAfter >= 250, 'the safe borrow keeps 250% after its fee');
});

test('a borrow quote shows the fee and the collateral after it', () => {
  const q = mintQuote({ collateral: 30_000_000_000, debt: 0 }, oracle(50), 200);
  assert.deepEqual(q, { feeSompi: 38_170_000, collateralAfter: 30_000_000_000 - 38_170_000, feeBps: 50 });
  assert.equal(borrowRisk({ collateral: 30_000_000_000, debt: 0 }, oracle(50), 200).ratioAfter, vaultView({ collateral: q.collateralAfter, debt: 200 }, oracle(50)).ratioAtMint);
});

test('repays are exact: a box of exactly the debt clears, a smaller one is partial, a larger one is split first', () => {
  const v = { collateral: 30_000_000_000, debt: 401 };
  assert.deepEqual(repayPlan(v, oracle(), 401), { owed: 401, full: true, excess: 0, remaining: 0 });
  assert.deepEqual(repayPlan(v, oracle(), 400), { owed: 401, full: false, excess: 0, remaining: 1 });
  assert.deepEqual(repayPlan(v, oracle(), 402), { owed: 401, full: false, excess: 1, remaining: 0, tooBig: true });
});

test('the golden mint case rebuilds: the vault pays the fee to the surplus from its collateral', () => {
  const c = golden.cases.mint;
  const built = build(c.request);
  assert.equal(built.txid, c.txid);
  const v = c.request.params.vault;
  const fee = originationFee(c.request.params.cents, c.request.protocol.receipts[0].state.fee, c.request.protocol.receipts[0].state.mint);
  const vaultOut = built.created.find((b) => b.kind === 'vault');
  assert.equal(vaultOut.state.collateral, v.state.collateral - fee);
  assert.equal(vaultOut.state.debt, v.state.debt + c.request.params.cents);
  const surplus = built.created.find((b) => b.kind === 'surplus');
  assert.equal(surplus.value, c.request.protocol.surplus.value + fee);
});

test('the golden repay case rebuilds in this WASM with a price receipt on board', () => {
  const req = golden.cases.repay.request;
  const built = build(req);
  assert.equal(built.txid, golden.cases.repay.txid);
  assert.ok(built.created.some((c) => c.kind === 'receipt'), 'repay republishes the price receipt it read');
});

test('the WASM keeper flow chains a split before the exact liquidation', () => {
  const c = golden.multi.liquidate;
  const out = build(c.request);
  assert.deepEqual(out.txs.map((t) => t.txid), c.txs.map((t) => t.txid));
  const [split, liq] = out.txs;
  const exact = split.created.find((b) => b.kind === 'holder' && b.state.amount === c.request.params.vault.state.debt);
  assert.ok(liq.tx.inputs.some((i) => i.previousOutpoint.transactionId === split.txid && i.previousOutpoint.index === exact.index));
});

test('exact_holder splits a larger box or reuses an exact one', () => {
  const split = build(golden.multi.exact_holder_split.request);
  assert.equal(split.holder.state.amount, 500);
  assert.equal(split.holder.outpoint.transactionId, split.split.txid);
  const reuse = build(golden.multi.exact_holder_reuse.request);
  assert.equal(reuse.split, null);
  assert.equal(reuse.holder.state.amount, 500);
});
