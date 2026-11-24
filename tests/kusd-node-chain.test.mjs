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
