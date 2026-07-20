// pages/api/registry/submit.js — open submissions (option 2). A listing is accepted only if it passes
// light validation AND its endpoint really speaks x402 v2 (live probe = the same gate as /validate),
// so the directory never lists a service that doesn't actually work.
import { assertPublicUrl, probe } from '../../../lib/probe';
import { validateListing, validateLiveOffer, reconcileListingWithOffer } from '../../../lib/x402catalog';
import { addSubmission, getListings } from '../../../lib/registry';

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const l = req.body || {};

  const light = validateListing(l);
  if (!light.ok) return res.status(400).json({ ok: false, error: light.error });

  let url;
  try { url = await assertPublicUrl(l.resource); }
  catch (e) { return res.status(400).json({ ok: false, error: `resource URL: ${e.message}` }); }

  let r;
  try { r = await probe(url.href); }
  catch (e) { return res.status(400).json({ ok: false, error: `endpoint unreachable: ${e.cause?.code || e.message}` }); }

  const hdr = r.headers?.['payment-required'];
  if (r.status !== 402 || !hdr) {
    return res.status(400).json({ ok: false, error: 'endpoint did not return HTTP 402 with a PAYMENT-REQUIRED header' });
  }
  const live = validateLiveOffer(hdr);
  if (!live.ok) return res.status(400).json({ ok: false, error: `live offer invalid: ${live.error}` });

  // Reconcile the submitted listing against the LIVE offer: the endpoint must actually offer the declared
  // scheme+network with a valid payTo, and the declared payTo/amount must not contradict it. This rejects
  // listings that misrepresent their network/recipient/price (the live service is the source of truth).
  const rec = reconcileListingWithOffer(l, live.offer);
  if (!rec.ok) return res.status(400).json({ ok: false, error: `listing does not match the live service: ${rec.error}` });

  // No duplicate endpoints (same resource + network already listed).
  const existing = await getListings().catch(() => []);
  if (existing.some((x) => x.resource === url.href && x.network === rec.authoritative.network)) {
    return res.status(409).json({ ok: false, error: `this endpoint is already listed for ${rec.authoritative.network}` });
  }

  // Store the fields the live offer actually attests to (never the submitter's unverified claims), and
  // mark it verified since it passed the live reconciliation.
  const added = await addSubmission({ ...l, ...rec.authoritative, resource: url.href, verified: true });
  res.setHeader('Cache-Control', 'no-store');
  return res.status(added.ok ? 200 : 400).json(added);
}
