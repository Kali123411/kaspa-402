// Agents paying agents, as the registry verified it: each row is a kUSD box the registry found on its node at
// the offer's derived key, reported by the provider while the box was unspent.
import { useEffect, useRef, useState } from 'react';
import Freshness from '../../Freshness';
import { usdText, Panel, txUrl } from '../app/ui';

const short = (k) => `${k.slice(0, 8)}…`;
const when = (t) => new Date(t * 1000).toISOString().replace('T', ' ').slice(5, 16);

export default function SettlementsFeed({ activity, fromSnapshot, loading, generatedAt }) {
  const rows = activity?.settlements || [];
  const seen = useRef(new Set());
  const [fresh, setFresh] = useState(new Set());
  useEffect(() => {
    const now = new Set();
    for (const r of rows) {
      const id = `${r.txid}:${r.idx}`;
      if (seen.current.size && !seen.current.has(id)) now.add(id);
      seen.current.add(id);
    }
    if (now.size) {
      setFresh(now);
      const t = setTimeout(() => setFresh(new Set()), 4000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [rows]);

  return (
    <Panel title="Settlements">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="text-gray-400">verified kUSD paid to providers — all providers, all time</span>
        <span className="font-mono text-lg text-white">{usdText(activity?.total_cents || 0)}</span>
      </div>
      {fromSnapshot && !loading && <Freshness state="unverified" source="market snapshot" at={generatedAt} />}
      {rows.length === 0 && <p className="text-sm text-gray-400">No settlements yet.</p>}
      <ul className="divide-y divide-gray-800" aria-live="polite">
        {rows.map((r) => {
          const id = `${r.txid}:${r.idx}`;
          return (
            <li key={id} className={`py-2 transition-colors ${fresh.has(id) ? 'bg-panel' : ''}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span><span className="font-mono text-white">{usdText(r.cents)}</span> <span className="text-gray-400">for</span> <span className="font-mono text-gray-200">{r.capability || '—'}</span></span>
                <span className="font-mono text-[11px] text-gray-500">{when(r.t)} UTC</span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-gray-500">
                <span>to <span className="font-mono">{short(r.payee_pubkey)}</span></span>
                <a href={txUrl(r.txid)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-accent hover:underline">
                  {r.txid.slice(0, 12)}… 
                </a>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-gray-500">Updates every 10 s. A payment you make below shows up here once the provider reports it and the registry&apos;s node confirms the box.</p>
    </Panel>
  );
}
