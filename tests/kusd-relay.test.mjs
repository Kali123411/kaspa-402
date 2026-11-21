// The kUSD state relay: an entry is stored only after the TN10 API confirms its address (the P2SH of
// its claimed state), its covenant ID, its value and that it is unspent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadClient } from '../lib/kusd/client.mjs';
import { accept, read, parseEntry, pinsFromSnapshot, RelayInputError } from '../lib/kusd/relay.mjs';

const golden = JSON.parse(readFileSync(new URL('./fixtures/kusd-golden.json', import.meta.url), 'utf8'));
const { boxAddress } = loadClient();
const hex = (b) => Buffer.from(b).toString('hex');
const API = 'https://tn10.test';

const pins = { oracle: '07'.repeat(32), psm: '66'.repeat(32), budget: '88'.repeat(32), authority: '42'.repeat(32), surplus: '77'.repeat(32), miner: '4d'.repeat(32), factory: '99'.repeat(32) };
const oracleState = golden.box_address.request.state;
const holderState = golden.cases.swap_in.created.find((c) => c.kind === 'holder').state;
const vaultLive = golden.cases.mint.request.params.vault;

function memStore() {
  const kv = new Map();
  return {
    kv,
    async get(k) { return kv.get(k) ?? null; },
    async set(k, v) { kv.set(k, v); },
    async del(k) { kv.delete(k); },
    async hset(k, f, v) { const h = kv.get(k) || {}; h[f] = v; kv.set(k, h); },
    async hdel(k, f) { const h = kv.get(k); if (h) delete h[f]; },
    async hgetall(k) { return { ...(kv.get(k) || {}) }; },
  };
}

/** A fake TN10 API: `boxes` = [{kind, state, covid, txid, index, value, unspent=true, outCovid?, outValue?}], `inputs` per txid. */
function fakeApi(boxes, inputs = {}, inputCovids = {}) {
  return async (url) => {
    const tx = url.match(/\/transactions\/([0-9a-f]{64})$/);
    if (tx) {
      const outs = boxes.filter((b) => b.txid === tx[1]);
      if (!outs.length) throw new Error('HTTP 404');
      return {
        is_accepted: true,
        outputs: outs.map((b) => ({ index: b.index, amount: b.outValue ?? b.value, covenant_id: b.outCovid ?? b.covid, script_public_key_address: boxAddress(b.kind, b.state) })),
        inputs: (inputs[tx[1]] || []).map(([h, i], k) => ({ previous_outpoint_hash: h, previous_outpoint_index: String(i), covenant_id: (inputCovids[tx[1]] || [])[k] ?? null })),
      };
    }
    const ad = url.match(/\/addresses\/([^/]+)\/utxos$/);
    if (ad) {
      return boxes.filter((b) => b.unspent !== false && boxAddress(b.kind, b.state) === ad[1])
        .map((b) => ({ outpoint: { transactionId: b.txid, index: b.index }, utxoEntry: { amount: String(b.value) } }));
    }
    throw new Error(`unexpected ${url}`);
  };
}

const entry = (b) => ({ kind: b.kind, covid: b.covid, outpoint: { transactionId: b.txid, index: b.index }, value: b.value, state: b.state });
const oracleBox = { kind: 'oracle', state: oracleState, covid: pins.oracle, txid: 'a1'.repeat(32), index: 3, value: 100_000_000 };
const deps = (boxes, inputs, inputCovids) => ({ fetchJson: fakeApi(boxes, inputs, inputCovids), boxAddress, pins, api: API });

test('valid_protocol_entry_accepted_and_read_back', async () => {
  const store = memStore();
  const [r] = await accept([entry(oracleBox)], { ...deps([oracleBox]), store });
  assert.equal(r.ok, true, r.reason);
  const state = await read(store, {});
  assert.deepEqual(state.protocol.oracle.outpoint, { transactionId: oracleBox.txid, index: 3 });
  assert.deepEqual(state.protocol.oracle.state, oracleState);
});

test('wrong_covid_rejected', async () => {
  const store = memStore();
  const lookalike = { ...oracleBox, outCovid: 'ee'.repeat(32) };
  assert.equal((await accept([entry(lookalike)], { ...deps([lookalike]), store }))[0].reason, 'creating output carries another covenant id');
  const notPinned = { ...oracleBox, covid: 'ee'.repeat(32) };
  assert.equal((await accept([entry(notPinned)], { ...deps([notPinned]), store }))[0].reason, 'covid is not the pinned oracle covenant');
  assert.equal(store.kv.size, 0);
});

test('state_not_matching_address_rejected', async () => {
  const store = memStore();
  const claimed = entry({ ...oracleBox, state: { ...oracleState, price: oracleState.price + 1 } });
  const [r] = await accept([claimed], { ...deps([oracleBox]), store });
  assert.equal(r.reason, 'address does not match the claimed state');
});

test('stale_entry_rejected_as_spent', async () => {
  const store = memStore();
  const spent = { ...oracleBox, unspent: false };
  assert.equal((await accept([entry(spent)], { ...deps([spent]), store }))[0].reason, 'already spent');
  assert.equal(store.kv.size, 0);
});

test('value_mismatch_rejected', async () => {
  const store = memStore();
  const b = { ...oracleBox, outValue: 99 };
  assert.equal((await accept([entry(b)], { ...deps([b]), store }))[0].reason, 'value does not match');
});

test('api_failure_is_unverified_not_stored', async () => {
  const store = memStore();
  const failing = { fetchJson: async () => { throw new Error('timeout'); }, boxAddress, pins, api: API };
  const [r] = await accept([entry(oracleBox)], { ...failing, store });
  assert.equal(r.ok, false);
  assert.match(r.reason, /^could not verify: timeout/);
  assert.equal(store.kv.size, 0);
});

test('vault_wired_elsewhere_rejected', async () => {
  const store = memStore();
  const state = { ...vaultLive.state, oracle_id: Array(32).fill(1) };
  const v = { kind: 'vault', state, covid: hex(vaultLive.covid), txid: 'b1'.repeat(32), index: 0, value: vaultLive.value };
  assert.equal((await accept([entry(v)], { ...deps([v]), store }))[0].reason, 'vault is not wired to this protocol');
});

test('spent_owner_boxes_pruned', async () => {
  const store = memStore();
  const a = { kind: 'holder', state: holderState, covid: pins.authority, txid: 'c1'.repeat(32), index: 2, value: 100_000_000 };
  const b = { kind: 'holder', state: { ...holderState, amount: holderState.amount - 1 }, covid: pins.authority, txid: 'c2'.repeat(32), index: 0, value: 100_000_000 };
  await accept([entry(a)], { ...deps([a]), store });
  assert.equal((await read(store, { owner: hex(holderState.owner) })).holders.length, 1);
  // b's transaction spends a
  const [r] = await accept([entry(b)], { ...deps([b], { [b.txid]: [[a.txid, a.index]] }), store });
  assert.equal(r.ok, true, r.reason);
  const mine = await read(store, { owner: hex(holderState.owner) });
  assert.deepEqual(mine.holders.map((h) => h.outpoint.transactionId), [b.txid]);
});

test('read_returns_protocol_and_owner_boxes', async () => {
  const store = memStore();
  const v = { kind: 'vault', state: vaultLive.state, covid: hex(vaultLive.covid), txid: 'b2'.repeat(32), index: 0, value: vaultLive.value };
  // the fixture vault has debt, so it must be a continuation: its tx spends a box of the same covid
  const res = await accept([entry(oracleBox), entry(v)], { ...deps([oracleBox, v], { [v.txid]: [['f0'.repeat(32), 0]] }, { [v.txid]: [hex(vaultLive.covid)] }), store });
  assert.deepEqual(res.map((r) => r.ok), [true, true]);
  const got = await read(store, { owner: hex(vaultLive.state.owner) });
  assert.ok(got.protocol.oracle);
  assert.equal(got.vaults.length, 1);
  assert.equal(got.holders.length, 0);
});

test('malformed entries are input errors', () => {
  assert.throws(() => parseEntry({ ...entry(oracleBox), kind: 'liquidator' }, { boxAddress }), RelayInputError);
  assert.throws(() => parseEntry({ ...entry(oracleBox), covid: 'xyz' }, { boxAddress }), RelayInputError);
  assert.throws(() => parseEntry({ ...entry(oracleBox), state: {} }, { boxAddress }), RelayInputError);
  assert.throws(() => parseEntry({ ...entry(oracleBox), value: 1.5 }, { boxAddress }), RelayInputError);
});

test('pins come from the snapshot covenants', () => {
  const snap = { covenants: Object.fromEntries(Object.entries(pins).map(([k, v]) => [k, { covid: v }])) };
  assert.deepEqual(pinsFromSnapshot(snap), pins);
});

// --- review fixes --------------------------------------------------------------------------------

const authorityState = golden.cases.swap_in.request.protocol.authority.state;
const authorityBox = { kind: 'authority', state: authorityState, covid: pins.authority, txid: 'd1'.repeat(32), index: 1, value: 100_000_000 };

test('holder_posted_as_authority_rejected', async () => {
  // a holder box has the authority's script and covid; only the 0x10 scheme tells them apart
  const store = memStore();
  const fake = { ...authorityBox, state: holderState, txid: 'd2'.repeat(32) };
  const [r] = await accept([entry(fake)], { ...deps([fake]), store });
  assert.equal(r.ok, false);
  assert.match(r.reason, /authority/);
  assert.equal(store.kv.size, 0);
  // and the authority box can't be filed as someone's holder
  const asHolder = { ...authorityBox, kind: 'holder' };
  assert.equal((await accept([entry(asHolder)], { ...deps([asHolder]), store }))[0].ok, false);
});

test('stale_but_unspent_looking_entry_does_not_replace_a_newer_one', async () => {
  // B (newer) is stored; a late POST of A whose utxo lookup still shows it unspent (API lag) must
  // not overwrite B: A's tx doesn't spend B, and B is still unspent
  const store = memStore();
  const a = { ...oracleBox, txid: 'e1'.repeat(32) };
  const b = { ...oracleBox, txid: 'e2'.repeat(32), state: { ...oracleState, epoch: oracleState.epoch + 1 } };
  assert.equal((await accept([entry(b)], { ...deps([b]), store }))[0].ok, true);
  const [r] = await accept([entry(a)], { ...deps([a, b]), store });
  assert.equal(r.ok, false);
  assert.match(r.reason, /newer/);
  assert.equal(JSON.parse(store.kv.get('kusd:protocol:oracle')).outpoint.transactionId, b.txid);
});

test('a_box_that_spends_the_stored_one_replaces_it', async () => {
  const store = memStore();
  const a = { ...oracleBox, txid: 'e1'.repeat(32) };
  const b = { ...oracleBox, txid: 'e2'.repeat(32), state: { ...oracleState, epoch: oracleState.epoch + 1 } };
  await accept([entry(a)], { ...deps([a]), store });
  const [r] = await accept([entry(b)], { ...deps([{ ...a, unspent: false }, b], { [b.txid]: [[a.txid, a.index]] }), store });
  assert.equal(r.ok, true, r.reason);
});

test('a_stored_box_that_was_spent_elsewhere_can_be_replaced', async () => {
  // the relay missed some transactions: its stored box is spent, so any verified box takes over
  const store = memStore();
  const a = { ...oracleBox, txid: 'e1'.repeat(32) };
  const c = { ...oracleBox, txid: 'e3'.repeat(32), state: { ...oracleState, epoch: oracleState.epoch + 2 } };
  await accept([entry(a)], { ...deps([a]), store });
  const [r] = await accept([entry(c)], { ...deps([{ ...a, unspent: false }, c]), store });
  assert.equal(r.ok, true, r.reason);
});

test('unknown_state_fields_refused', () => {
  assert.throws(() => parseEntry({ ...entry(oracleBox), state: { ...oracleState, display_price: 'x'.repeat(1000) } }, { boxAddress }), /unknown field/);
});

test('a vault not created from the factory group is refused, debt-free or not', async () => {
  // since the vault factory a vault has no genesis of its own: its creating tx spends the factory (an open) or the
  // vault's previous box, both in the vault group. A tx with no input of that group can't have made a real vault
  const store = memStore();
  const base = { kind: 'vault', covid: hex(vaultLive.covid), txid: 'f1'.repeat(32), index: 0 };
  const fresh = { ...base, state: { ...vaultLive.state, debt_mc: 0 }, value: 100_000_000 + vaultLive.state.collateral };
  assert.match((await accept([entry(fresh)], { ...deps([fresh]), store }))[0].reason, /factory/);
  const withDebt = { ...base, txid: 'f2'.repeat(32), state: { ...vaultLive.state, debt_mc: 500_000 }, value: 100_000_000 + vaultLive.state.collateral };
  assert.match((await accept([entry(withDebt)], { ...deps([withDebt]), store }))[0].reason, /factory/);
});

test('vault_with_debt_accepted_as_a_continuation', async () => {
  const store = memStore();
  const v = { kind: 'vault', covid: hex(vaultLive.covid), txid: 'f4'.repeat(32), index: 0, state: vaultLive.state, value: vaultLive.value };
  const [r] = await accept([entry(v)], { ...deps([v], { [v.txid]: [['f0'.repeat(32), 0]] }, { [v.txid]: [hex(vaultLive.covid)] }), store });
  assert.equal(r.ok, true, r.reason);
});

test('a_pruned_box_cannot_be_posted_back', async () => {
  const store = memStore();
  const a = { kind: 'holder', state: holderState, covid: pins.authority, txid: 'c1'.repeat(32), index: 2, value: 100_000_000 };
  const b = { kind: 'holder', state: { ...holderState, amount: holderState.amount - 1 }, covid: pins.authority, txid: 'c2'.repeat(32), index: 0, value: 100_000_000 };
  await accept([entry(a)], { ...deps([a]), store });
  await accept([entry(b)], { ...deps([b], { [b.txid]: [[a.txid, a.index]] }), store });
  // a stale POST of a, verified against a lagging API that still lists it
  const [r] = await accept([entry(a)], { ...deps([a]), store });
  assert.equal(r.ok, false);
  assert.match(r.reason, /spent/);
});

test('an_owner_list_is_capped', async () => {
  const store = memStore();
  const boxes = Array.from({ length: 65 }, (_, i) => ({ kind: 'holder', state: { ...holderState, amount: i + 1 }, covid: pins.authority, txid: (i + 16).toString(16).padStart(2, '0').repeat(32), index: 0, value: 100_000_000 }));
  const d = deps(boxes);
  for (let i = 0; i < 64; i += 16) await accept(boxes.slice(i, i + 16).map(entry), { ...d, store });
  const [r] = await accept([entry(boxes[64])], { ...d, store });
  assert.equal(r.ok, false);
  assert.match(r.reason, /too many/);
});

// Stage 2c: the MinerMedian box is a sixth protocol kind, and the oracle state carries miner_id/bounded
const minerState = { median: 2730, votes: 3048, blocks: 6000, anchor_daa: 626474937, anchor_bs: 123, epoch: 6,
  image_id: Array(32).fill(0x33), tally_root: Array(32).fill(0), gov: oracleState.gov };
const minerBox = { kind: 'miner', state: minerState, covid: pins.miner, txid: 'c4'.repeat(32), index: 0, value: 100_000_000 };

test('miner_entry_accepted_under_the_miner_pin', async () => {
  const store = memStore();
  const [r] = await accept([entry(minerBox)], { ...deps([minerBox]), store });
  assert.equal(r.ok, true, JSON.stringify(r));
  const { protocol } = await read(store);
  assert.equal(protocol.miner.state.median, 2730);
  const [wrong] = await accept([entry({ ...minerBox, covid: '4e'.repeat(32) })], { ...deps([{ ...minerBox, covid: '4e'.repeat(32) }]), store: memStore() });
  assert.equal(wrong.ok, false);
});

test('oracle_state_without_the_stage2c_fields_rejected', () => {
  const { miner_id, bounded, ...stale } = oracleState;
  assert.ok(miner_id && bounded !== undefined, 'the golden oracle state carries the Stage 2c fields');
  assert.throws(() => parseEntry({ ...entry(oracleBox), state: stale }, { boxAddress }), RelayInputError);
});

test('a budget entry carries the vault-debt count and ceiling (budget.ag vault_debt / vault_ceiling)', () => {
  const state = { limit: 5_000_000, available: 4_999_920, last: 1, kusd_id: '42'.repeat(32), gov: ['11'.repeat(32), '22'.repeat(32), '33'.repeat(32)], vault_debt: 380, vault_ceiling: 33_000_000 };
  const entry = { kind: 'budget', covid: '88'.repeat(32), outpoint: { transactionId: 'ab'.repeat(32), index: 0 }, value: 100_000_000, state };
  const seen = [];
  parseEntry(entry, { boxAddress: (kind, s) => { seen.push([kind, s]); return 'kaspatest:x'; } });
  assert.deepEqual(seen[0][1], state, 'both fields reach the address check unchanged');
});
