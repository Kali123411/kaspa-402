import { useEffect, useState } from 'react';

const Stat = ({ k, v, sub }) => (
  <div className="rounded-xl border border-gray-800 bg-gray-950/40 px-4 py-3">
    <div className="font-orbitron text-2xl font-bold text-gray-100">{v}</div>
    <div className="font-mono text-[11px] uppercase tracking-wider text-gray-500">{k}</div>
    {sub && <div className="mt-0.5 font-mono text-[11px] text-gray-600">{sub}</div>}
  </div>
);

/** Live proof under the headline (UI/UX brief, Phase 2 P0-2): real numbers beat adjectives; zero shows as zero. */
export default function StatStrip() {
  const [s, setS] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch('/api/stats').then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))).then(setS).catch(() => setFailed(true));
  }, []);
  const v = (x) => (s ? x : failed ? '—' : '…');
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="live proof">
      <Stat k="services listed" v={v(s?.listed)} />
      <Stat k="passed the 402 probe" v={v(s?.probesPassed)} sub="one unpaid request each" />
      <Stat k="kUSD settlements verified" v={v(s?.settlements)} sub={s && s.settledCents ? `$${(s.settledCents / 100).toFixed(2)} all providers, all time` : undefined} />
      <Stat k="last settlement" v={s ? (s.lastSettlementAgo ?? 'none yet') : failed ? '—' : '…'} sub={failed ? 'registry unreachable' : undefined} />
    </div>
  );
}
