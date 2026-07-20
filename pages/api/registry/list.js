// pages/api/registry/list.js — the merged directory (seed + approved submissions), for the UI + agents.
import { getListings } from '../../../lib/registry';

export default async function handler(req, res) {
  const listings = await getListings();
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  res.status(200).json({ count: listings.length, listings });
}
