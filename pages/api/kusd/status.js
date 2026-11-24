// The /kusd system state and its liveness. The snapshot (the heartbeat's export, ~every 30 minutes; else the bundled
// one) supplies the transaction log and any row that cannot be read live. The protocol rows are then read from the
// kUSD relay and each box is re-verified against the public TN10 API (lib/kusd/live.mjs): only boxes whose address
// commits to the shown figures, under the pinned covenant and unspent, replace their snapshot row. Finally every
// row's outpoint is checked unspent. Cached briefly at the edge; failures are reported, never a 500.
import bundled from '../../../public/kusd/snapshot.json';
import { checkStatus, TN10_API } from '../../../lib/kusd/status.mjs';
import { loadSnapshot, FEED_URL } from '../../../lib/kusd/feed.mjs';
import { liveProtocol, mergeLive, RELAY_STATE_URL } from '../../../lib/kusd/live.mjs';
import { loadClient } from '../../../lib/kusd/client.mjs';
import { parseJson, stringifyJson } from '../../../lib/kusd/json64.mjs';

async function fetchJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return parseJson(await r.text());   // i64 state fields can exceed 2^53
}

export default async function handler(req, res) {
  const snapshot = await loadSnapshot(bundled, fetchJson, { url: process.env.KUSD_FEED_URL || FEED_URL });
  const api = process.env.KUSD_TN10_API || TN10_API;
  const relayUrl = process.env.KUSD_RELAY_URL || RELAY_STATE_URL;
  let live = { verified: {}, problems: {} };
  let relayError = null;
  try {
    const relay = await fetchJson(relayUrl);
    live = await liveProtocol(relay, { snapshot, boxAddress: loadClient().boxAddress, fetchJson, api });
  } catch (e) {
    relayError = e.message;
  }
  const merged = mergeLive(snapshot, live);
  const status = await checkStatus(merged, fetchJson, { base: api });
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).send(stringifyJson({
    ...status,
    snapshot: merged,
    live: { source: relayUrl, kinds: Object.keys(live.verified), problems: live.problems, error: relayError },
  }));
}
