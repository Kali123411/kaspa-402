import { useEffect, useState } from 'react';

const Stat = ({ k, v, sub }) => (
  <div>
    <div className="font-orbitron text-[clamp(32px,3vw,48px)] font-medium leading-none tracking-[-0.03em] text-gray-100 tabular-nums">{v}</div>
    <div className="mt-2 text-[14px] text-gray-500">{k}</div>
    {sub && <div className="mt-0.5 font-mono text-[11.5px] text-gray-600">{sub}</div>}
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
    <div className="grid grid-cols-2 gap-x-10 gap-y-6 border-y border-gray-100 py-5 sm:grid-cols-4" aria-label="live proof">
      <Stat k="services listed" v={v(s?.listed)} />
      <Stat k="passed the 402 probe" v={v(s?.probesPassed)} sub="one unpaid request each" />
      <Stat k="kUSD settlements verified" v={v(s?.settlements)} sub={s && s.settledCents ? `$${(s.settledCents / 100).toFixed(2)} all providers, all time` : undefined} />
      <Stat k="last settlement" v={s ? (s.lastSettlementAgo ?? 'none yet') : failed ? '—' : '…'} sub={failed ? 'registry unreachable' : undefined} />
    </div>
  );
}
