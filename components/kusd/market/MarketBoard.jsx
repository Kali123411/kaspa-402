// Every kUSD-priced listing on the registry: what it does, what it costs, who runs it, what it has earned, and
// whether it is answering right now.
import { useEffect, useMemo, useState } from 'react';
import { Radio, Search } from 'lucide-react';
import { input, usdText, Panel } from '../app/ui';

const short = (k) => `${k.slice(0, 8)}…${k.slice(-4)}`;
// relative times are computed from a clock set after mount: the server-rendered HTML must not carry a "now"
const ago = (t, now) => {
  if (!t || !now) return '—';
  const s = Math.max(0, Math.round(now / 1000 - t));
  return s < 90 ? `${s}s ago` : s < 5400 ? `${Math.round(s / 60)} min ago` : s < 172800 ? `${(s / 3600).toFixed(1)} h ago` : `${Math.round(s / 86400)} d ago`;
};
function useNow(everyMs = 30_000) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
const SORTS = { reputation: 'most settled', price: 'cheapest', newest: 'newest' };

export function LiveDot({ probe }) {
  if (!probe) return <span className="inline-flex items-center gap-1 text-[11px] text-gray-500"><Radio className="h-3 w-3" aria-hidden /> checking…</span>;
  return probe.live
    ? <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden /> live, quoting {usdText(probe.cents ?? 0)}</span>
    : <span className="inline-flex items-center gap-1 text-[11px] text-gray-500"><span className="h-2 w-2 rounded-full bg-gray-600" aria-hidden /> not answering</span>;
}

export default function MarketBoard({ providers, live, fromSnapshot, loading, selected, onPick }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('reputation');
  const now = useNow();
  const shown = useMemo(() => {
    const f = q.trim().toLowerCase();
    const list = providers.filter((p) => !f || p.capability.toLowerCase().includes(f) || (p.meta?.provider || '').toLowerCase().includes(f) || (p.meta?.model || '').toLowerCase().includes(f));
    const by = {
      reputation: (a, b) => (b.reputation?.settled_cents || 0) - (a.reputation?.settled_cents || 0) || a.price_cents - b.price_cents,
      price: (a, b) => a.price_cents - b.price_cents || (b.reputation?.settled_cents || 0) - (a.reputation?.settled_cents || 0),
      newest: (a, b) => (b.listed_at || 0) - (a.listed_at || 0),
    }[sort];
    return [...list].sort(by);
  }, [providers, q, sort]);

  return (
    <Panel title="Market">
      <div className="flex flex-wrap gap-2">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-500" aria-hidden />
          <input className={`${input} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="capability, provider, model…" aria-label="Search listings" />
        </label>
        <select className={`${input} w-auto`} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort listings">
          {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {shown.length === 0 && <p className="text-sm text-gray-400">{providers.length ? 'Nothing matches.' : 'No kUSD listings on the registry yet.'}</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {shown.map((p) => {
          const key = `${p.payee_pubkey}:${p.capability}`;
          const isSel = selected && `${selected.payee_pubkey}:${selected.capability}` === key;
          return (
            <li key={key} className="h-full">
              <button type="button" onClick={() => onPick(p)} aria-pressed={isSel}
                className={`flex h-full w-full flex-col rounded-xl border p-4 text-left transition ${isSel ? 'border-neon-purple bg-neon-purple/10' : 'border-gray-800 bg-black/30 hover:border-gray-600'}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-base text-white">{p.capability}</span>
                  <span className="font-mono text-sm text-neon-purple" title={`${p.price_cents}¢`}>{usdText(p.price_cents)}<span className="text-gray-500">/call</span></span>
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  {p.meta?.provider || `provider ${short(p.payee_pubkey)}`}{p.meta?.model ? ` · ${p.meta.model}` : ''}
                  {Array.isArray(p.meta?.wires) ? ` · ${p.meta.wires.join(' + ')}` : ''}
                </div>
                {p.description && <p className="mt-2 line-clamp-3 text-xs text-gray-300" title={p.description}>{p.description}</p>}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 text-xs text-gray-400">
                  <span>settled to this provider <span className="font-mono text-gray-200">{usdText(p.reputation?.settled_cents || 0)}</span>{p.reputation?.last_settled ? `, last ${ago(p.reputation.last_settled, now)}` : ''}</span>
                  {loading ? <span className="text-[11px] text-gray-500">…</span> : fromSnapshot ? <span className="text-[11px] text-gray-500">snapshot</span> : <LiveDot probe={live[p.endpoint]} />}
                </div>
                <div className="mt-2 break-all font-mono text-[10px] text-gray-600">{p.payee_pubkey}</div>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-gray-500">
        Reputation is kUSD the registry verified on its own node, box by box, at each offer&apos;s key — not a score anyone can type in.
        Listing costs 10¢ of kUSD, paid through k402 like any other call.
      </p>
    </Panel>
  );
}
