// Borrow guard: borrowing stops at 175% and liquidation waits for 150%; the app still steers people to a
// safe target and says how far KAS can fall before a vault becomes liquidatable.
import test from 'node:test';
import assert from 'node:assert/strict';
import { safeBorrowCents, borrowRisk, vaultView, SAFE_RATIO, CONFIRM_BELOW, LIQ_RATIO } from '../lib/kusd/app/quotes.mjs';

const oracle = { price: 262, mint: 262, liq: 262 };
const vault = { collateral: 30_000_000_000, debt_mc: 0, index_at: 1_000_000_000 }; // 300 KAS = $7.86 at 262

test('the safe borrow targets 250% at the mint price', () => {
  assert.equal(SAFE_RATIO, 250);
  assert.equal(safeBorrowCents(vault, oracle), 314); // floor(786 * 100 / 250)
  assert.equal(safeBorrowCents({ ...vault, debt_mc: 300_000 }, oracle), 14);
  assert.equal(safeBorrowCents({ ...vault, debt_mc: 400_000 }, oracle), 0);
});

test('borrow risk: the ratio after and how far KAS can fall before liquidation', () => {
  const r = borrowRisk(vault, oracle, 314);
  assert.equal(r.ratioAfter, 250);
  // liquidatable below 150% of $3.14 → collateral must be worth $4.71 → 157 (1e-4 USD/KAS, rounded up)
  assert.equal(r.liquidatesBelow, 157);
  assert.equal(r.dropPct, 40.0); // (262 - 157) / 262, one decimal, rounded down
});

test('liquidation line is 150 while borrowing stops at 175', () => {
  assert.equal(LIQ_RATIO, 150);
  assert.equal(vaultView(vault, oracle).maxMintCents, 449); // floor(786 * 100 / 175): unchanged
  const max = borrowRisk(vault, oracle, 449);
  assert.equal(max.ratioAfter, 175);
  assert.equal(max.liquidatesBelow, 225); // 150% of $4.49 = $6.735 → 674 cents over 300 KAS
  assert.equal(max.dropPct, 14.1); // a maximum borrow now has room before liquidation
});

test('borrowing below 200% asks for confirmation', () => {
  assert.equal(CONFIRM_BELOW, 200);
  assert.equal(borrowRisk(vault, oracle, 392).needsConfirm, false); // 200%
  assert.equal(borrowRisk(vault, oracle, 394).needsConfirm, true); // 199%
});

test('a liquidation price already above the oracle reads as no room', () => {
  const r = borrowRisk(vault, { price: 262, mint: 262, liq: 150 }, 400);
  assert.equal(r.dropPct, 0);
});
