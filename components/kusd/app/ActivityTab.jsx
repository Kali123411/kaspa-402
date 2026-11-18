// What this browser broadcast, newest first (kept on this device only).
import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { list } from '../../../lib/kusd/app/activity.mjs';
import { Panel, txUrl } from './ui';

const storage = { getItem: (key) => window.localStorage.getItem(key), setItem: () => {} };
const FLOW_LABEL = { swap_in: 'Buy', swap_out: 'Redeem', open_vault: 'Open vault', mint: 'Borrow', repay: 'Repay', adjust: 'Collateral', close: 'Close vault', send: 'Send' };

export default function ActivityTab({ version, owner }) {
  const [entries, setEntries] = useState([]);
  useEffect(() => { setEntries(owner ? list(storage, owner) : []); }, [version, owner]);
  return (
    <Panel title="Activity on this device">
      {entries.length === 0 && <p className="text-sm text-gray-400">{owner ? 'Nothing broadcast from this wallet in this browser yet.' : 'Unlock a wallet to see its activity.'}</p>}
      <ul className="divide-y divide-gray-800">
        {entries.map((e) => (
          <li key={e.txid} className="py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm text-white"><span className="mr-2 font-mono text-[10px] uppercase tracking-wider text-neon-purple">{FLOW_LABEL[e.flow] || e.flow}</span>{e.summary}</span>
              <span className="font-mono text-[11px] text-gray-600">{new Date(e.at).toISOString().replace('T', ' ').slice(0, 16)} UTC</span>
            </div>
            <a href={txUrl(e.txid)} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-neon-purple hover:underline">
              {e.txid.slice(0, 12)}…{e.txid.slice(-4)} <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500">The chain is the record; this list is a convenience kept in this browser.</p>
    </Panel>
  );
}
