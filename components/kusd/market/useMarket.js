// The registry as the page sees it: listings and the verified-settlements feed every 10 s (one request pair,
// never overlapping, 8 s timeout), a liveness probe of each endpoint at most once per two minutes; the bundled
// snapshot when the registry cannot be reached. Probes send `{}` with no credentials; in production only https
// endpoints are probed from visitors' browsers.
import { useCallback, useEffect, useRef, useState } from 'react';
import bundled from '../../../public/kusd/market-snapshot.json';
import snapshot from '../../../public/kusd/snapshot.json';
import { loadMarket, preflightLive } from '../../../lib/kusd/market/registry.mjs';
import { NETWORK_TESTNET } from '../../../lib/kusd/market/x402.mjs';

export const REGISTRY = (process.env.NEXT_PUBLIC_KUSD_MARKET_REGISTRY || 'https://market.kaspa-402.org').replace(/\/$/, '');
export const AUTHORITY = snapshot.covenants.authority.covid;
const POLL_MS = 10_000;
const LIVE_MS = 120_000;
const TIMEOUT_MS = 8_000;
const PROBE_HTTP = process.env.NODE_ENV !== 'production';

const fetchJson = (url, init = {}) => {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  return fetch(url, { ...init, cache: 'no-store', signal: ctl.signal }).finally(() => clearTimeout(t));
};

export default function useMarket() {
  const [market, setMarket] = useState(() => ({ providers: bundled.providers, activity: bundled.activity, generatedAt: bundled.generatedAt, fromSnapshot: true, reason: null, loading: true }));
  const [live, setLive] = useState({});
  const probed = useRef({});
  const inflight = useRef(false);

  const refresh = useCallback(async () => {
    if (inflight.current) return null;
    inflight.current = true;
    try {
      const m = await loadMarket(REGISTRY, bundled, fetchJson);
      setMarket({ ...m, loading: false, checkedAt: Date.now() });
      return m;
    } finally {
      inflight.current = false;
    }
  }, []);

  useEffect(() => {
    let stop = false;
    refresh();
    const id = setInterval(() => { if (!stop) refresh(); }, POLL_MS);
    return () => { stop = true; clearInterval(id); };
  }, [refresh]);

  // liveness: ask each listed endpoint for its 402 (a kUSD requirement of our family on our network = live)
  useEffect(() => {
    if (market.fromSnapshot) return undefined;
    let stop = false;
    const now = Date.now();
    for (const p of market.providers) {
      if (!/^https:/i.test(p.endpoint) && !PROBE_HTTP) continue;
      const at = probed.current[p.endpoint] || 0;
      if (now - at < LIVE_MS) continue;
      probed.current[p.endpoint] = now;
      preflightLive(p.endpoint, fetchJson, { authority: AUTHORITY, network: NETWORK_TESTNET })
        .then((r) => { if (!stop) setLive((l) => ({ ...l, [p.endpoint]: { ...r, at: Date.now() } })); });
    }
    return () => { stop = true; };
  }, [market]);

  return { ...market, live, refresh, registry: REGISTRY };
}
