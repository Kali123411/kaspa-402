// The relay verifying against our own TN10 node (deps.chain) instead of the public API: the node's UTXO set is the
// whole proof (a box exists, is accepted and unspent at the address its state implies, carrying the pinned covenant
// id and the claimed value). Consensus lets a box carry a covenant id only as a valid continuation, so no
// transaction lookup is needed; stale entries are pruned by liveness instead of by the spending transaction.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadClient } from '../lib/kusd/client.mjs';
import { accept, read, makeRetryQueue } from '../lib/kusd/relay.mjs';

const golden = JSON.parse(readFileSync(new URL('./fixtures/kusd-golden.json', import.meta.url), 'utf8'));
const { boxAddress } = loadClient();
const pins = { oracle: '07'.repeat(32), psm: '66'.repeat(32), budget: '88'.repeat(32), authority: '42'.repeat(32), surplus: '77'.repeat(32), miner: '4d'.repeat(32), factory: '99'.repeat(32) };
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

/** A fake node: `live` is the UTXO set, [{kind, state, covid, txid, index, value}]; `calls` counts queries. */
function fakeNode(live) {
  const node = {
    live,
    calls: 0,
    fetchJson: async (url) => { throw new Error(`the public API must not be used (${url})`); },
    async utxos(addresses) {
      node.calls += 1;
      return node.live.filter((b) => addresses.includes(boxAddress(b.kind, b.state)))
        .map((b) => ({ address: boxAddress(b.kind, b.state), transactionId: b.txid, index: b.index, amount: BigInt(b.value), covenantId: b.covid }));
    },
  };
  return node;
}

const entry = (b) => ({ kind: b.kind, covid: b.covid, outpoint: { transactionId: b.txid, index: b.index }, value: b.value, state: b.state });
const oracleBox = { kind: 'oracle', state: oracleState, covid: pins.oracle, txid: 'a1'.repeat(32), index: 0, value: 100_000_000 };
const deps = (node, store) => ({ chain: node, fetchJson: node.fetchJson, boxAddress, pins, api: 'https://unused.test', store });

test('a box in the node utxo set is accepted without the public api', async () => {
  const node = fakeNode([oracleBox]);
  const store = memStore();
  const [r] = await accept([entry(oracleBox)], deps(node, store));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal((await read(store)).protocol.oracle.outpoint.transactionId, oracleBox.txid);
});

test('a box missing from the utxo set is retried, not stored', async () => {
  const node = fakeNode([]);
  const store = memStore();
  const queue = makeRetryQueue();
  const [r] = await accept([entry(oracleBox)], { ...deps(node, store), queue, client: 'test' });
  assert.equal(r.ok, false);
  assert.equal(r.queued, true);
  assert.match(r.reason, /not in the node's UTXO set/);
  assert.equal((await read(store)).protocol.oracle, undefined);
});

test('a covenant id or value that differs from the node is refused', async () => {
  const wrongCovid = fakeNode([{ ...oracleBox, covid: '08'.repeat(32) }]);
  const [a] = await accept([entry(oracleBox)], deps(wrongCovid, memStore()));
  assert.equal(a.ok, false);
  assert.match(a.reason, /another covenant id/);
  const wrongValue = fakeNode([{ ...oracleBox, value: 99_999_999 }]);
  const [b] = await accept([entry(oracleBox)], deps(wrongValue, memStore()));
  assert.equal(b.ok, false);
  assert.match(b.reason, /value does not match/);
});

test('a stored protocol box gives way once the node no longer holds it', async () => {
  const node = fakeNode([oracleBox]);
  const store = memStore();
  await accept([entry(oracleBox)], deps(node, store));
  const next = { ...oracleBox, txid: 'a2'.repeat(32), state: { ...oracleState, epoch: oracleState.epoch + 1 } };
  node.live = [oracleBox, next];
  const [kept] = await accept([entry(next)], deps(node, store));
  assert.equal(kept.ok, false, 'the old box is still unspent');
  node.live = [next];
  const [r] = await accept([entry(next)], deps(node, store));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal((await read(store)).protocol.oracle.outpoint.transactionId, next.txid);
});

test("an owner's spent box is pruned when the node no longer holds it", async () => {
  const owner = Buffer.from(holderState.owner).toString('hex');
  const h1 = { kind: 'holder', state: holderState, covid: pins.authority, txid: 'b1'.repeat(32), index: 1, value: 100_000_000 };
  const h2 = { kind: 'holder', state: { ...holderState, amount: holderState.amount + 1 }, covid: pins.authority, txid: 'b2'.repeat(32), index: 1, value: 100_000_000 };
  const node = fakeNode([h1]);
  const store = memStore();
  assert.equal((await accept([entry(h1)], deps(node, store)))[0].ok, true);
  node.live = [h2];
  assert.equal((await accept([entry(h2)], deps(node, store)))[0].ok, true);
  const mine = (await read(store, { owner })).holders;
  assert.deepEqual(mine.map((e) => e.outpoint.transactionId), [h2.txid]);
});

test('the relay server verifies against the node when given one', async () => {
  const { makeServer } = await import('../services/kusd-relay/server.mjs');
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { openFileStore } = await import('../lib/kusd/file-store.mjs');
  const node = fakeNode([oracleBox]);
  const server = makeServer({ store: openFileStore(join(mkdtempSync(join(tmpdir(), 'relay-node-')), 'store.json')), chain: node, fetchJson: node.fetchJson, boxAddress, pins, api: 'https://unused.test' });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const res = await (await fetch(`${base}/state`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entries: [entry(oracleBox)] }) })).json();
    assert.equal(res.results[0].ok, true, JSON.stringify(res));
    assert.ok(node.calls >= 1);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
