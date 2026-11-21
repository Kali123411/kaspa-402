// Vault provenance (kusd-framework vault.ag Factory): every vault is opened by the factory into its covenant group,
// and the authority accepts vaults only from that group. The relay and the app must trust only those vaults.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEntry, PROTOCOL_KINDS, verifyEntry } from '../lib/kusd/relay.mjs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const pins = { oracle: '07'.repeat(32), psm: '66'.repeat(32), budget: '88'.repeat(32), authority: '42'.repeat(32), surplus: '77'.repeat(32), miner: '4d'.repeat(32), factory: '99'.repeat(32) };
const b = (h) => Array.from(Buffer.from(h, 'hex'));
const vaultState = { owner: b('11'.repeat(32)), collateral: 500_000_000, debt_mc: 0, index_at: 1_000_000_000, kusd_id: b(pins.authority), oracle_id: b(pins.oracle), surplus_id: b(pins.surplus), budget_id: b(pins.budget) };

test('the factory is a pinned protocol kind the relay accepts', () => {
  assert.ok(PROTOCOL_KINDS.includes('factory'));
  const state = { kusd_id: b(pins.authority), oracle_id: b(pins.oracle), surplus_id: b(pins.surplus), budget_id: b(pins.budget), gov: ['11'.repeat(32), '22'.repeat(32), '33'.repeat(32)], opened: 2 };
  const seen = [];
  parseEntry({ kind: 'factory', covid: pins.factory, outpoint: { transactionId: 'ab'.repeat(32), index: 0 }, value: 100_000_000, state }, { boxAddress: (k, s) => { seen.push(k); return 'kaspatest:x'; } });
  assert.deepEqual(seen, ['factory']);
});

test('a vault outside the factory group is refused before any network check', async () => {
  const entry = { kind: 'vault', covid: '9a'.repeat(32), outpoint: { transactionId: 'cd'.repeat(32), index: 1 }, value: 600_000_000, state: vaultState, address: 'kaspatest:x', owner: '11'.repeat(32) };
  const r = await verifyEntry(entry, { fetchJson: async () => { throw new Error('no network'); }, pins, api: 'http://x' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /factory/);
});

test('the app trusts vaults only from the factory group and passes the group in its gate', () => {
  const state = read('lib/kusd/app/state.mjs');
  assert.match(state, /const KINDS = \[[^\]]*'factory'/);
  assert.match(state, /e\.covid === pins\.factory/);
  assert.match(read('components/kusd/app/useKusd.js'), /const GATE = \[PINS\.oracle, PINS\.psm, PINS\.surplus, PINS\.budget, PINS\.factory\]/);
});

test('the page shows the vault factory beside the budget', () => {
  assert.match(read('pages/kusd.js'), /\['Vault factory', dot\('factory'\)/);
  assert.match(read('components/kusd/Timeline.jsx'), /'FACTORY-GENESIS': 'Vault factory genesis'/);
});
