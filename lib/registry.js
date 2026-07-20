// lib/registry.js — the marketplace registry = curated SEED (option 1) + open SUBMISSIONS (option 2).
// getListings() returns the merged, validated set (what /llms, /skill and browse read). Submissions are
// gated by the submit route's live x402 v2 probe (/validate logic) before they land here.
//
// Storage is pluggable: an in-memory list for local dev (resets per cold start), and Vercel KV in
// production — set KV_REST_API_URL + KV_REST_API_TOKEN (and `npm i @vercel/kv`) and submissions persist.
import { SEED } from './listings.js';
import { validateListing } from './x402catalog.js';

const KEY = 'x402:submissions';
let mem = []; // dev fallback

async function kvClient() {
  if (!process.env.KV_REST_API_URL) return null;
  try { const m = await import('@vercel/kv'); return m.kv; } catch { return null; }
}

async function readSubmissions() {
  const kv = await kvClient();
  if (kv) { try { return (await kv.get(KEY)) || []; } catch { return []; } }
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
  const kv = await kvClient();
  if (kv) { const cur = (await kv.get(KEY)) || []; await kv.set(KEY, [...cur, entry]); }
  else { mem.push(entry); }
  return { ok: true, listing: entry };
}
