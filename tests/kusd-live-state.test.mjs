// /kusd system state read live: the status route takes the protocol boxes from the kUSD relay, re-verifies each
// one against TN10 exactly as the relay itself does (address recomputed from the claimed state, pinned covenant,
// value, unspent), and lays only the verified ones over the snapshot. Anything unverified keeps the snapshot row.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { liveProtocol, mergeLive, RELAY_STATE_URL } from '../lib/kusd/live.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const snapshot = JSON.parse(read('public/kusd/snapshot.json'));
const API = 'https://tn10.example';
const NEW_TX = 'ab'.repeat(32);

// the address a box "commits to" in these tests: kind + its figures, so changing a figure changes the address
const boxAddress = (kind, state) => `kaspatest:${kind}-${JSON.stringify(state)}`;

/** a relay entry for `kind` at a new outpoint holding `state`, with a fake TN10 API that agrees (or not) */
function world({ kind = 'psm', state, covid = snapshot.covenants[kind].covid, value = snapshot.covenants[kind].amount,
  chainState = state, chainCovid = covid, spent = false } = {}) {
  const entry = { kind, covid, outpoint: { transactionId: NEW_TX, index: 0 }, value, state };
  const chainAddress = boxAddress(kind, chainState);
  const fetchJson = async (url) => {
    if (url === `${API}/transactions/${NEW_TX}`) {
      return { is_accepted: true, inputs: [], outputs: [{ index: 0, script_public_key_address: chainAddress, covenant_id: chainCovid, amount: String(value) }] };
    }
    if (url === `${API}/addresses/${chainAddress}/utxos`) return spent ? [] : [{ outpoint: { transactionId: NEW_TX, index: 0 } }];
    if (url.startsWith(`${API}/addresses/`)) return [];
    throw new Error(`unexpected ${url}`);
  };
  return { relay: { protocol: { [kind]: entry } }, fetchJson };
}

const psmState = (minted) => ({ ...fullState('psm'), minted });
function fullState(kind) {
  // the relay serves the covenant's whole state; the snapshot carries a display subset of it
  const base = { psm: { ceiling: 5000000, minted: 0, spread: 50, gov: [1], kusd_id: [2], oracle_id: [3], surplus_id: [4], budget_id: [5] } };
  return base[kind];
}

test('a relay box that verifies replaces the snapshot row, projected onto the snapshot fields', async () => {
  const { relay, fetchJson } = world({ state: psmState(5209) });
  const live = await liveProtocol(relay, { snapshot, boxAddress, fetchJson, api: API });
  assert.deepEqual(Object.keys(live.verified), ['psm']);
  const merged = mergeLive(snapshot, live);
  assert.equal(merged.covenants.psm.state.minted, 5209);
  assert.equal(merged.covenants.psm.txid, NEW_TX);
  assert.deepEqual(Object.keys(merged.covenants.psm.state), Object.keys(snapshot.covenants.psm.state), 'same fields the page reads');
  assert.equal(merged.covenants.oracle, snapshot.covenants.oracle, 'other rows untouched');
  assert.equal(merged.timeline, snapshot.timeline, 'the log stays the export');
});

test('figures that do not hash to the box on chain are refused (a tampered relay cannot change the page)', async () => {
  const { relay, fetchJson } = world({ state: psmState(999999), chainState: psmState(5209) });
  const live = await liveProtocol(relay, { snapshot, boxAddress, fetchJson, api: API });
  assert.deepEqual(live.verified, {});
  assert.match(live.problems.psm, /address does not match/);
  assert.equal(mergeLive(snapshot, live).covenants.psm.state.minted, snapshot.covenants.psm.state.minted);
});

test('a box under another covenant, or already spent, is refused', async () => {
  const other = 'cd'.repeat(32);
  const a = world({ state: psmState(5209), covid: other, chainCovid: other });
  assert.match((await liveProtocol(a.relay, { snapshot, boxAddress, fetchJson: a.fetchJson, api: API })).problems.psm, /pinned psm/);
  const b = world({ state: psmState(5209), spent: true });
  assert.match((await liveProtocol(b.relay, { snapshot, boxAddress, fetchJson: b.fetchJson, api: API })).problems.psm, /spent/);
});

test('a malformed relay entry or an unreachable relay leaves the snapshot as it is', async () => {
  const bad = { protocol: { psm: { kind: 'psm', covid: 'nope' } } };
  const live = await liveProtocol(bad, { snapshot, boxAddress, fetchJson: async () => ({}), api: API });
  assert.deepEqual(live.verified, {});
  assert.match(live.problems.psm, /covid/);
  assert.deepEqual(mergeLive(snapshot, { verified: {}, problems: {} }), snapshot);
  const none = await liveProtocol(null, { snapshot, boxAddress, fetchJson: async () => ({}), api: API });
  assert.deepEqual(none.verified, {});
});

test('the status route reads the public relay, verifies, and merges before checking freshness', () => {
  assert.equal(RELAY_STATE_URL, 'https://kusd.kaspa-402.org/state');
  const route = read('pages/api/kusd/status.js');
  assert.match(route, /liveProtocol\(/);
  assert.match(route, /mergeLive\(/);
  assert.match(route, /checkStatus\(merged/);
  assert.match(route, /KUSD_RELAY_URL/);
  // the function needs the kusd-client WASM on Vercel, as /api/og needed its fonts
  assert.match(read('next.config.js'), /'\/api\/kusd\/status': \['\.\/lib\/kusd\/wasm\/\*\*'\]/);
});

test('the page says which rows are live', () => {
  const page = read('pages/kusd.js');
  assert.match(page, /status\?\.live\?\.kinds/);
  assert.match(page, /live: 'read live'/);
});
