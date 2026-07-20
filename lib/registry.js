// lib/registry.js — the marketplace registry = curated SEED (option 1) + open SUBMISSIONS (option 2).
// getListings() returns the merged, validated set (what /llms, /skill and browse read). Submissions are
// gated by the submit route's live x402 v2 probe before they land here.
//
// Storage: Upstash Redis over REST (@upstash/redis), else in-memory dev fallback. Credentials are found
// generically — any env var ending in KV_REST_API_URL / UPSTASH_REDIS_REST_URL and its matching *_TOKEN —
// so it works whether Vercel injects them plain (KV_REST_API_URL) or prefixed (e.g. STORAGE2_KV_REST_API_URL).
import { SEED } from './listings.js';
import { validateListing } from './x402catalog.js';

const KEY = 'x402:submissions';
let mem = [];
let _redis; // undefined = not tried, null = none configured

function findRestCreds() {
  const keys = Object.keys(process.env);
  const urlKey =
    keys.find((k) => k === 'KV_REST_API_URL') ||
    keys.find((k) => k === 'UPSTASH_REDIS_REST_URL') ||
    keys.find((k) => k.endsWith('KV_REST_API_URL')) ||
    keys.find((k) => k.endsWith('UPSTASH_REDIS_REST_URL'));
  if (!urlKey) return null;
  const prefix = urlKey.replace(/(KV_REST_API_URL|UPSTASH_REDIS_REST_URL)$/, '');
  const url = process.env[urlKey];
  const token = process.env[prefix + 'KV_REST_API_TOKEN'] || process.env[prefix + 'UPSTASH_REDIS_REST_TOKEN'];
  return url && token ? { url, token } : null;
}

async function redis() {
  if (_redis !== undefined) return _redis;
  const creds = findRestCreds();
  if (!creds) { _redis = null; return null; }
  try { const { Redis } = await import('@upstash/redis'); _redis = new Redis(creds); }
  catch { _redis = null; }
  return _redis;
}

async function readSubmissions() {
  const r = await redis();
  if (r) { try { return (await r.get(KEY)) || []; } catch { return []; } }
  return mem;
}

export async function getListings() {
  const subs = await readSubmissions();
  return [...SEED, ...subs].filter((l) => validateListing(l).ok);
}

export async function addSubmission(listing) {
  const v = validateListing(listing);
  if (!v.ok) return { ok: false, error: v.error };
  const entry = { ...listing, id: listing.id || `sub_${Date.now().toString(36)}`, source: 'submission', verified: false, submittedAt: Date.now() };
  const r = await redis();
  if (r) { const cur = (await r.get(KEY)) || []; await r.set(KEY, [...cur, entry]); }
  else { mem.push(entry); }
  return { ok: true, listing: entry };
}

// ops visibility: which backend is live + a safe connectivity read (no writes)
export async function storageInfo() {
  const r = await redis();
  if (!r) return { storage: 'memory', ok: true, note: 'no Redis creds — submissions reset per cold start' };
  try { const v = await r.get(KEY); return { storage: 'upstash-redis', ok: true, submissions: Array.isArray(v) ? v.length : 0 }; }
  catch (e) { return { storage: 'upstash-redis', ok: false, error: String(e && e.message || e).slice(0, 140) }; }
}
