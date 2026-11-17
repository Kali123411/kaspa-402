// The market page's view of a k402 registry: kUSD listings, the chain-verified settlements feed, one provider's
// detail, a liveness probe of an endpoint (does it answer with a kUSD 402?), and the bundled-snapshot fallback
// so the page never looks live when the registry is down.
import { HDR_REQUIRED, decodeRequired, pickKusd } from './x402.mjs';

async function getJson(url, fetchImpl) {
  const r = await fetchImpl(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`registry answered ${r.status} for ${url}`);
  return r.json();
}

export async function fetchListings(base, fetchImpl = globalThis.fetch) {
  const d = await getJson(`${base}/registry/search?currency=kUSD&limit=100`, fetchImpl);
  return (d.providers ?? []).filter((p) => p.currency === 'kUSD');
}

export async function fetchActivity(base, fetchImpl = globalThis.fetch, limit = 50) {
  return getJson(`${base}/registry/activity?limit=${limit}`, fetchImpl);
}

export async function fetchProvider(base, payeePubkey, fetchImpl = globalThis.fetch) {
  return getJson(`${base}/registry/provider/${payeePubkey}`, fetchImpl);
}

const DIGITS = /^\d+$/;

/** POST an empty body: a 402 with a kUSD requirement means a live pay-gate (and says what it quotes). With
 * `authority` / `network` given, a requirement for another family or network is "not answering for us". */
export async function preflightLive(endpoint, fetchImpl = globalThis.fetch, { authority, network } = {}) {
  const dead = { live: false, cents: null };
  try {
    const r = await fetchImpl(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    if (r.status !== 402) return dead;
    const hdr = r.headers.get(HDR_REQUIRED);
    if (!hdr) return dead;
    const req = pickKusd(decodeRequired(hdr));
    if (!req) return dead;
    if (authority && String(req.asset ?? '').toLowerCase() !== String(authority).toLowerCase()) return dead;
    if (network && req.network !== network) return dead;
    return { live: true, cents: DIGITS.test(String(req.amount)) ? Number(req.amount) : null };
  } catch {
    return dead;
  }
}

/** Live data when the registry answered, else the bundled snapshot marked as such, with why. */
export function pickMarketSnapshot(bundled, live, reason = null) {
  if (live) return { ...live, fromSnapshot: false, generatedAt: null, reason: null };
  return { providers: bundled.providers ?? [], activity: bundled.activity ?? { settlements: [], total_cents: 0 }, fromSnapshot: true,
    generatedAt: bundled.generatedAt ?? null, reason: reason ?? 'unreachable' };
}

/** Listings + activity together; if either call fails the whole view falls back (a half-live page misleads).
 * `reason` tells the page which: 'unreachable' (nothing answered) or 'no-activity' (a registry without the feed). */
export async function loadMarket(base, bundled, fetchImpl = globalThis.fetch) {
  const [l, a] = await Promise.allSettled([fetchListings(base, fetchImpl), fetchActivity(base, fetchImpl)]);
  if (l.status === 'fulfilled' && a.status === 'fulfilled') return pickMarketSnapshot(bundled, { providers: l.value, activity: a.value });
  const reason = l.status === 'fulfilled' && /answered 404/.test(String(a.reason?.message)) ? 'no-activity' : 'unreachable';
  return pickMarketSnapshot(bundled, null, reason);
}
