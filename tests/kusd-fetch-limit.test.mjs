// Outbound calls to the TN10 API from the relay: bounded concurrency, accepted transactions cached,
// oversized responses refused (a protocol address flooded with dust UTXOs must not exhaust memory).
import test from 'node:test';
import assert from 'node:assert/strict';
import { limitedFetchJson } from '../lib/kusd/fetch-limit.mjs';

test('at most 4 calls in flight', async () => {
  let inFlight = 0, peak = 0;
  const get = async () => { inFlight++; peak = Math.max(peak, inFlight); await new Promise((r) => setTimeout(r, 5)); inFlight--; return '[]'; };
  const f = limitedFetchJson(get);
  await Promise.all(Array.from({ length: 12 }, (_, i) => f(`https://x/addresses/a${i}/utxos`)));
  assert.equal(peak, 4);
});

test('accepted transactions are cached, utxo lists are not', async () => {
  const calls = [];
  const get = async (url) => { calls.push(url); return url.includes('/transactions/') ? '{"is_accepted":true,"outputs":[]}' : '[]'; };
  const f = limitedFetchJson(get);
  await f('https://x/transactions/aa');
  await f('https://x/transactions/aa');
  await f('https://x/addresses/q/utxos');
  await f('https://x/addresses/q/utxos');
  assert.deepEqual(calls, ['https://x/transactions/aa', 'https://x/addresses/q/utxos', 'https://x/addresses/q/utxos']);
});

test('a transaction not accepted yet is not cached', async () => {
  let n = 0;
  const f = limitedFetchJson(async () => { n++; return '{"is_accepted":false}'; });
  await f('https://x/transactions/bb');
  await f('https://x/transactions/bb');
  assert.equal(n, 2);
});

test('oversized responses are refused', async () => {
  const f = limitedFetchJson(async () => 'x'.repeat(100), { maxBytes: 50 });
  await assert.rejects(f('https://x/addresses/q/utxos'), /too large/);
});
