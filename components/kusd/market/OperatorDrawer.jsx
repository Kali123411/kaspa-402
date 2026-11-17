// The operator's side of the agent: the bounds (a SpendPolicy, same fields and meaning as k402's), what is left
// on each, the kill switch, and the ledger. In a browser the operator and the agent are the same person; this
// shows the mechanism that k402 / k402-mcp enforce for real agents.
import { useEffect, useState } from 'react';
import { ExternalLink, Lock, Unlock } from 'lucide-react';
import { input, primary, secondary, usdText, Panel, txUrl } from '../app/ui';
import { SpendPolicy } from '../../../lib/kusd/market/spend.mjs';

const FIELDS = [
  ['maxPerCallCents', 'Max per call (¢)', 'A quote above this is refused before anything is built.'],
  ['maxTotalCents', 'Lifetime budget (¢)', 'Everything this wallet ever pays through this page.'],
  ['maxWindowCents', 'Per window (¢)', 'kUSD paid inside the sliding window.'],
  ['maxWindowCalls', 'Calls per window', 'Also bounds the KAS locked in boxes: 1.5 KAS each.'],
  ['maxWindowFailures', 'Unserved payments per window', 'Paid calls that were not served; at this many, stop paying anyone.'],
  ['windowSeconds', 'Window (seconds)', 'The sliding window the per-window limits use.'],
];

const Meter = ({ label, used, max }) => (
  <div>
    <div className="flex justify-between text-xs text-gray-400"><span>{label}</span><span className="font-mono">{max == null ? `${used} · no limit` : `${used} / ${max}`}</span></div>
    <div className="mt-1 h-1.5 overflow-hidden rounded bg-gray-800">
      <div className={`h-full ${max != null && used >= max ? 'bg-red-400' : 'bg-neon-purple'}`} style={{ width: max == null ? '0%' : `${Math.min(100, (100 * used) / Math.max(1, max))}%` }} />
    </div>
  </div>
);

export default function OperatorDrawer({ policy, onPolicy, status, ledger, frozen, onFreeze, history }) {
  const [draft, setDraft] = useState(() => policy.toJSON());
  const [err, setErr] = useState(null);
  const [caps, setCaps] = useState(() => (policy.allowCapabilities || []).join(', '));
  // the page loads the stored policy after mount: the form follows the policy it is editing
  useEffect(() => { setDraft(policy.toJSON()); setCaps((policy.allowCapabilities || []).join(', ')); setErr(null); }, [policy]);
  const apply = (e) => {
    e.preventDefault();
    try {
      const obj = { ...draft };
      for (const [k] of FIELDS) obj[k] = draft[k] === '' || draft[k] == null ? (k === 'windowSeconds' ? 3600 : null) : Number(draft[k]);
      obj.allowCapabilities = caps.trim() ? caps.split(',').map((s) => s.trim()).filter(Boolean) : null;
      const p = SpendPolicy.from(obj);
      setErr(null);
      onPolicy(p);
    } catch (x) {
      setErr(x.message);
    }
  };
  const w = status?.window;
  return (
    <Panel title="Operator">
      <p className="text-sm text-gray-300">
        The person who funds an agent&apos;s wallet sets these; the agent cannot loosen them from a call. Here you are both, so this is the
        mechanism on display — <a className="text-neon-purple hover:underline" href="https://github.com/Kali123411/k402/blob/main/DESIGN-kusd-spend-controls.md" target="_blank" rel="noreferrer">k402&apos;s SpendPolicy <ExternalLink className="inline h-3 w-3" aria-hidden /></a> enforces the same bounds for real agents and MCP servers.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onFreeze} className={frozen ? primary : secondary}>
          {frozen ? <><Unlock className="h-4 w-4" aria-hidden /> Unfreeze</> : <><Lock className="h-4 w-4" aria-hidden /> Freeze (kill switch)</>}
        </button>
        <span className="text-xs text-gray-400">{frozen ? 'Every payment is refused until you unfreeze.' : 'Freezing refuses every payment at once, without touching the wallet.'}</span>
      </div>
      <p className="text-[11px] text-gray-500">The policy is kept per browser (the operator&apos;s), the ledger and the freeze per wallet key.</p>
      {status && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Meter label="lifetime (¢)" used={status.totalCents} max={policy.maxTotalCents} />
          <Meter label={`last ${policy.windowSeconds}s (¢)`} used={w.cents} max={policy.maxWindowCents} />
          <Meter label="calls in window" used={w.calls} max={policy.maxWindowCalls} />
          <Meter label="unserved in window" used={w.failures} max={policy.maxWindowFailures} />
        </div>
      )}
      <form onSubmit={apply} className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map(([k, label, help]) => (
          <label key={k} className="block text-xs text-gray-400">
            {label}
            <input className={`${input} mt-1`} inputMode="numeric" value={draft[k] ?? ''} placeholder={k === 'windowSeconds' ? '3600' : 'no limit'}
              onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
            <span className="mt-1 block text-[11px] text-gray-500">{help}</span>
          </label>
        ))}
        <label className="block text-xs text-gray-400 sm:col-span-2">
          Allowed capabilities (comma-separated; empty = any)
          <input className={`${input} mt-1`} value={caps} onChange={(e) => setCaps(e.target.value)} placeholder="summarize, extract" />
        </label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" className={primary}>Apply policy</button>
          {err && <span className="text-sm text-red-400">{err}</span>}
        </div>
      </form>
      <div>
        <div className="text-xs uppercase tracking-wider text-gray-500">Ledger (this wallet, this browser)</div>
        {(!history || history.length === 0) && <p className="mt-1 text-sm text-gray-400">Nothing reserved or paid yet.</p>}
        <ul className="mt-1 divide-y divide-gray-800">
          {(history || []).map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5 text-xs">
              <span><span className="font-mono text-gray-500">{new Date(r.ts).toISOString().replace('T', ' ').slice(5, 16)}</span> <span className="font-mono text-gray-200">{usdText(r.cents)}</span> <span className="text-gray-400">{r.capability || '—'}</span> <span className="font-mono text-gray-500">{r.provider.slice(0, 8)}…</span></span>
              <span className="font-mono text-gray-400">
                {r.state}{r.http != null ? ` · HTTP ${r.http}` : ''}
                {r.txid && <> · <a href={txUrl(r.txid)} target="_blank" rel="noreferrer" className="text-neon-purple hover:underline">{r.txid.slice(0, 10)}…</a></>}
              </span>
            </li>
          ))}
        </ul>
        {ledger && <p className="mt-2 text-[11px] text-gray-500">Rows marked <span className="font-mono">void</span> were refused before anything was signed and do not count; <span className="font-mono">sent</span> rows count whether or not the provider served the call. One tab at a time: browser storage is not transactional.</p>}
      </div>
    </Panel>
  );
}
