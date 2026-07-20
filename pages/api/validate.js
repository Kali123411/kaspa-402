// pages/api/validate.js — provider preflight for the x402 v2 Kaspa marketplace.
// Probes a provider endpoint with an UNPAID request and confirms it speaks x402 v2: HTTP 402 whose
// PAYMENT-REQUIRED header base64-decodes to a valid PaymentRequired (validated by @kaspa-x402/core),
// offering a recognized Kaspa scheme + supported network with a well-formed payTo. Runs server-side
// (browser can't reach third-party hosts) with an SSRF guard, since the endpoint URL is user-supplied.
import { assertPublicUrl, probe } from '../../lib/probe';
import { validateLiveOffer, NETWORKS, SCHEMES } from '../../lib/x402catalog';

export const config = { maxDuration: 15 };

const SOMPI = 1e8;
const PR_HEADER = 'payment-required'; // x402 v2: the offer rides in this response header, not the body
const kas = (s) => { const n = Number(s) / SOMPI; return isFinite(n) ? parseFloat(n.toFixed(8)) : null; };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { endpoint, network } = req.body || {};
  if (!endpoint || typeof endpoint !== 'string') return res.status(400).json({ error: 'endpoint (string) required' });
  const wantNet = NETWORKS.includes(network) ? network : null; // optional: which network the lister expects

  let url;
  try {
    url = await assertPublicUrl(endpoint.trim());
  } catch (e) {
    return res.status(200).json({ endpoint, ok: false, checks: [{ id: 'url', label: 'Endpoint URL', level: 'fail', detail: e.message }] });
  }

  let r;
  try {
    r = await probe(url.href);
  } catch (e) {
    const detail = e.name === 'AbortError' ? 'no response within 9s (timeout)' : (e.cause?.code || e.message || 'connection failed');
    return res.status(200).json({ endpoint, ok: false, checks: [{ id: 'reachable', label: 'Reachable', level: 'fail', detail: `could not connect: ${detail}` }] });
  }

  const checks = [{ id: 'reachable', label: 'Reachable', level: 'pass', detail: `responded in ${r.latency} ms (HTTP ${r.status})` }];

  // 2. HTTP 402 to an unpaid request
  if (r.status === 402) {
    checks.push({ id: '402', label: 'Returns 402', level: 'pass', detail: 'HTTP 402 Payment Required to an unpaid request' });
  } else if (r.status >= 300 && r.status < 400) {
    checks.push({ id: '402', label: 'Returns 402', level: 'fail', detail: `endpoint redirected (HTTP ${r.status}) — point the validator at the final URL` });
  } else {
    checks.push({ id: '402', label: 'Returns 402', level: 'fail', detail: `expected HTTP 402 to an unpaid request, got ${r.status}. The pay-gate must run before input validation.` });
  }

  // 3. PAYMENT-REQUIRED header present + valid x402 v2 (validated by @kaspa-x402/core)
  const hdr = r.headers?.[PR_HEADER];
  let offer = null;
  let reqs = [];
  if (!hdr) {
    checks.push({ id: 'x402', label: 'Speaks x402 v2', level: 'fail', detail: 'no PAYMENT-REQUIRED header — x402 v2 carries the offer in the header, not the body' });
  } else {
    const v = validateLiveOffer(hdr);
    if (!v.ok) {
      checks.push({ id: 'x402', label: 'Speaks x402 v2', level: 'fail', detail: `PAYMENT-REQUIRED failed validation: ${v.error}` });
    } else {
      offer = v.offer;
      reqs = offer.accepts || [];
      checks.push({ id: 'x402', label: 'Speaks x402 v2', level: 'pass', detail: `valid PaymentRequired (x402Version ${offer.x402Version}, ${reqs.length} requirement${reqs.length === 1 ? '' : 's'})` });
    }
  }

  // 4. per-requirement: recognized scheme + supported network + well-formed payTo (+ optional network match)
  const requirements = [];
  const bad = [];
  for (const q of reqs) {
    if (!SCHEMES.includes(q.scheme)) bad.push(`unrecognized scheme "${q.scheme}"`);
    if (!NETWORKS.includes(q.network)) bad.push(`unsupported network "${q.network}"`);
    if (!(typeof q.payTo === 'string' && q.payTo.length > 0)) bad.push(`${q.scheme}: missing payTo`);
    if (wantNet && NETWORKS.includes(q.network) && q.network !== wantNet) bad.push(`offers ${q.network}, you expected ${wantNet}`);
    requirements.push({
      scheme: q.scheme, network: q.network, amount_sompi: q.amount, kas: kas(q.amount),
      payTo: q.payTo, binding: q.extra?.binding || null, profile: q.extra?.profile || null,
    });
  }
  if (reqs.length) {
    checks.push(bad.length
      ? { id: 'terms', label: 'Payment terms', level: 'fail', detail: bad.join('; ') }
      : { id: 'terms', label: 'Payment terms', level: 'pass', detail: 'every requirement has a recognized scheme, a supported network, and a payTo' });
  }

  const ok = checks.every((c) => c.level !== 'fail') && !!offer && reqs.length > 0;
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    endpoint: url.href, ok,
    latency_ms: r.latency, http_status: r.status,
    x402Version: offer?.x402Version ?? null,
    networks: [...new Set(reqs.map((q) => q.network))],
    requirements, checks,
  });
}
