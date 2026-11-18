// lib/registry.js — the directory is the k402 registry (one registry for every listing class, Phase 0 decision 1).
// getListings() reads GET /registry/catalog and maps each entry onto the site's listing shape; when the
// registry cannot be reached it serves the committed snapshot (scripts/catalog-snapshot.mjs regenerates it),
// marked `fromSnapshot`. Submissions go to the registry's POST /registry/submit, which probes the endpoint
// live and lists what it actually offered — the site keeps no store of its own.
import { meetsPriceFloor, validateListing } from './x402catalog.js';
import snapshot from './catalog-snapshot.js';

export const REGISTRY_URL = (process.env.K402_REGISTRY_URL || 'https://market.kaspa-402.org').replace(/\/$/, '');
const TIMEOUT_MS = 6000;

/** One catalog entry (signed or attested) as the site's listing, or null when the site cannot show it (kUSD-priced
 *  listings live on the Kaspa Agent Market page; they carry no KAS amount). */
export function fromCatalog(e) {
  if (!e || typeof e !== 'object') return null;
  if (e.currency === 'kUSD') return null;
  const attested = e.kind === 'attested';
  const amount = e.amount_sompi;
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) return null;
  const l = {
    id: e.id,
    resource: e.endpoint,
    serviceName: e.serviceName || e.capability || e.endpoint,
    description: e.description || '',
    capability: e.capability || undefined,
    scheme: e.scheme || 'exact',
    network: e.network,
    amountSompi: Number(amount),
    payTo: attested ? e.pay_to : undefined,
    tags: Array.isArray(e.tags) ? e.tags : [],
    kind: attested ? (e.settles === 'base' ? 'base' : 'kaspa') : 'kaspa',
    source: attested ? 'attested' : 'signed',
    verified: e.verified === true,
    probedAt: e.probed_at || undefined,
    listedAt: e.listed_at || undefined,
    reputation: e.reputation || undefined,
  };
  if (!attested) {
    // a signed KAS listing names a payee key, not an address; the endpoint's own 402 carries the address
    l.payeePubkey = e.payee_pubkey;
  }
  return l;
}

export function fromCatalogAll(listings) {
  return (Array.isArray(listings) ? listings : []).map(fromCatalog).filter(Boolean)
    .filter((l) => meetsPriceFloor(l) && (l.payTo ? validateListing(l).ok : true));
}

async function fetchCatalog() {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${REGISTRY_URL}/registry/catalog`, { headers: { accept: 'application/json' }, signal: ctrl.signal });
    if (!r.ok) throw new Error(`registry answered HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

/** The directory: live from the registry, else the snapshot. */
export async function getListings() {
  try {
    const cat = await fetchCatalog();
    return fromCatalogAll(cat.listings);
  } catch {
    return fromCatalogAll(snapshot.listings).map((l) => ({ ...l, fromSnapshot: true }));
  }
}

/** Hand a submission to the registry, which probes the endpoint and lists what it offered. */
export async function addSubmission(listing) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 14000);
  try {
    const r = await fetch(`${REGISTRY_URL}/registry/submit`, {
      method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(listing), signal: ctrl.signal,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) return { ok: false, status: r.status, error: j.error || `registry answered HTTP ${r.status}`, attestation: j.attestation };
    return { ok: true, listing: fromCatalog(j.listing), attestation: j.attestation };
  } catch (e) {
    return { ok: false, status: 502, error: `registry unreachable: ${e.name === 'AbortError' ? 'timeout' : (e.message || e)}` };
  } finally {
    clearTimeout(t);
  }
}

// ops visibility: is the registry answering, and how many listings does it hold
export async function storageInfo() {
  try {
    const cat = await fetchCatalog();
    return { storage: 'k402-registry', url: REGISTRY_URL, ok: true, listings: cat.count, generatedAt: cat.generated_at };
  } catch (e) {
    return { storage: 'k402-registry', url: REGISTRY_URL, ok: false, error: String(e && e.message || e).slice(0, 140), snapshot: snapshot.listings.length };
  }
}
