// /api/rwa/status — is each TESS holder box in the showcase snapshot still unspent on TN10? Cached briefly at the edge;
// failures become 'unknown', never a 500.
import snap from '../../../public/rwa/showcase.json';
import { checkRegister } from '../../../lib/rwa/status.mjs';
import { TN10_API } from '../../../lib/kusd/status.mjs';

async function fetchJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export default async function handler(req, res) {
  const status = await checkRegister(snap.holders, fetchJson, { base: process.env.KUSD_TN10_API || TN10_API });
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
  res.status(200).json({ checkedAt: new Date().toISOString(), ...status });
}
