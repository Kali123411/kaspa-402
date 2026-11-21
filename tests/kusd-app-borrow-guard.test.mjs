// Borrow guard: borrowing stops at 200% and liquidation waits for 170% (kusd-framework #56); the app still steers
// people to a safe target, says how far KAS can fall before a vault becomes liquidatable, and never offers more
// than the vault-debt ceiling has room for (budget.ag vault_ceiling).
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
  // liquidatable below 170% of $3.14 → collateral must be worth $5.34 → 178 (1e-4 USD/KAS, rounded up)
  assert.equal(r.liquidatesBelow, 178);
  assert.equal(r.dropPct, 32.0); // (262 - 178) / 262, one decimal, rounded down
});

test('liquidation line is 170 while borrowing stops at 200', () => {
  assert.equal(LIQ_RATIO, 170);
  assert.equal(vaultView(vault, oracle).maxMintCents, 393); // floor(786 * 100 / 200)
  const max = borrowRisk(vault, oracle, 393);
  assert.equal(max.ratioAfter, 200);
  assert.equal(max.liquidatesBelow, 223); // 170% of $3.93 = $6.681 → 669 cents over 300 KAS
  assert.equal(max.dropPct, 14.8); // a maximum borrow has about 15% of room before liquidation
});

test('borrowing below 225% asks for confirmation', () => {
  assert.equal(CONFIRM_BELOW, 225);
  assert.equal(borrowRisk(vault, oracle, 349).needsConfirm, false); // 225%
  assert.equal(borrowRisk(vault, oracle, 350).needsConfirm, true); // 224%
});

test('the vault-debt ceiling caps what any vault can borrow', () => {
  const budget = { vault_debt: 900, vault_ceiling: 1_000 };
  assert.equal(vaultView(vault, oracle, budget).maxMintCents, 100);
  assert.equal(safeBorrowCents(vault, oracle, budget), 100);
  assert.equal(vaultView(vault, oracle, { vault_debt: 1_200, vault_ceiling: 1_000 }).maxMintCents, 0, 'over the ceiling after a cut: no room');
  assert.equal(vaultView(vault, oracle, { vault_debt: 0, vault_ceiling: 1_000_000 }).maxMintCents, 393, 'a roomy ceiling changes nothing');
  assert.equal(vaultView(vault, oracle).maxMintCents, 393, 'no budget given: the ratio alone');
});

test('a liquidation price already above the oracle reads as no room', () => {
  const r = borrowRisk(vault, { price: 262, mint: 262, liq: 150 }, 400);
  assert.equal(r.dropPct, 0);
});
