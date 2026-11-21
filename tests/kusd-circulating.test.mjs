// /kusd "kUSD in circulation": every kUSD is either unissued in the token authority or in a holder box, and the
// authority held exactly $1,000,000 at genesis (tn10_deploy AUTH_SUPPLY), so circulation = genesis − unissued.
// The old row showed one holder box (the deployer's $4 test box) under that heading.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GENESIS_SUPPLY_CENTS, circulatingCents } from '../lib/kusd/status.mjs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('circulation is genesis supply minus what the authority still holds', () => {
  assert.equal(GENESIS_SUPPLY_CENTS, 100_000_000);
  assert.equal(circulatingCents(99_994_391), 5_609);      // 2026-11-21: $52.09 via the PSM + $4.00 vault debt
  assert.equal(circulatingCents(GENESIS_SUPPLY_CENTS), 0);
  assert.equal(circulatingCents(undefined), null, 'no reading, no number');
});

test('the bundled genesis snapshot is consistent with it: unissued + the deployer box = $1,000,000', () => {
  const c = JSON.parse(read('public/kusd/snapshot.json')).covenants;
  assert.equal(circulatingCents(c.authority.state.amount), c.minted.state.amount + c.psm.state.minted);
});

test('the page shows circulation from the authority and labels the deployer box as one holder', () => {
  const page = read('pages/kusd.js');
  assert.match(page, /\['kUSD in circulation', dot\('authority'\), \[\['all holders', dollars\(circulatingCents\(c\.authority\.state\.amount\)\)\]\]\]/);
  assert.match(page, /\['Deployer&apos;s test box', dot\('minted'\)|\["Deployer's test box", dot\('minted'\)/);
  assert.doesNotMatch(page, /'minted holder'/);
});
