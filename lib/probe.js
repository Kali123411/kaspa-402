// lib/probe.js — shared, SSRF-guarded endpoint probing for /api/validate (one endpoint, deep) and
// /api/health (all live endpoints, shallow). Server-only (uses node:dns + fetch).
import dns from 'node:dns';

export function isPrivateIP(ip) {
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  const m = v4.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;        // link-local / cloud metadata
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  const l = ip.toLowerCase();
  if (l === '::1' || l === '::') return true;
  if (l.startsWith('fe80') || l.startsWith('fc') || l.startsWith('fd')) return true; // link-local / ULA
  return false;
}

// Reject non-http(s) and any host that resolves to a private/loopback/link-local address. Returns URL.
export async function assertPublicUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error('not a valid URL'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('URL must be http(s)');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw new Error('host not allowed');
  if (/^[\d.]+$/.test(host) || host.includes(':')) {
    if (isPrivateIP(host)) throw new Error('host resolves to a private address');
    return u;
  }
  const addrs = await dns.promises.lookup(host, { all: true }).catch(() => { throw new Error('host did not resolve (DNS)'); });
  if (addrs.some((a) => isPrivateIP(a.address))) throw new Error('host resolves to a private address');
  return u;
}

// Send one unpaid POST {} and return the raw shape. Throws on SSRF/connection/timeout.
export async function probe(rawUrl, { timeout = 9000 } = {}) {
  const url = await assertPublicUrl(rawUrl);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  const started = Date.now();
  try {
    const r = await fetch(url.href, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: '{}',
      redirect: 'manual',
      signal: ctrl.signal,
    });
    const latency = Date.now() - started;
    const text = await r.text().catch(() => '');
    let json = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { href: url.href, status: r.status, latency, json, textLen: text.length };
  } finally {
    clearTimeout(t);
  }
}

// Is this response a live k402 pay-gate? (402 whose body is a k402 challenge)
export const isK402Challenge = (json) => !!(json && typeof json === 'object' && 'k402' in json && Array.isArray(json.accepts));

// Bounded-concurrency map (endpoints can be slow; don't open 50 sockets at once).
export async function pMap(items, fn, concurrency = 8) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}
