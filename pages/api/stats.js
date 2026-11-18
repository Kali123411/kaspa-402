// pages/api/stats.js — the hero's live proof numbers: the directory and the registry's verified settlements.
import { getListings, REGISTRY_URL } from '../../lib/registry';
import { computeStats } from '../../lib/stats.mjs';
import { tickerEvents } from '../../lib/ticker.mjs';

export default async function handler(req, res) {
  const listings = await getListings();
  let activity = null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(`${REGISTRY_URL}/registry/activity?limit=200`, { headers: { accept: 'application/json' }, signal: ctrl.signal });
    clearTimeout(t);
    if (r.ok) activity = await r.json();
  } catch { /* the strip shows what it has */ }
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  res.status(200).json({ ...computeStats(listings, activity), events: tickerEvents(listings, activity), activityReachable: activity != null });
}
