// The hardened peg module (kusd-framework psm.ag): swap-ins stop at floor + share of vault debt, and a short reserve
// pays every redeemer the same share. The app quotes what the covenant will do; the relay carries the new fields.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { swapInLimits, swapOutQuote, redemptionCents } from '../lib/kusd/app/quotes.mjs';
import { parseEntry } from '../lib/kusd/relay.mjs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const oracle = { price: 4000, mint: 4000, liq: 4000 }; // $0.40
const protocol = (psm, vaultDebt, value = 100_000_000 + 2_000_000_000) => ({
  psm: { value, state: { ceiling: 1_000_000, minted: 0, spread: 0, share_bps: 2_500, floor: 500, ...psm } },
  budget: { state: { limit: 5_000_000, available: 5_000_000, last: 0, vault_debt: vaultDebt, vault_ceiling: 33_000_000 } },
  authority: { state: { amount: 99_000_000 } },
  oracle: { state: oracle },
});

test('swap-in room is the share cap when it binds: floor + 25% of vault debt, less what is out', () => {
  assert.equal(swapInLimits(protocol({ minted: 400 }, 300), 0).psmHeadroomCents, 175); // 500 + 75 − 400
  assert.equal(swapInLimits(protocol({ minted: 0, ceiling: 100 }, 300), 0).psmHeadroomCents, 100, 'the ceiling still binds');
  assert.equal(swapInLimits(protocol({ minted: 900 }, 300), 0).psmHeadroomCents, 0, 'over the cap after a cut: no room');
});

test('a covered reserve redeems a full dollar; a short one pays everyone the same share', () => {
  // 20 KAS at $0.40 = $8 of reserve
  assert.equal(redemptionCents(400, 500, 2_000_000_000, 4000), 400);
  assert.equal(redemptionCents(400, 1_600, 2_000_000_000, 4000), 200); // $8 against $16: 50%
  const p = protocol({ minted: 1_600 }, 0);
  const q = swapOutQuote(400, oracle, 0, p.psm);
  assert.equal(q.paidCents, 200);
  assert.equal(q.coveragePct, 50);
  assert.equal(swapOutQuote(400, oracle).paidCents, 400, 'without the PSM box the quote assumes full cover');
});

test('the relay accepts a PSM entry with the share cap fields', () => {
  const state = { ceiling: 5_000_000, minted: 0, spread: 50, gov: ['11'.repeat(32), '22'.repeat(32), '33'.repeat(32)], kusd_id: '42'.repeat(32), oracle_id: '07'.repeat(32), surplus_id: '77'.repeat(32), budget_id: '88'.repeat(32), share_bps: 2_500, floor: 100_000 };
  const seen = [];
  parseEntry({ kind: 'psm', covid: '66'.repeat(32), outpoint: { transactionId: 'ab'.repeat(32), index: 0 }, value: 100_000_000, state }, { boxAddress: (k, s) => { seen.push(s); return 'kaspatest:x'; } });
  assert.deepEqual(seen[0], state);
});

test('the swap tab quotes redemptions with the PSM box and the page shows the share cap', () => {
  assert.match(read('components/kusd/app/SwapTab.jsx'), /swapOutQuote\([^)]*protocol\.psm\)/);
  assert.match(read('pages/kusd.js'), /share cap/);
});
