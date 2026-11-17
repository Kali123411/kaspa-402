// The relay re-checks entries it could not verify yet (its TN10 API lags the node by up to a minute),
// so one delivery from the box's creator is enough even if the creator goes away.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadClient } from '../lib/kusd/client.mjs';
import { accept, read, makeRetryQueue } from '../lib/kusd/relay.mjs';
import { openFileStore } from '../lib/kusd/file-store.mjs';
import { makeServer } from '../services/kusd-relay/server.mjs';

const golden = JSON.parse(readFileSync(new URL('./fixtures/kusd-golden.json', import.meta.url), 'utf8'));
const { boxAddress } = loadClient();
const API = 'https://tn10.test';
const pins = { oracle: '07'.repeat(32), psm: '66'.repeat(32), budget: '88'.repeat(32), authority: '42'.repeat(32), surplus: '77'.repeat(32) };
const oracleState = golden.box_address.request.state;
const holderState = golden.cases.swap_in.created.find((c) => c.kind === 'holder').state;

function memStore() {
  const kv = new Map();
  return {
    async get(k) { return kv.get(k) ?? null; },
    async set(k, v) { kv.set(k, v); },
    async del(k) { kv.delete(k); },
    async hset(k, f, v) { const h = kv.get(k) || {}; h[f] = v; kv.set(k, h); },
    async hdel(k, f) { const h = kv.get(k); if (h) delete h[f]; },
    async hgetall(k) { return { ...(kv.get(k) || {}) }; },
  };
}

/** A fake TN10 API that has indexed only what `api.indexed` holds: `{txs: Set, utxos: Set}` of txids. */
function laggingApi(boxes) {
  const api = { indexed: { txs: new Set(), utxos: new Set() }, calls: 0 };
  api.fetchJson = async (url) => {
    api.calls++;
    const tx = url.match(/\/transactions\/([0-9a-f]{64})$/);
    if (tx) {
      if (!api.indexed.txs.has(tx[1])) throw new Error('HTTP 404');
      const outs = boxes.filter((b) => b.txid === tx[1]);
      return { is_accepted: true, inputs: [], outputs: outs.map((b) => ({ index: b.index, amount: b.value, covenant_id: b.covid, script_public_key_address: boxAddress(b.kind, b.state) })) };
    }
    const ad = url.match(/\/addresses\/([^/]+)\/utxos$/);
    return boxes.filter((b) => api.indexed.utxos.has(b.txid) && boxAddress(b.kind, b.state) === ad[1])
      .map((b) => ({ outpoint: { transactionId: b.txid, index: b.index } }));
  };
  api.catchUp = (txid) => { api.indexed.txs.add(txid); api.indexed.utxos.add(txid); };
  return api;
}

const entry = (b) => ({ kind: b.kind, covid: b.covid, outpoint: { transactionId: b.txid, index: b.index }, value: b.value, state: b.state });
const oracleBox = { kind: 'oracle', state: oracleState, covid: pins.oracle, txid: 'a1'.repeat(32), index: 3, value: 100_000_000 };
const holderBox = { kind: 'holder', state: holderState, covid: pins.authority, txid: 'b2'.repeat(32), index: 2, value: 100_000_000 };

function setup({ windowMs = 300_000, max = 64 } = {}) {
  const clock = { t: 1_000_000 };
  const api = laggingApi([oracleBox, holderBox]);
  const queue = makeRetryQueue({ now: () => clock.t, windowMs, max });
  const store = memStore();
  const deps = { store, fetchJson: api.fetchJson, boxAddress, pins, api: API, queue };
  return { clock, api, queue, store, deps };
}

test('unindexed_transaction_queued_then_stored_when_the_api_catches_up', async () => {
  const { clock, api, queue, store, deps } = setup();
  const [r] = await accept([entry(oracleBox)], deps);
  assert.equal(r.ok, false);
  assert.match(r.reason, /^could not verify/);
  assert.equal(r.queued, true);
  assert.equal(queue.size, 1);

  clock.t += 5_000;
  assert.equal(await queue.drain(deps), 0, 'still not indexed: nothing stored');
  assert.equal(queue.size, 1);
  api.catchUp(oracleBox.txid);
  clock.t += 10_000;
  assert.equal(await queue.drain(deps), 1);
  assert.equal(queue.size, 0);
  assert.equal((await read(store)).protocol.oracle.outpoint.transactionId, oracleBox.txid);
});

test('unindexed_utxo_queued_then_stored', async () => {
  // the transaction is indexed but its outputs are not in the address index yet: reads as "already spent"
  const { clock, api, queue, store, deps } = setup();
  api.indexed.txs.add(holderBox.txid);
  const [r] = await accept([entry(holderBox)], deps);
  assert.equal(r.reason, 'already spent');
  assert.equal(r.queued, true);
  api.catchUp(holderBox.txid);
  clock.t += 5_000;
  assert.equal(await queue.drain(deps), 1);
  const owner = Buffer.from(holderState.owner).toString('hex');
  assert.equal((await read(store, { owner })).holders.length, 1);
});

test('rechecks_back_off', async () => {
  // 5 s, then 10 s, 20 s, capped at 30 s: a never-indexed entry costs a handful of API calls
  const { clock, api, deps, queue } = setup();
  await accept([entry(oracleBox)], deps);
  const checks = [];
  for (let s = 1; s <= 120; s++) {
    clock.t += 1_000;
    const before = api.calls;
    await queue.drain(deps);
    if (api.calls > before) checks.push(s);
  }
  assert.deepEqual(checks, [5, 15, 35, 65, 95]);
});

test('refused_entry_not_queued', async () => {
  const { queue, deps } = setup();
  const [r] = await accept([{ ...entry(oracleBox), covid: '99'.repeat(32) }], deps);
  assert.match(r.reason, /pinned oracle/);
  assert.equal(r.queued, undefined);
  assert.equal(queue.size, 0);
});

test('queued_entries_dropped_after_the_window', async () => {
  const { clock, api, queue, deps } = setup({ windowMs: 60_000 });
  await accept([entry(oracleBox)], deps);
  clock.t += 60_001;
  const before = api.calls;
  assert.equal(await queue.drain(deps), 0);
  assert.equal(queue.size, 0);
  assert.equal(api.calls, before, 'an expired entry costs no API call');
});

test('queue_bounded_and_deduplicated', async () => {
  const { queue, deps } = setup({ max: 1 });
  const [a] = await accept([entry(oracleBox)], deps);
  const [again] = await accept([entry(oracleBox)], deps);
  const [b] = await accept([entry(holderBox)], deps);
  assert.equal(a.queued, true);
  assert.equal(again.queued, true, 'a repeat delivery is already queued');
  assert.equal(b.queued, false, 'the queue is full');
  assert.equal(queue.size, 1);
});

test('remembered_spent_entry_dropped_from_the_queue', async () => {
  // queued while unindexed; meanwhile a verified transaction spent it
  const { api, queue, store, deps } = setup();
  api.indexed.txs.add(holderBox.txid);
  await accept([entry(holderBox)], deps);
  await store.set('kusd:spent', JSON.stringify([`${holderBox.txid}:${holderBox.index}`]));
  const before = api.calls;
  assert.equal(await queue.drain(deps), 0);
  assert.equal(queue.size, 0);
  assert.equal(api.calls, before);
});

test('server_drains_its_queue_on_its_own', async () => {
  const api = laggingApi([oracleBox]);
  const dir = mkdtempSync(join(tmpdir(), 'kusd-relay-'));
  const server = makeServer({ store: openFileStore(join(dir, 'store.json')), fetchJson: api.fetchJson, boxAddress, pins, api: API, retryEveryMs: 20, queue: makeRetryQueue({ firstMs: 0 }) });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const res = await (await fetch(`${base}/state`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entries: [entry(oracleBox)] }) })).json();
    assert.equal(res.results[0].queued, true);
    assert.equal((await (await fetch(`${base}/health`)).json()).queued, 1);
    api.catchUp(oracleBox.txid);
    for (let i = 0; i < 100 && !(await (await fetch(`${base}/state`)).json()).protocol.oracle; i++) await new Promise((r) => setTimeout(r, 20));
    assert.equal((await (await fetch(`${base}/state`)).json()).protocol.oracle.outpoint.transactionId, oracleBox.txid);
    assert.equal((await (await fetch(`${base}/health`)).json()).queued, 0);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('one_client_cannot_fill_the_queue', async () => {
  const { queue, deps } = setup();
  const junk = (i) => ({ ...entry(oracleBox), outpoint: { transactionId: i.toString(16).padStart(2, '0').repeat(32), index: 3 } });
  const results = [];
  for (let i = 0; i < 9; i++) results.push((await accept([junk(i + 16)], { ...deps, client: 'x' }))[0].queued);
  assert.deepEqual(results, [true, true, true, true, true, true, true, true, false]);
  const [honest] = await accept([entry(holderBox)], { ...deps, client: 'y' });
  assert.equal(honest.queued, true);
  assert.equal(queue.size, 9);
});

test('forged_copy_does_not_hold_the_honest_slot', async () => {
  // a front-runner posts the real outpoint and state with a wrong value before the API indexes it
  const { clock, api, queue, store, deps } = setup();
  const [forged] = await accept([{ ...entry(oracleBox), value: oracleBox.value + 1 }], { ...deps, client: 'x' });
  const [honest] = await accept([entry(oracleBox)], { ...deps, client: 'y' });
  assert.equal(forged.queued, true);
  assert.equal(honest.queued, true);
  assert.equal(queue.size, 2);
  api.catchUp(oracleBox.txid);
  clock.t += 5_000;
  assert.equal(await queue.drain(deps), 1);
  assert.equal(queue.size, 0);
  assert.equal((await read(store)).protocol.oracle.value, oracleBox.value);
});
