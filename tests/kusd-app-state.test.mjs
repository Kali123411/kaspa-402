// The app never builds against relay state it hasn't checked against a Kaspa node itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadClient } from '../lib/kusd/client.mjs';
import { verifyBox, loadState, canAct, utxosFromSdk } from '../lib/kusd/app/state.mjs';
import { coinsFromUtxos } from '../lib/kusd/app/coins.mjs';

const { boxAddress } = loadClient();
const golden = JSON.parse(readFileSync(new URL('./fixtures/kusd-golden.json', import.meta.url), 'utf8'));
const hex = (a) => Buffer.from(a).toString('hex');
const KINDS = ['oracle', 'psm', 'budget', 'authority', 'surplus', 'factory'];
const proto = golden.cases.swap_in.request.protocol;
const holderLive = golden.cases.swap_out.request.params.holder;
const vaultLive = golden.cases.mint.request.params.vault;
const OWNER = hex(holderLive.state.owner);
const entryOf = (kind, l) => ({ kind, covid: hex(l.covid), outpoint: l.outpoint, value: l.value, state: l.state });
const pins = Object.fromEntries(KINDS.map((k) => [k, hex(proto[k].covid)]));

/** A fake relay answer and a fake node holding exactly `onChain` entries. */
function world({ relay, onChain }) {
  const fetchJson = async (url) => {
    if (relay instanceof Error) throw relay;
    assert.match(url, /^https:\/\/relay\.test\/state(\?owner=[0-9a-f]{64})?$/);
    return relay;
  };
  const getUtxos = async (address) => onChain
    .filter((e) => boxAddress(e.kind, e.state) === address)
    .map((e) => ({ outpoint: e.outpoint, amount: e.value, covenantId: e.covid }));
  return { relayUrl: 'https://relay.test/state', owner: OWNER, pins, boxAddress, getUtxos, fetchJson };
}
const receiptEntries = proto.receipts.map((l) => entryOf('receipt', l));
const protocolEntries = { ...Object.fromEntries(KINDS.map((k) => [k, entryOf(k, proto[k])])), receipts: receiptEntries };
const userEntries = { holders: [entryOf('holder', holderLive)], vaults: [entryOf('vault', vaultLive)] };
const everything = [...KINDS.map((k) => protocolEntries[k]), ...receiptEntries, ...userEntries.holders, ...userEntries.vaults];

test('all_verified_protocol_assembles', async () => {
  const s = await loadState(world({ relay: { protocol: protocolEntries, ...userEntries }, onChain: everything }));
  assert.deepEqual(s.problems, []);
  for (const k of KINDS) assert.deepEqual(s.protocol[k], proto[k]);
  assert.deepEqual(s.protocol.receipts, proto.receipts);
  assert.deepEqual(s.holders, [holderLive]);
  assert.deepEqual(s.vaults, [vaultLive]);
  assert.deepEqual(canAct(s), { ok: true });
});

test('one_bad_protocol_box_disables_actions', async () => {
  const tampered = { ...protocolEntries, oracle: { ...protocolEntries.oracle, state: { ...protocolEntries.oracle.state, mint: 999 } } };
  const s = await loadState(world({ relay: { protocol: tampered, holders: [], vaults: [] }, onChain: everything }));
  assert.equal(s.protocol, null);
  const a = canAct(s);
  assert.equal(a.ok, false);
  assert.match(a.reason, /oracle/);
});

test('actions_disabled_without_verified_state', async () => {
  const s = await loadState(world({ relay: new Error('connect ECONNREFUSED'), onChain: everything }));
  assert.equal(s.protocol, null);
  assert.match(canAct(s).reason, /relay/);
});

test('foreign_covid_rejected', async () => {
  const onChain = everything.map((e) => (e.kind === 'psm' ? { ...e, covid: 'ee'.repeat(32) } : e));
  const s = await loadState(world({ relay: { protocol: protocolEntries, holders: [], vaults: [] }, onChain }));
  assert.equal(s.protocol, null);
  assert.match(canAct(s).reason, /psm/);
  const r = await verifyBox(protocolEntries.psm, world({ relay: {}, onChain }));
  assert.equal(r.ok, false);
});

test('a relay entry under an unpinned covenant is refused even if it is on chain', async () => {
  const fake = { ...protocolEntries.budget, covid: 'ee'.repeat(32) };
  const s = await loadState(world({ relay: { protocol: { ...protocolEntries, budget: fake }, holders: [], vaults: [] }, onChain: [...everything, fake] }));
  assert.equal(s.protocol, null);
  assert.match(canAct(s).reason, /budget/);
});

test('spent_user_box_dropped', async () => {
  const onChain = everything.filter((e) => e.kind !== 'holder');
  const s = await loadState(world({ relay: { protocol: protocolEntries, ...userEntries }, onChain }));
  assert.deepEqual(s.holders, []);
  assert.deepEqual(s.vaults, [vaultLive]);
  assert.equal(s.problems.length, 1);
  assert.match(s.problems[0], /holder/);
  assert.equal(canAct(s).ok, true);
});

test('someone else\'s boxes from the relay are dropped', async () => {
  const theirs = entryOf('holder', { ...holderLive, state: { ...holderLive.state, owner: Array(32).fill(9) } });
  const s = await loadState(world({ relay: { protocol: protocolEntries, holders: [theirs], vaults: [] }, onChain: [...everything, theirs] }));
  assert.deepEqual(s.holders, []);
});

test('SDK UTXO entries are read with the covenant id from their entry', () => {
  const sdkEntry = { outpoint: { transactionId: 'ab'.repeat(32), index: 1 }, amount: 5n, entry: { covenantId: 'cd'.repeat(32) } };
  assert.deepEqual(utxosFromSdk([sdkEntry]), [{ outpoint: { transactionId: 'ab'.repeat(32), index: 1 }, amount: 5, covenantId: 'cd'.repeat(32) }]);
  const own = '000020' + '44'.repeat(32) + 'ac';
  const covBox = { ...sdkEntry, scriptPublicKey: { version: 0, script: '20' + '44'.repeat(32) + 'ac' }, blockDaaScore: 1n, isCoinbase: false };
  assert.deepEqual(coinsFromUtxos([covBox], own), []);
});

test('an SDK Hash covenant id is read as hex', () => {
  class Hash { constructor(h) { this.h = h; } toString() { return this.h; } }
  const sdkEntry = { outpoint: { transactionId: 'ab'.repeat(32), index: 0 }, amount: 5n, entry: { covenantId: new Hash('cd'.repeat(32)) } };
  assert.equal(utxosFromSdk([sdkEntry])[0].covenantId, 'cd'.repeat(32));
  assert.equal(utxosFromSdk([{ ...sdkEntry, entry: { covenantId: undefined } }])[0].covenantId, null);
});

test('own just-created boxes stand in when the relay lags', async () => {
  // the relay still serves an older (spent) oracle; this page created the live one
  const stale = { ...protocolEntries.oracle, outpoint: { transactionId: 'ee'.repeat(32), index: 0 } };
  const w = world({ relay: { protocol: { ...protocolEntries, oracle: stale }, holders: [], vaults: [] }, onChain: everything });
  const s = await loadState({ ...w, local: { protocol: { oracle: protocolEntries.oracle }, holders: userEntries.holders, vaults: [] } });
  assert.deepEqual(s.problems, []);
  assert.deepEqual(s.protocol.oracle, proto.oracle);
  assert.deepEqual(s.holders, [holderLive]);
});

test('own boxes are verified like relay boxes', async () => {
  const forged = { ...protocolEntries.oracle, covid: 'ee'.repeat(32) };
  const w = world({ relay: { protocol: { ...protocolEntries, oracle: undefined }, holders: [], vaults: [] }, onChain: [...everything, forged] });
  const s = await loadState({ ...w, local: { protocol: { oracle: forged }, holders: [], vaults: [] } });
  assert.equal(s.protocol, null);
});

test('a box from both the relay and this page is listed once', async () => {
  const w = world({ relay: { protocol: protocolEntries, ...userEntries }, onChain: everything });
  const s = await loadState({ ...w, local: { protocol: {}, holders: userEntries.holders, vaults: userEntries.vaults } });
  assert.equal(s.holders.length, 1);
  assert.equal(s.vaults.length, 1);
});

test('a briefly unverifiable state is re-read before giving up', async () => {
  const { untilVerified } = await import('../lib/kusd/app/state.mjs');
  const views = [{ chain: { protocol: null, problems: ['budget: the node holds no unspent box'] } }, { chain: { protocol: { ok: 1 }, problems: [] } }];
  let reads = 0;
  const v = await untilVerified(async () => { reads++; return views.shift(); }, { sleep: async () => {} });
  assert.equal(reads, 2);
  assert.deepEqual(v.chain.protocol, { ok: 1 });
});

test('the re-read outlasts a minute of relay lag', async () => {
  // the relay's TN10 API has lagged the node by up to a minute; the review should wait that out
  const { untilVerified } = await import('../lib/kusd/app/state.mjs');
  const lagging = { chain: { protocol: null, problems: ['psm: the node holds no unspent box'] } };
  let reads = 0;
  let waited = 0;
  const v = await untilVerified(async () => (++reads * 3_000 > 60_000 ? { chain: { protocol: { ok: 1 }, problems: [] } } : lagging), { sleep: async (ms) => { waited += ms; } });
  assert.deepEqual(v.chain.protocol, { ok: 1 });
  assert.ok(waited <= 90_000, `waited ${waited} ms`);
});

test('a persistently unverifiable state fails with the reason', async () => {
  const { untilVerified } = await import('../lib/kusd/app/state.mjs');
  let reads = 0;
  await assert.rejects(untilVerified(async () => { reads++; return { chain: { protocol: null, problems: ['oracle: the box on chain is under a different covenant'] } }; }, { tries: 3, sleep: async () => {} }), /oracle/);
  assert.equal(reads, 3);
});

test('an unreachable relay is not retried', async () => {
  const { untilVerified } = await import('../lib/kusd/app/state.mjs');
  let reads = 0;
  await assert.rejects(untilVerified(async () => { reads++; return { chain: { protocol: null, problems: ['the state relay is unreachable (x)'], relayDown: true } }; }, { sleep: async () => {} }), /relay/);
  assert.equal(reads, 1);
});

test('a spent box from this page\'s own record is dropped quietly', async () => {
  const onChain = everything.filter((e) => e.kind !== 'holder');
  const w = world({ relay: { protocol: protocolEntries, holders: [], vaults: [] }, onChain });
  const s = await loadState({ ...w, local: { protocol: {}, holders: userEntries.holders, vaults: [] } });
  assert.deepEqual(s.holders, []);
  assert.deepEqual(s.problems, []);
});

test('no verified receipt disables actions, and a stale one is not used', async () => {
  // consumers read a receipt: without one carrying the oracle's current price the app does not build
  const none = await loadState(world({ relay: { protocol: { ...protocolEntries, receipts: [] }, holders: [], vaults: [] }, onChain: everything }));
  assert.equal(none.protocol, null);
  assert.match(canAct(none).reason, /receipt/);
  const staleState = { ...receiptEntries[0].state, mint: receiptEntries[0].state.mint + 1 };
  const stale = { ...receiptEntries[0], state: staleState };
  const s = await loadState(world({ relay: { protocol: { ...protocolEntries, receipts: [stale] }, holders: [], vaults: [] }, onChain: [...everything, stale] }));
  assert.equal(s.protocol, null, 'a receipt with another price is never read');
});
