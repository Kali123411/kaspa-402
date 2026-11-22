// Boxes this browser created survive a reload, so they show (and get republished) even when the
// relay missed them because the tab closed during its retries.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLocal, saveLocal, mergeCreated, LOCAL_KEY } from '../lib/kusd/app/pending.mjs';

const memory = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
const box = (kind, tx, index = 0) => ({ kind, covid: 'aa'.repeat(32), outpoint: { transactionId: tx.repeat(32), index }, value: 1, state: {} });

test('created boxes round-trip through storage', () => {
  const s = memory();
  const l = mergeCreated(loadLocal(s, 'k1'), [box('psm', 'a1'), box('holder', 'a1', 2), box('vault', 'a1', 3)]);
  saveLocal(s, 'k1', l);
  const back = loadLocal(s, 'k1');
  assert.equal(back.protocol.psm.outpoint.transactionId, 'a1'.repeat(32));
  assert.equal(back.holders.length, 1);
  assert.equal(back.vaults.length, 1);
});

test('newer protocol boxes replace older ones and user boxes are capped', () => {
  let l = loadLocal(memory(), 'k1');
  for (let i = 0; i < 30; i++) l = mergeCreated(l, [box('psm', i.toString(16).padStart(2, '0')), box('holder', i.toString(16).padStart(2, '0'), 1)]);
  assert.equal(l.protocol.psm.outpoint.transactionId, '1d'.repeat(32));
  assert.equal(l.holders.length, 20);
  assert.equal(l.holders[0].outpoint.transactionId, '1d'.repeat(32));
});

test('each wallet has its own record, and bad storage reads as empty', () => {
  const s = memory();
  saveLocal(s, 'k1', mergeCreated(loadLocal(s, 'k1'), [box('holder', 'b1')]));
  assert.equal(loadLocal(s, 'k2').holders.length, 0);
  assert.deepEqual(loadLocal(memory({ [LOCAL_KEY]: 'not json' }), 'k1'), { protocol: {}, holders: [], vaults: [], receipts: [] });
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.deepEqual(loadLocal(broken, 'k1'), { protocol: {}, holders: [], vaults: [], receipts: [] });
  assert.doesNotThrow(() => saveLocal(broken, 'k1', loadLocal(broken, 'k1')));
});

test('all entries of a record, for republishing', async () => {
  const { allEntries } = await import('../lib/kusd/app/pending.mjs');
  const l = mergeCreated(loadLocal(memory(), 'k1'), [box('psm', 'c1'), box('holder', 'c1', 1)]);
  assert.equal(allEntries(l).length, 2);
});
