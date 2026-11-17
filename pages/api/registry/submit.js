// pages/api/registry/submit.js — open submissions go to the k402 registry, the one directory (Phase 0 decision 1).
// The registry probes the endpoint live and lists only what it actually offered (HTTP 402 with a valid x402 v2
// offer, scheme/network/payTo/amount taken from the live offer, 0.5 KAS floor); declared values may only agree.
// This route keeps the light validation so a typo is answered here, then forwards.
import { validateListing } from '../../../lib/x402catalog';
import { addSubmission } from '../../../lib/registry';

export const config = { maxDuration: 20 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const l = req.body || {};
  const light = validateListing({ ...l, payTo: l.payTo || 'declared by the live offer' });
  if (!light.ok) return res.status(400).json({ ok: false, error: light.error });
  const added = await addSubmission({
    resource: String(l.resource).trim(), serviceName: l.serviceName, description: l.description || '', capability: l.capability || '',
    scheme: l.scheme, network: l.network, payTo: l.payTo || undefined, amountSompi: l.amountSompi, tags: l.tags || [], kind: l.kind || 'kaspa',
  });
  res.setHeader('Cache-Control', 'no-store');
  return res.status(added.ok ? 200 : (added.status === 502 ? 502 : 400)).json(added);
}
