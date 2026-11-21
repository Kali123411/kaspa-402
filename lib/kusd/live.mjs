// The /kusd system state, read live. The kUSD relay (an untrusted cache) knows where each protocol box is now;
// the snapshot only changes every ~30 minutes. Each relay box is re-verified against the public TN10 API with the
// relay's own checks — its address is recomputed from the claimed state (kusd-client WASM), so figures that do
// not hash to the box on chain are refused; it must sit under the snapshot's pinned covenant, hold the claimed
// value and be unspent. Only verified boxes replace snapshot rows; the rest, and the transaction log, stay the export.
import { parseEntry, verifyEntry, pinsFromSnapshot, PROTOCOL_KINDS } from './relay.mjs';

export const RELAY_STATE_URL = 'https://kusd.kaspa-402.org/state';

/** Verify the relay's protocol boxes → `{verified: {kind: entry}, problems: {kind: reason}}`. Never throws. */
export async function liveProtocol(relay, { snapshot, boxAddress, fetchJson, api }) {
  const verified = {};
  const problems = {};
  let pins;
  try {
    pins = pinsFromSnapshot(snapshot);
  } catch (e) {
    return { verified, problems: { snapshot: e.message } };
  }
  const kinds = PROTOCOL_KINDS.filter((k) => snapshot?.covenants?.[k] && relay?.protocol?.[k]);
  await Promise.all(kinds.map(async (kind) => {
    let entry;
    try {
      entry = parseEntry(relay.protocol[kind], { boxAddress });
      if (entry.kind !== kind) throw new Error(`the relay returned a ${entry.kind} box in its place`);
    } catch (e) {
      problems[kind] = e.message;
      return;
    }
    const r = await verifyEntry(entry, { fetchJson, pins, api });
    if (r.ok) verified[kind] = entry;
    else problems[kind] = r.reason;
  }));
  return { verified, problems };
}

/** The snapshot with each verified box laid over its row (state projected onto the fields the snapshot carries). */
export function mergeLive(snapshot, { verified }) {
  const kinds = Object.keys(verified || {});
  if (kinds.length === 0) return snapshot;
  const covenants = { ...snapshot.covenants };
  for (const kind of kinds) {
    const e = verified[kind];
    const row = snapshot.covenants[kind];
    const state = Object.fromEntries(Object.keys(row.state || {}).map((f) => [f, e.state[f] ?? row.state[f]]));
    covenants[kind] = { ...row, txid: e.outpoint.transactionId, index: e.outpoint.index, amount: e.value, address: e.address, state };
  }
  return { ...snapshot, covenants };
}
