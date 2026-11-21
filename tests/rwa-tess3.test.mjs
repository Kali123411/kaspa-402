// /rwa leads with TESS3: the restricted security token rebuilt on canonical KCC-20 (compliance in a P2SH owner script,
// recognised by an independent indexer, settled against kUSD in one transaction). TESS v1/v2 stay as history.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkRegister } from '../lib/rwa/status.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const t3 = JSON.parse(read('public/rwa/tess3.json'));

test('the TESS3 snapshot is a reconciled, node-verified register on the standard', () => {
  assert.equal(t3.instrument.symbol, 'TESS3');
  assert.equal(t3.audit.total, t3.instrument.authorized);
  assert.equal(t3.holders.reduce((a, h) => a + h.amount, 0), 1_000_000);
  assert.match(t3.instrument.standard, /KCC-20/);
  for (const h of t3.holders) {
    assert.match(h.address, /^kaspatest:p/, 'a covenant box');
    assert.match(h.owner_commitment, /^[0-9a-f]{64}$/, 'owned by a compliance script commitment');
    assert.match(h.compliance_key, /^kaspatest:p/, 'the compliance key is a P2SH address');
  }
});

test('the independent indexer verdict travels with the snapshot', () => {
  assert.equal(t3.kascov.status, 'verified');
  assert.equal(t3.kascov.conformant, true);
  assert.deepEqual(t3.kascov.nonconformities, []);
  assert.equal(t3.kascov.supply, 1_000_000);
});

test('the kUSD trade is one transaction and every TESS3 proof is linkable', () => {
  const s = t3.settlements.find((x) => x.currency === 'kUSD');
  assert.ok(s && /^[0-9a-f]{64}$/.test(s.txid) && s.price_cents > 0 && s.qty > 0);
  for (const r of t3.rules) for (const p of r.proofs) if (p.txid) assert.equal(typeof p.onExplorer, 'boolean');
});

test('the status route checks the TESS3 boxes as well as the history', async () => {
  const route = read('pages/api/rwa/status.js');
  assert.match(route, /tess3\.json/);
  assert.match(route, /v3: await checkRegister\(t3\.holders/);
  const fetchJson = async () => [{ outpoint: { transactionId: t3.holders[0].txid, index: t3.holders[0].index } }];
  const r = await checkRegister(t3.holders.slice(0, 1), fetchJson, { base: 'https://x' });
  assert.deepEqual(r.boxes, ['current']);
});

test('the page leads with TESS3, keeps TESS v1/v2 as history, and keeps the disclaimer', () => {
  const page = read('pages/rwa.js');
  for (const s of ["from '../public/rwa/tess3.json'", 't3.holders.map', 'rules={t3.rules}', 't3.kascov', 'History: TESS v1 and v2', 'Fictional instrument', 'not a securities offering', 'kUSD']) {
    assert.ok(page.includes(s), `page has ${s}`);
  }
  assert.ok(page.indexOf('t3.holders.map') < page.indexOf('History: TESS v1 and v2'), 'TESS3 comes first');
});
