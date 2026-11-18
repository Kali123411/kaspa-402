// The hero's live proof strip (UI/UX brief, Phase 2 P0-2): real numbers from the directory and the registry.
export function ago(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** listed services, how many passed the unpaid 402 probe, kUSD settlements the registry verified, and the last one's age. */
export function computeStats(listings, activity, nowMs = Date.now()) {
  const rows = Array.isArray(listings) ? listings : [];
  const settlements = Array.isArray(activity?.settlements) ? activity.settlements : [];
  const last = settlements.reduce((m, r) => Math.max(m, Number(r?.t) || 0), 0);
  return {
    listed: rows.length,
    probesPassed: rows.filter((l) => l && l.verified === true).length,
    settlements: settlements.length,
    settledCents: Number(activity?.total_cents) || 0,
    lastSettlementAgo: last ? ago(nowMs - last * 1000) : null,
  };
}
