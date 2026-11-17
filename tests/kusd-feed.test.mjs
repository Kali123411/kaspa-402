// The hourly refresh job publishes a newer snapshot; the page uses it only when it is valid.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickSnapshot, loadSnapshot } from '../lib/kusd/feed.mjs';

const cov = (covid, txid) => ({ covid, txid, index: 0, address: 'kaspatest:x', amount: 1, state: {} });
const bundled = {
  network: 'testnet-10',
  generatedAt: '2026-11-14T21:00:00Z',
  covenants: { oracle: cov('aa'.repeat(32), '11'.repeat(32)), vault: cov('bb'.repeat(32), '22'.repeat(32)) },
};
const newer = {
  ...bundled,
  generatedAt: '2026-11-14T22:00:00Z',
  covenants: { ...bundled.covenants, oracle: cov('aa'.repeat(32), '33'.repeat(32)) },
};

test('a newer snapshot of the same covenants replaces the bundled one', () => {
  assert.equal(pickSnapshot(bundled, newer), newer);
});

test('an older or equal snapshot is ignored', () => {
  assert.equal(pickSnapshot(newer, bundled), newer);
  assert.equal(pickSnapshot(bundled, { ...bundled }), bundled);
});

test('a snapshot with different covenant ids is ignored', () => {
  const swapped = { ...newer, covenants: { ...newer.covenants, vault: cov('cc'.repeat(32), '44'.repeat(32)) } };
  assert.equal(pickSnapshot(bundled, swapped), bundled);
  const missing = { ...newer, covenants: { oracle: newer.covenants.oracle } };
  assert.equal(pickSnapshot(bundled, missing), bundled);
});

test('wrong network, junk or null is ignored', () => {
  assert.equal(pickSnapshot(bundled, { ...newer, network: 'mainnet' }), bundled);
  assert.equal(pickSnapshot(bundled, 'junk'), bundled);
  assert.equal(pickSnapshot(bundled, null), bundled);
  assert.equal(pickSnapshot(bundled, { ...newer, generatedAt: 'soon' }), bundled);
});

test('loadSnapshot falls back to the bundled snapshot when the feed fails or hangs', async () => {
  assert.equal(await loadSnapshot(bundled, async () => { throw new Error('404'); }), bundled);
  assert.equal(await loadSnapshot(bundled, () => new Promise(() => {}), { timeoutMs: 50 }), bundled);
  assert.equal(await loadSnapshot(bundled, async () => newer), newer);
});

test('loadSnapshot busts the feed cache once a minute', async () => {
  let seen;
  await loadSnapshot(bundled, async (u) => { seen = u; return newer; }, { url: 'https://feed/s.json', now: 120_000 });
  assert.equal(seen, 'https://feed/s.json?m=2');
});
