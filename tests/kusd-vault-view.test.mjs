// /kusd's vault panel after the origination-fee re-genesis (option (e)): the exporter writes {collateral, debt} with
// debt in whole cents (no interest), so the debt shown is exactly what the vault owes, and the ratio is undefined
// (not NaN, not Infinity) when nothing is owed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { vaultView } from '../lib/kusd/status.mjs';

const snapshot = JSON.parse(readFileSync(new URL('../public/kusd/snapshot.json', import.meta.url), 'utf8'));

test('the bundled snapshot has the new vault shape and renders without NaN', () => {
  const v = snapshot.covenants.vault.state;
  assert.ok('debt' in v && !('debt_mc' in v) && !('index_at' in v), 'the exporter writes debt, not debt_mc/index_at');
  const view = vaultView(v, snapshot.covenants.oracle.state);
  assert.equal(view.debtCents, v.debt);
  assert.ok(view.debtCents === 0 ? view.ratioPct === null : Number.isFinite(view.ratioPct));
  assert.ok(Number.isFinite(view.collateralKas) && view.collateralKas === v.collateral / 1e8);
});

test('debt is exactly what was minted and not repaid: the oracle never moves it', () => {
  const view = vaultView({ collateral: 300e8, debt: 200 }, { liq: 2680, fee: 50 });
  assert.equal(view.debtCents, 200);
  // ratio at the liquidation price: 300 KAS × $0.2680 / $2.00 = 4020%
  assert.equal(Math.round(view.ratioPct), 4020);
  assert.equal(vaultView({ collateral: 300e8, debt: 0 }, { liq: 2680 }).ratioPct, null);
});

test('the page reads the vault through vaultView, never a `debt` field', () => {
  const page = readFileSync(new URL('../pages/kusd.js', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /vault\.state\.debt\b/);
  assert.match(page, /vaultView\(/);
  assert.match(page, /no debt/, 'the panel says "no debt" instead of a ratio when nothing is owed');
});
