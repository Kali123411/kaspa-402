// node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkStatus } from '../lib/kusd/status.mjs';

const snap = {
  covenants: {
    oracle: { txid: 'aa'.repeat(32), index: 3, address: 'kaspatest:oracle', state: { last: 1000 } },
    vault: { txid: 'bb'.repeat(32), index: 0, address: 'kaspatest:vault', state: {} },
  },
};

const op = (c) => ({ outpoint: { transactionId: c.txid, index: c.index } });

// utxos: address -> array | Error | 'hang'; daa: number | Error
function fakeFetch({ utxos = {}, daa = 2000 } = {}) {
  return async (url) => {
    if (url.endsWith('/info/blockdag')) {
      if (daa instanceof Error) throw daa;
      return { virtualDaaScore: String(daa) };
    }
    const addr = decodeURIComponent(url.split('/addresses/')[1].split('/')[0]);
    const v = utxos[addr] ?? [];
    if (v === 'hang') return new Promise(() => {});
    if (v instanceof Error) throw v;
    return v;
  };
}

const allCurrent = { 'kaspatest:oracle': [op(snap.covenants.oracle)], 'kaspatest:vault': [op(snap.covenants.vault)] };

test('current when outpoint present', async () => {
  const r = await checkStatus(snap, fakeFetch({ utxos: allCurrent }));
  assert.equal(r.covenants.oracle, 'current');
  assert.equal(r.covenants.vault, 'current');
});

test('moved when the address answers without the outpoint', async () => {
  const other = { outpoint: { transactionId: 'cc'.repeat(32), index: 0 } };
  const r = await checkStatus(snap, fakeFetch({ utxos: { ...allCurrent, 'kaspatest:oracle': [other] } }));
  assert.equal(r.covenants.oracle, 'moved');
});

test('unknown on one failing lookup, others unaffected', async () => {
  const r = await checkStatus(snap, fakeFetch({ utxos: { ...allCurrent, 'kaspatest:oracle': new Error('502') } }));
  assert.equal(r.covenants.oracle, 'unknown');
  assert.equal(r.covenants.vault, 'current');
});

test('all moved when the chain was reset', async () => {
  const r = await checkStatus(snap, fakeFetch({ utxos: {} }));
  assert.deepEqual(r.covenants, { oracle: 'moved', vault: 'moved' });
});

test('staleOracle true past 36000 DAA, false within', async () => {
  const stale = await checkStatus(snap, fakeFetch({ utxos: allCurrent, daa: 1000 + 36001 }));
  assert.equal(stale.staleOracle, true);
  assert.equal(stale.daaScore, 37001);
  const fresh = await checkStatus(snap, fakeFetch({ utxos: allCurrent, daa: 1100 }));
  assert.equal(fresh.staleOracle, false);
});

test('daaScore null and staleOracle null when blockdag fails', async () => {
  const r = await checkStatus(snap, fakeFetch({ utxos: allCurrent, daa: new Error('down') }));
  assert.equal(r.daaScore, null);
  assert.equal(r.staleOracle, null);
});

test('a hung lookup becomes unknown within timeoutMs', async () => {
  const t0 = Date.now();
  const r = await checkStatus(snap, fakeFetch({ utxos: { ...allCurrent, 'kaspatest:vault': 'hang' } }), { timeoutMs: 50 });
  assert.equal(r.covenants.vault, 'unknown');
  assert.equal(r.covenants.oracle, 'current');
  assert.ok(Date.now() - t0 < 1000);
});
