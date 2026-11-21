// /api/rwa/status — is each holder box in the /rwa snapshots still unspent on TN10? `v3` covers TESS3 (the current
// instrument), the top-level fields the August TESS register kept as history. Cached briefly at the edge; failures
// become 'unknown', never a 500.
import snap from '../../../public/rwa/showcase.json';
import t3 from '../../../public/rwa/tess3.json';
import { checkRegister } from '../../../lib/rwa/status.mjs';
import { TN10_API } from '../../../lib/kusd/status.mjs';

async function fetchJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export default async function handler(req, res) {
  const base = process.env.KUSD_TN10_API || TN10_API;
  const history = checkRegister(snap.holders, fetchJson, { base });
  const current = { v3: await checkRegister(t3.holders, fetchJson, { base }) };
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
  res.status(200).json({ checkedAt: new Date().toISOString(), ...(await history), ...current });
}
