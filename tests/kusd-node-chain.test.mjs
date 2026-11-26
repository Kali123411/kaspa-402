// lib/kusd/node-chain.mjs: the relay's view of our own node's UTXO set, from the Kaspa SDK's RpcClient.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nodeChain } from '../lib/kusd/node-chain.mjs';

const ADDR = 'kaspatest:pqnle4t7arvlcetn9u3zg95hd8840t9slkj2xsvphrm25ye23d77va4tz42zd';

test('utxos maps the sdk entries and asks once per call', async () => {
  const asked = [];
  const rpc = {
    async getUtxosByAddresses({ addresses }) {
      asked.push(addresses);
      return { entries: [{ address: { toString: () => ADDR }, outpoint: { transactionId: 'e5'.repeat(32), index: 1 }, amount: 100000000n, entry: { covenantId: { toString: () => '8b'.repeat(32) } } }] };
    },
  };
  const chain = nodeChain({ rpc });
  const got = await chain.utxos([ADDR, ADDR]);
  assert.deepEqual(asked, [[ADDR]]);
  assert.deepEqual(got, [{ address: ADDR, transactionId: 'e5'.repeat(32), index: 1, amount: 100000000n, covenantId: '8b'.repeat(32) }]);
});

test('a box with no covenant id maps to null', async () => {
  const rpc = { async getUtxosByAddresses() { return { entries: [{ address: ADDR, outpoint: { transactionId: 'aa'.repeat(32), index: 0 }, amount: 5n, entry: {} }] }; } };
  const [u] = await nodeChain({ rpc }).utxos([ADDR]);
  assert.equal(u.covenantId, null);
});

test('a node that does not answer in time is an error the relay retries', async () => {
  const rpc = { getUtxosByAddresses: () => new Promise(() => {}) };
  await assert.rejects(nodeChain({ rpc, timeoutMs: 50 }).utxos([ADDR]), /node did not answer/);
});

// Reconnect (2026-11-26): after a reboot the relay's connection stopped answering and every verification failed for
// four hours. With a `connect` factory the chain drops a connection that fails `dropAfter` calls in a row (or the
// probe) and connects a fresh one.
const okRpc = (tag, log) => ({
  tag,
  async getUtxosByAddresses() { return { entries: [{ address: ADDR, outpoint: { transactionId: 'ab'.repeat(32), index: 0 }, amount: 1n, entry: {} }] }; },
  async getServerInfo() { return { virtualDaaScore: 1n }; },
  async disconnect() { log.push(`disconnect ${tag}`); },
});
const deadRpc = (tag, log) => ({
  tag,
  getUtxosByAddresses: () => new Promise(() => {}),
  getServerInfo: () => new Promise(() => {}),
  async disconnect() { log.push(`disconnect ${tag}`); },
});

test('a connection that stops answering is dropped and a fresh one serves the next call', async () => {
  const log = [];
  const made = [deadRpc('a', log), okRpc('b', log)];
  const chain = nodeChain({ connect: async () => made.shift(), timeoutMs: 30, dropAfter: 2 });
  await assert.rejects(chain.utxos([ADDR]), /node did not answer/);
  assert.equal(chain.stats().connected, true); // one failure: kept
  await assert.rejects(chain.utxos([ADDR]), /node did not answer/);
  assert.equal(chain.stats().connected, false); // second in a row: dropped
  assert.deepEqual(log, ['disconnect a']);
  const got = await chain.utxos([ADDR]);
  assert.equal(got.length, 1);
  assert.deepEqual(chain.stats(), { connected: true, failures: 0, reconnects: 2 });
});

test('the probe catches a silent connection with no traffic', async () => {
  const log = [];
  const made = [deadRpc('a', log), okRpc('b', log)];
  const chain = nodeChain({ connect: async () => made.shift(), timeoutMs: 30, dropAfter: 2 });
  await assert.rejects(chain.probe());
  await assert.rejects(chain.probe());
  await chain.probe();
  assert.deepEqual(log, ['disconnect a']);
  assert.equal(chain.stats().reconnects, 2);
});

test('a connect that never settles times out, is torn down, and is retried on the next call', async () => {
  const log = [];
  let n = 0;
  const hung = { getUtxosByAddresses: () => new Promise(() => {}), async disconnect() { log.push('disconnect hung'); } };
  const chain = nodeChain({
    connect: async ({ abandon }) => {
      n += 1;
      if (n === 1) { abandon(hung); return new Promise(() => {}); }
      return okRpc('b', log);
    },
    timeoutMs: 30,
  });
  await assert.rejects(chain.utxos([ADDR]), /could not connect to the node/);
  assert.deepEqual(log, ['disconnect hung']);
  assert.equal((await chain.utxos([ADDR])).length, 1);
});

test('a plain rpc (no factory) is never dropped', async () => {
  const log = [];
  const chain = nodeChain({ rpc: deadRpc('a', log), timeoutMs: 20, dropAfter: 1 });
  await assert.rejects(chain.utxos([ADDR]));
  await assert.rejects(chain.utxos([ADDR]));
  assert.deepEqual(log, []);
  assert.equal(chain.stats().connected, true);
});

test('watch probes on its interval and stops', async () => {
  let probes = 0;
  const rpc = { async getServerInfo() { probes += 1; return {}; }, async getUtxosByAddresses() { return { entries: [] }; } };
  const chain = nodeChain({ rpc, timeoutMs: 50 });
  const stop = chain.watch(10);
  await new Promise((r) => setTimeout(r, 55));
  stop();
  const seen = probes;
  await new Promise((r) => setTimeout(r, 30));
  assert.ok(seen >= 3, `probed ${seen} times`);
  assert.equal(probes, seen);
});
