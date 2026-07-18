// pages/api/validate.js — provider preflight for the k402 service exchange.
// Hits a provider's endpoint with an UNPAID request and checks it speaks k402: a proper HTTP 402
// whose body is a k402 challenge ({ k402, accepts:[offers] }) offering a payable scheme with a
// well-formed pay destination. Runs server-side (browser can't reach third-party hosts) with an
// SSRF guard, since the endpoint URL is user-supplied.
import { assertPublicUrl, probe } from '../../lib/probe';

export const config = { maxDuration: 15 }; // a slow provider probe shouldn't hit the default function ceiling

const SOMPI = 1e8;
const CHANNEL_CAP_SOMPI = 500_000_000; // recommended cap while the channel covenant is unaudited (5 KAS)
const KNOWN_SCHEMES = ['kaspa-utxo', 'kaspa-session', 'blockbook-utxo', 'evm', 'kaspa-channel'];
const kas = (sompi) => {
  const n = Number(sompi) / SOMPI;
  if (!isFinite(n)) return null;
  return parseFloat(n.toFixed(8));
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { endpoint, payeePubkey, network } = req.body || {};
  if (!endpoint || typeof endpoint !== 'string') return res.status(400).json({ error: 'endpoint (string) required' });
  const net = network === 'testnet' ? 'testnet' : 'mainnet';
  const addrPrefix = net === 'testnet' ? 'kaspatest:' : 'kaspa:';

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

  const checks = [];
  checks.push({ id: 'reachable', label: 'Reachable', level: 'pass', detail: `responded in ${r.latency} ms (HTTP ${r.status})` });

  // 2. speaks k402 — 402 with a k402 challenge body
  const isChallenge = r.json && typeof r.json === 'object' && 'k402' in r.json && Array.isArray(r.json.accepts);
  if (r.status === 402 && isChallenge) {
    checks.push({ id: 'k402', label: 'Speaks k402', level: 'pass', detail: `HTTP 402 with a k402 challenge (protocol ${r.json.k402})` });
  } else if (r.status === 402) {
    checks.push({ id: 'k402', label: 'Speaks k402', level: 'fail', detail: "returned HTTP 402 but the body isn't a k402 challenge (missing 'k402' / 'accepts')" });
  } else if (r.status >= 300 && r.status < 400) {
    checks.push({ id: 'k402', label: 'Speaks k402', level: 'fail', detail: `endpoint redirected (HTTP ${r.status}) — point the validator at the final URL` });
  } else {
    checks.push({ id: 'k402', label: 'Speaks k402', level: 'fail', detail: `expected HTTP 402 to an unpaid request, got ${r.status}. Ensure the pay-gate runs before input validation.` });
  }

  const offers = isChallenge ? r.json.accepts.filter((o) => o && typeof o === 'object') : [];
  const schemes = offers.map((o) => o.scheme).filter(Boolean);
  const known = [...new Set(schemes.filter((s) => KNOWN_SCHEMES.includes(s)))];

  // 3. payable scheme offered
  if (known.length) {
    const unknown = [...new Set(schemes.filter((s) => !KNOWN_SCHEMES.includes(s)))];
    checks.push({ id: 'schemes', label: 'Payable scheme', level: unknown.length ? 'warn' : 'pass',
      detail: `offers ${known.join(', ')}${unknown.length ? ` (+ unrecognized: ${unknown.join(', ')})` : ''}` });
  } else if (isChallenge) {
    checks.push({ id: 'schemes', label: 'Payable scheme', level: 'fail', detail: 'the challenge offers no recognized payment scheme' });
  }

  // 4. pay destination well-formed, per offer
  const disp = [];
  const badDest = [];
  for (const o of offers) {
    if (o.scheme === 'kaspa-utxo' || o.scheme === 'blockbook-utxo') {
      const amt = o.amount_sompi ?? o.amount;
      const ok = typeof o.pay_to === 'string' && o.pay_to.length > 0 && (o.scheme === 'blockbook-utxo' || o.pay_to.startsWith(addrPrefix));
      if (!ok) badDest.push(`${o.scheme}: pay_to "${o.pay_to || ''}" not a ${net} address`);
      disp.push({ scheme: o.scheme, quote: amt != null ? `${amt} sompi${o.scheme === 'kaspa-utxo' ? ` (${kas(amt)} KAS)` : ''}` : null, dest: o.pay_to || null });
    } else if (o.scheme === 'evm') {
      const ok = /^0x[0-9a-fA-F]{40}$/.test(o.pay_to || '');
      if (!ok) badDest.push(`evm: pay_to "${o.pay_to || ''}" not a 0x address`);
      disp.push({ scheme: o.scheme, quote: o.amount != null ? `${o.amount} (${o.asset || 'wei'})` : null, dest: o.pay_to || null });
    } else if (o.scheme === 'kaspa-channel') {
      const ok = /^[0-9a-fA-F]{64}$/.test(o.payee_pubkey || '');
      if (!ok) badDest.push(`kaspa-channel: payee_pubkey not 32-byte hex`);
      disp.push({ scheme: o.scheme, quote: o.price_sompi != null ? `${o.price_sompi} sompi/call (${kas(o.price_sompi)} KAS)` : null, dest: o.payee_pubkey || null,
        channel: { min_kas: kas(o.min_channel_sompi), max_kas: kas(o.max_channel_sompi), max_sompi: Number(o.max_channel_sompi) } });
    } else if (o.scheme === 'kaspa-session') {
      disp.push({ scheme: o.scheme, quote: 'prepaid session', dest: o.open || null });
    } else {
      disp.push({ scheme: o.scheme || 'unknown', quote: null, dest: null });
    }
  }
  if (offers.length) {
    checks.push(badDest.length
      ? { id: 'dest', label: 'Pay destination', level: 'fail', detail: badDest.join('; ') }
      : { id: 'dest', label: 'Pay destination', level: 'pass', detail: 'every offer has a well-formed pay-to / payee' });
  }

  // 5. channel terms sanity
  const chan = offers.find((o) => o.scheme === 'kaspa-channel');
  if (chan) {
    const min = Number(chan.min_channel_sompi), max = Number(chan.max_channel_sompi);
    if (!(min > 0) || !(max > 0) || min > max) {
      checks.push({ id: 'channel', label: 'Channel terms', level: 'fail', detail: `min/max channel bounds invalid (min ${chan.min_channel_sompi}, max ${chan.max_channel_sompi})` });
    } else if (max > CHANNEL_CAP_SOMPI) {
      checks.push({ id: 'channel', label: 'Channel terms', level: 'warn', detail: `max channel ${kas(max)} KAS exceeds the recommended cap of ${kas(CHANNEL_CAP_SOMPI)} KAS while the covenant is unaudited` });
    } else {
      checks.push({ id: 'channel', label: 'Channel terms', level: 'pass', detail: `${kas(min)}–${kas(max)} KAS per channel, within the safe cap` });
    }
  }

  // 6. payee match (optional)
  if (payeePubkey && typeof payeePubkey === 'string' && chan) {
    const match = chan.payee_pubkey && chan.payee_pubkey.toLowerCase() === payeePubkey.trim().toLowerCase();
    checks.push({ id: 'payee', label: 'Payee matches', level: match ? 'pass' : 'fail',
      detail: match ? 'channel payee_pubkey matches the key you gave' : "channel payee_pubkey does NOT match the key you'll list under" });
  }

  const blocking = checks.filter((c) => c.level === 'fail');
  const ok = blocking.length === 0 && isChallenge && known.length > 0;

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    endpoint: url.href, network: net, ok,
    latency_ms: r.latency, http_status: r.status,
    k402_version: isChallenge ? r.json.k402 : null,
    schemes: known, offers: disp, checks,
  });
}
