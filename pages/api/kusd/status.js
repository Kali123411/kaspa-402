// Liveness of the /kusd snapshot: asks the public TN10 REST API whether each covenant outpoint in the
// snapshot is still unspent. Cached briefly at the edge; failures are reported, never a 500.
// The snapshot is the hourly refresh job's copy when valid (lib/kusd/feed.mjs), else the bundled one,
// and is returned with the status so the page shows the same state it was checked against.
import bundled from '../../../public/kusd/snapshot.json';
import { checkStatus } from '../../../lib/kusd/status.mjs';
import { loadSnapshot, FEED_URL } from '../../../lib/kusd/feed.mjs';

async function fetchJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export default async function handler(req, res) {
  const snapshot = await loadSnapshot(bundled, fetchJson, { url: process.env.KUSD_FEED_URL || FEED_URL });
  const status = await checkStatus(snapshot, fetchJson, { base: process.env.KUSD_TN10_API || undefined });
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
  res.status(200).json({ ...status, snapshot });
}
