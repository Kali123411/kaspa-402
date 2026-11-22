// Deferred minors from the kUSD app's final review.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { oracleView } from '../lib/kusd/app/status.mjs';
import { swapInLimits, fundingNeed, checkFunds } from '../lib/kusd/app/quotes.mjs';
import { record, list } from '../lib/kusd/app/activity.mjs';
import { mergeCreated, pruneLocal } from '../lib/kusd/app/pending.mjs';
import { sealSecret } from '../lib/kusd/app/keystore.mjs';

const golden = JSON.parse(readFileSync(new URL('./fixtures/kusd-golden.json', import.meta.url), 'utf8'));
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };

test('with the relay down the last published price shows, marked unverified', () => {
  const snapshot = { covenants: { oracle: { state: { price: 262, mint: 262, liq: 262, last: 5 } } }, generatedAt: '2026-11-15T00:00:00Z' };
  assert.deepEqual(oracleView(null, snapshot), { state: snapshot.covenants.oracle.state, verified: false, asOf: snapshot.generatedAt });
  const live = { oracle: { state: { price: 270, mint: 270, liq: 270, last: 9 } } };
  assert.deepEqual(oracleView(live, snapshot), { state: live.oracle.state, verified: true });
  assert.equal(oracleView(null, {}), null);
});

test('funding needs mirror the builder', () => {
  const p = golden.cases.swap_in.request.protocol;
  // FEE plus one coin's PER_INPUT_FEE (the builder charges each coin it spends)
  assert.equal(fundingNeed('swap_in', { cents: 400 }, p), 15267180000 + 150_000_000 + 10_000_000 + 150_000);
  assert.equal(fundingNeed('open_vault', { collateral: 30_000_000_000 }, p), 30_000_000_000 + 100_000_000 + 10_000_000 + 150_000);
  assert.equal(fundingNeed('adjust', { delta: 5_000_000_000 }, p), 5_010_150_000);
  assert.equal(fundingNeed('adjust', { delta: -5_000_000_000 }, p), 10_150_000);
  assert.equal(fundingNeed('mint', { cents: 100 }, p), 160_150_000);
  assert.equal(fundingNeed('repay', {}, p), 0);
});

test('a flow the wallet cannot pay for is refused before building', () => {
  const coins = [{ entry: { amount: 100_000_000 } }, { entry: { amount: 50_000_000 } }];
  assert.doesNotThrow(() => checkFunds(coins, 150_000_000));
  assert.throws(() => checkFunds(coins, 150_000_001), /needs 1\.50000001 KAS.*you have 1\.5 KAS/);
});

test('swap-in limits include the unissued supply and use the build clock', () => {
  const p = structuredClone(golden.cases.swap_in.request.protocol);
  p.authority.state.amount = 250;
  assert.equal(swapInLimits(p, p.budget.state.last + 10).maxCents, 250);
  assert.equal(swapInLimits(p, p.budget.state.last + 10).issuableCents, 250);
  // a clock before the budget's last refill: the builder refuses, so nothing is available
  assert.equal(swapInLimits(p, p.budget.state.last - 1).budgetCents, 0);
});

test('activity is kept per wallet and malformed entries are skipped', () => {
  const s = memory();
  record(s, 'aa', { txid: 'a'.repeat(64), flow: 'swap_in', at: 1, summary: 'A' });
  record(s, 'bb', { txid: 'b'.repeat(64), flow: 'send', at: 2, summary: 'B' });
  assert.deepEqual(list(s, 'aa').map((e) => e.summary), ['A']);
  assert.deepEqual(list(s, 'bb').map((e) => e.summary), ['B']);
  s.setItem('kusd.activity.v2', JSON.stringify({ aa: [{ txid: 'c'.repeat(64), flow: 'mint', at: 3, summary: 'ok' }, { flow: 'x' }, null, { txid: 'd'.repeat(64), flow: 'send', at: 'soon', summary: 's' }] }));
  assert.deepEqual(list(s, 'aa').map((e) => e.summary), ['ok']);
});

test('spent or stale local boxes are pruned, fresh ones kept', () => {
  const box = (kind, tx, index = 0) => ({ kind, covid: 'aa'.repeat(32), outpoint: { transactionId: tx.repeat(32), index }, value: 1, state: {} });
  const old = mergeCreated({ protocol: {}, holders: [], vaults: [] }, [box('psm', 'a1'), box('holder', 'a1', 1), box('holder', 'a1', 2)], 1_000);
  const fresh = mergeCreated(old, [box('holder', 'b2', 1)], 1_000_000);
  // a1:2 still verifies on the node; a1:1 does not and is old; b2:1 does not verify yet but is fresh
  const verified = new Set([`${'a1'.repeat(32)}:2`]);
  const pruned = pruneLocal(fresh, verified, 1_000_000 + 1000, 10 * 60_000);
  assert.deepEqual(pruned.holders.map((h) => `${h.outpoint.transactionId.slice(0, 2)}:${h.outpoint.index}`), ['b2:1', 'a1:2']);
  assert.deepEqual(pruned.protocol, {});
});

test('without WebCrypto a wallet cannot be sealed, and says why', async () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { value: { getRandomValues: (a) => a }, configurable: true });
  try {
    await assert.rejects(sealSecret('01'.repeat(32), 'long passphrase'), /WebCrypto/);
  } finally {
    Object.defineProperty(globalThis, 'crypto', saved);
  }
});
