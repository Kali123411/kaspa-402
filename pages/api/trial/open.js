// pages/api/trial/open.js — open a free TESTNET trial session (tKAS credit) on the k402 gateway.
// Proxied server-side so the visitor's IP is forwarded for rate-limiting and there's no CORS.
const GATEWAY = 'https://x402-compute.68cxgfyr0.workers.dev';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || (req.socket && req.socket.remoteAddress) || '';
  try {
    const r = await fetch(`${GATEWAY}/trial/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    });
    const d = await r.json();
    return res.status(r.status).json(d);
  } catch (e) {
    console.error('trial/open:', e);
    return res.status(502).json({ error: 'trial rail unavailable' });
  }
}
