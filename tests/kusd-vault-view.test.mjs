// /kusd's vault panel after the stability-fee re-genesis: the exporter writes {collateral, debt_mc, index_at} and
// the oracle carries the rate index, so the debt shown is what the vault owes NOW (vault.ag owed_cents), and the
// ratio is undefined (not NaN, not Infinity) when nothing is owed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { vaultView } from '../lib/kusd/status.mjs';

const snapshot = JSON.parse(readFileSync(new URL('../public/kusd/snapshot.json', import.meta.url), 'utf8'));

test('the bundled snapshot has the new vault shape and renders without NaN', () => {
  const v = snapshot.covenants.vault.state;
  assert.ok('debt_mc' in v && 'index_at' in v && !('debt' in v), 'the exporter writes debt_mc/index_at, not debt');
  const view = vaultView(v, snapshot.covenants.oracle.state);
  // the receipts deployment's vault: 300 KAS, 375c settled at index 1.0 → owes 376c at the oracle's index (interest);
  // at 253 ($7.59) that is 202% at the liquidation price
  assert.equal(view.debtCents, 376);
  assert.equal(Math.round(view.ratioPct), 202);
  assert.ok(Number.isFinite(view.ratioPct));
  assert.ok(Number.isFinite(view.collateralKas) && view.collateralKas === v.collateral / 1e8);
});

test('debt is the milli-cent principal rebased by the oracle index, rounded up to the cent', () => {
  // 2.00 kUSD borrowed when the index was 1.000000000; the index has since grown 1% → owes 2.02 kUSD
  const view = vaultView({ collateral: 300e8, debt_mc: 200_000, index_at: 1_000_000_000 }, { index: 1_010_000_000, liq: 2680 });
  assert.equal(view.debtCents, 202);
  // ratio at the liquidation price: 300 KAS × $0.2680 / $2.02 = 3980.2%
  assert.equal(Math.round(view.ratioPct), 3980);
  // an oracle without an index (older snapshot) means no accrual
  assert.equal(vaultView({ collateral: 300e8, debt_mc: 200_000, index_at: 1_000_000_000 }, { liq: 2680 }).debtCents, 200);
});

test('the page reads the vault through vaultView, never a `debt` field', () => {
  const page = readFileSync(new URL('../pages/kusd.js', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /vault\.state\.debt\b/);
  assert.match(page, /vaultView\(/);
  assert.match(page, /no debt/, 'the panel says "no debt" instead of a ratio when nothing is owed');
});
