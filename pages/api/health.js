// pages/api/health.js — liveness sweep of every listed endpoint. Sends one unpaid probe to each
// unique endpoint and reports whether it still speaks k402 (a live pay-gate). The browse UI dims +
// flags dead listings; agents can skip them. Cached at the edge so it isn't re-run per visitor.
import { fetchServices } from '../../lib/catalog';
import { probe, isK402Challenge, pMap } from '../../lib/probe';

export const config = { maxDuration: 30 };

const MAX_ENDPOINTS = 24; // bound the sweep; log if truncated

export default async function handler(req, res) {
  const providers = await fetchServices();
  const endpoints = [...new Set(providers.map((p) => p.endpoint).filter(Boolean))];
  const truncated = endpoints.length > MAX_ENDPOINTS;
  const scan = endpoints.slice(0, MAX_ENDPOINTS);

  const results = await pMap(scan, async (ep) => {
    try {
      const r = await probe(ep, { timeout: 9000 });
      if (r.status === 402 && isK402Challenge(r.json)) {
        return [ep, { alive: true, status: r.status, latency: r.latency, detail: `k402 402 (${r.json.k402})` }];
      }
      if (r.status >= 300 && r.status < 400) return [ep, { alive: false, status: r.status, latency: r.latency, detail: `redirects (HTTP ${r.status})` }];
      if (r.status === 402) return [ep, { alive: false, status: r.status, latency: r.latency, detail: '402 but not a k402 challenge' }];
      return [ep, { alive: false, status: r.status, latency: r.latency, detail: `HTTP ${r.status}` }];
    } catch (e) {
      const detail = e.name === 'AbortError' ? 'no response (timeout)' : (e.cause?.code || e.message || 'unreachable');
      return [ep, { alive: false, status: null, detail }];
    }
  }, 8);

  const endpointsMap = Object.fromEntries(results);
  const dead = results.filter(([, v]) => !v.alive).map(([ep]) => ep);

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.status(200).json({
    checked_at: Date.now(),
    total: endpoints.length,
    checked: scan.length,
    truncated,
    dead_count: dead.length,
    endpoints: endpointsMap,
  });
}
