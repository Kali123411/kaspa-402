// The live wire's ticker (identity design, E2): real events from the registry and the directory, newest first.
// Nothing here is invented: a settlement is a verified kUSD box the registry indexed, a probe is a listing's last unpaid 402.
import { ago } from './stats.mjs';

const SOMPI = 1e8;
const kas = (s) => { const n = Number(s) / SOMPI; return Number.isFinite(n) ? String(parseFloat(n.toFixed(8))) : '?'; };
const cents = (c) => (Number(c) / 100).toFixed(2);

export const MAX_EVENTS = 12;

/** @returns {{kind:'settled'|'probe'|'none', t:number, text:string}[]} newest first, at most MAX_EVENTS */
export function tickerEvents(listings, activity, nowMs = Date.now()) {
  const out = [];
  for (const r of Array.isArray(activity?.settlements) ? activity.settlements : []) {
    const t = Number(r?.t) || 0;
    if (!t) continue;
    out.push({ kind: 'settled', t, text: `SETTLED ${cents(r.cents)} kUSD → ${r.capability || 'service'} · ${String(r.txid || '').slice(0, 8)} · ${ago(nowMs - t * 1000)}` });
  }
  for (const l of Array.isArray(listings) ? listings : []) {
    if (!l || l.verified !== true) continue;
    const t = typeof l.probedAt === 'number' ? l.probedAt : Math.floor((Date.parse(l.probedAt) || 0) / 1000);
    if (!t) continue;
    // USD-pegged listings settle in KAS at spot (amountSompi is only the dust floor); fixed listings quote KAS
    const price = Number(l.priceUsd) > 0 ? `$${Number(l.priceUsd).toFixed(2)}/call in KAS` : `${kas(l.amountSompi)} KAS`;
    out.push({ kind: 'probe', t, text: `402 PROBE PASSED · ${l.serviceName} · ${price} · ${ago(nowMs - t * 1000)}` });
  }
  out.sort((a, b) => b.t - a.t);
  if (out.length === 0) return [{ kind: 'none', t: 0, text: 'no settlements recorded yet — the first paid call on this rail will appear here' }];
  return out.slice(0, MAX_EVENTS);
}
