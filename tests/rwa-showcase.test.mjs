// /rwa: the tokenized-asset showcase. A fictional share register (Tessera's TESS) living in Kaspa covenants on
// testnet-10: the live holder boxes, every rule the chain enforces with the transaction that proved it, the trades
// that settled in one transaction, and proof of reserves. Fictional, testnet-only, not a securities offering.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boxStatus, checkRegister, auditOf, fastestSettlement, T_PLUS_ONE_S } from '../lib/rwa/status.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const snap = JSON.parse(read('public/rwa/showcase.json'));
const API = 'https://tn10.example';

test('the snapshot is the reconciled register: authorized = minter + circulating, and reserves cover circulating', () => {
  const a = auditOf(snap.holders);
  assert.equal(a.total, snap.instrument.authorized);
  assert.equal(a.total, 1_000_000);
  assert.deepEqual(a, snap.audit);
  assert.equal(snap.attestation.supply, a.circulating, 'the custodian attests exactly the circulating supply');
  assert.ok(snap.holders.every((h) => /^kaspatest:p/.test(h.address) && /^[0-9a-f]{64}$/.test(h.txid)), 'every row is a covenant box');
});

test('every proof is honest about where it can be checked', () => {
  for (const r of snap.rules) {
    assert.ok(r.title && r.plain && r.proofs.length, r.id);
    for (const p of r.proofs) {
      assert.ok(['accepted', 'network-rejected', 'refused'].includes(p.outcome), `${r.id}: ${p.label}`);
      if (p.txid) assert.equal(typeof p.onExplorer, 'boolean', `${p.label}: the copy step checked the public API`);
      if (p.outcome === 'refused') assert.equal(p.txid, null, 'a refusal never reached the chain');
    }
  }
  assert.equal(typeof snap.settlements[0].onExplorer, 'boolean');
});

test('a box is current only while that exact outpoint is unspent at its address', async () => {
  const h = { address: 'kaspatest:pX', txid: 'a'.repeat(64), index: 1 };
  const live = async () => [{ outpoint: { transactionId: 'a'.repeat(64), index: 1 } }];
  const moved = async () => [{ outpoint: { transactionId: 'b'.repeat(64), index: 0 } }];
  const down = async () => { throw new Error('timeout'); };
  assert.equal(await boxStatus(h, live, API), 'current');
  assert.equal(await boxStatus(h, moved, API), 'moved');
  assert.equal(await boxStatus(h, down, API), 'unknown');
});

test('checkRegister reports one status per box and counts them', async () => {
  const holders = [{ address: 'kaspatest:p1', txid: 'a'.repeat(64), index: 0 }, { address: 'kaspatest:p2', txid: 'b'.repeat(64), index: 0 }];
  const fetchJson = async (url) => (url.includes('p1') ? [{ outpoint: { transactionId: 'a'.repeat(64), index: 0 } }] : []);
  const r = await checkRegister(holders, fetchJson, { base: API });
  assert.deepEqual(r.boxes, ['current', 'moved']);
  assert.deepEqual(r.counts, { current: 1, moved: 1, unknown: 0 });
});

test('the headline settlement time is the fastest recorded trade, against T+1', () => {
  assert.equal(T_PLUS_ONE_S, 86_400);
  const f = fastestSettlement(snap.settlements);
  assert.equal(f.seconds, Math.min(...snap.settlements.map((s) => s.submit_to_chain_accepted_s)));
});

test('the page: ledger sections, live register, the rules with proofs, the trades, and the disclaimer up front', () => {
  const page = read('pages/rwa.js');
  for (const s of ["from '../components/Ledger'", "fetch('/api/rwa/status')", 'snap.rules.map', 'snap.settlements', 'Fictional instrument', 'not a securities offering', 'T+1']) {
    assert.ok(page.includes(s), `page has ${s}`);
  }
  assert.match(page, /<title>[^<]*k402<\/title>/);
  assert.match(read('pages/api/rwa/status.js'), /checkRegister\(/);
});

test('the site links to it: header and footer', () => {
  assert.match(read('pages/_app.js'), /<a href="\/rwa"/);
  assert.match(read('components/SiteFooter.jsx'), /href="\/rwa"/);
});
