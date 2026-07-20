// lib/registry.js — the marketplace registry = curated SEED (option 1) + open SUBMISSIONS (option 2).
// getListings() returns the merged, validated set (what /llms, /skill and browse read). Submissions are
// gated by the submit route's live x402 v2 probe before they land here.
//
// Storage is pluggable and future-proof: in-memory for local dev, and a serverless Redis KV in prod.
// It reads whichever credentials the store injects — KV_REST_API_URL/TOKEN (Vercel KV / Upstash-via-Vercel)
// or UPSTASH_REDIS_REST_URL/TOKEN (Upstash direct). Provision a Redis store in the Vercel dashboard,
// redeploy, and submissions persist. No env vars -> memory fallback (resets per cold start).
import { SEED } from './listings.js';
import { validateListing } from './x402catalog.js';

const KEY = 'x402:submissions';
let mem = [];
let _redis; // undefined = not tried, null = unavailable

async function redis() {
  if (_redis !== undefined) return _redis;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) { _redis = null; return null; }
  try { const { Redis } = await import('@upstash/redis'); _redis = new Redis({ url, token }); }
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
  const entry = {
    ...listing,
    id: listing.id || `sub_${Date.now().toString(36)}`,
    source: 'submission', verified: false, submittedAt: Date.now(),
  };
  const r = await redis();
  if (r) { const cur = (await r.get(KEY)) || []; await r.set(KEY, [...cur, entry]); }
  else { mem.push(entry); }
  return { ok: true, listing: entry };
}
