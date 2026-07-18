// pages/api/exchange.js — server-side proxy for the k402 service registry.
// Fetches the live marketplace listings from the gateway and serves them same-origin,
// so the browser never makes a cross-origin (CORS-blocked) request. Cached ~30s.
let cache = null;
let last = 0;
const REGISTRY = 'https://x402-compute.68cxgfyr0.workers.dev/registry/search?limit=200';

export default async function handler(req, res) {
  const now = Date.now();
  if (cache && now - last < 30000) {
    return res.status(200).json(cache);
  }
  try {
    const r = await fetch(REGISTRY);
    if (!r.ok) throw new Error('registry ' + r.status);
    const data = await r.json();
    cache = data;
    last = now;
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    return res.status(200).json(data);
  } catch (err) {
    console.error('exchange proxy:', err);
    if (cache) return res.status(200).json(cache);
    return res.status(502).json({ providers: [], count: 0, error: 'registry unavailable' });
  }
}
