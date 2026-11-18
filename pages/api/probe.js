// pages/api/probe.js — the hero's live 402 demo: ONE unpaid GET to a service that is currently listed in the directory
// (never an arbitrary URL: the directory is the allow-list), server-side through the SSRF-guarded probe. Returns the
// status, the latency and the PAYMENT-REQUIRED header; the page renders the transcript and decodes the offer.
import { getListings } from '../../lib/registry';
import { probe } from '../../lib/probe';

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  const want = String(req.query.url || '');
  const listings = await getListings();
  const listed = listings.find((l) => l.resource === want) || (!want ? listings.find((l) => l.verified) || listings[0] : null);
  if (!listed) return res.status(400).json({ error: 'that URL is not a listed service; the demo only probes the directory' });
  try {
    const r = await probe(listed.resource);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ url: r.href, status: r.status, latencyMs: r.latency, paymentRequired: r.headers['payment-required'] || null, service: listed.serviceName, network: listed.network });
  } catch (e) {
    const detail = e.name === 'AbortError' ? 'no response within 9s' : (e.cause?.code || e.message || 'connection failed');
    return res.status(200).json({ url: listed.resource, status: null, latencyMs: null, paymentRequired: null, service: listed.serviceName, error: detail });
  }
}
