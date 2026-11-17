// Every action ends here: the signed transaction described in words, then one tap to broadcast it.
import { useCallback, useRef, useState } from 'react';
import { ExternalLink, Loader2, X } from 'lucide-react';
import { record } from '../../../lib/kusd/app/activity.mjs';
import { applyPreview } from '../../../lib/kusd/app/sheet.mjs';
import { ContentionError } from '../../../lib/kusd/app/flow.mjs';
import { kasText, usdText, primary, secondary, txUrl } from './ui';

const storage = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};

export function useReview(k, secret, owner) {
  const [sheet, setSheet] = useState(null);
  const nextId = useRef(0);
  const start = useCallback(async (flow, params, summary) => {
    const id = ++nextId.current;
    setSheet({ id, flow, params, summary, status: 'building' });
    try {
      const p = await k.preview(flow, params, secret);
      setSheet((s) => applyPreview(s, id, p));
    } catch (e) {
      setSheet((s) => (s?.id === id ? { ...s, status: 'error', error: e.message } : s));
    }
  }, [k, secret]);
  const confirm = useCallback(async () => {
    const s = sheet;
    setSheet({ ...s, status: 'sending' });
    try {
      const r = await k.run(s.flow, s.params, secret, s.built);
      record(storage, owner, { txid: r.txid, flow: s.flow, at: Date.now(), summary: s.summary });
      setSheet((cur) => (cur?.id === s.id ? { ...s, status: 'done', txid: r.txid } : cur));
    } catch (e) {
      if (e instanceof ContentionError) {
        // never broadcast a rebuild unseen: show the updated transaction for a second tap
        try {
          const p = await k.preview(s.flow, s.params, secret);
          setSheet((cur) => (cur?.id === s.id ? { ...s, ...p, status: 'review', notice: 'Someone else used a shared protocol box first, so the transaction was rebuilt. Check the updated amounts before signing again.' } : cur));
          return;
        } catch (x) {
          e = x;
        }
      }
      setSheet((cur) => (cur?.id === s.id ? { ...s, status: 'error', error: e.message } : cur));
    }
  }, [k, secret, sheet, owner]);
  return { sheet, start, confirm, close: () => setSheet(null) };
}

const signed = (n, fmt) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : fmt(0));

function Lines({ title, lines }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-gray-500">{title}</div>
      <ul className="mt-1 space-y-1">
        {lines.map((l, i) => (
          <li key={i} className="flex justify-between gap-3 text-sm">
            <span className="min-w-0 break-words text-gray-300">{l.what}</span>
            <span className="shrink-0 font-mono text-gray-200">{l.sompi === null ? '?' : kasText(l.sompi)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ReviewSheet({ review }) {
  const { sheet, confirm, close } = review;
  if (!sheet) return null;
  const busy = sheet.status === 'building' || sheet.status === 'sending';
  const d = sheet.description;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" role="dialog" aria-modal="true" aria-label="Review transaction">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-gray-800 bg-gray-950 p-5 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 break-words font-semibold text-white">{sheet.summary}</h3>
          <button type="button" onClick={close} disabled={sheet.status === 'sending'} className="text-gray-500 hover:text-white" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {sheet.status === 'building' && <p className="mt-4 flex items-center gap-2 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Verifying state and building…</p>}
        {sheet.notice && sheet.status === 'review' && <p className="mt-4 rounded-lg border border-amber-400/40 bg-amber-400/5 p-3 text-sm text-amber-200">{sheet.notice}</p>}
        {d && sheet.status !== 'done' && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-black/30 p-3">
              <div><div className="text-xs uppercase tracking-wider text-gray-500">Your KAS</div><div className="font-mono text-white">{signed(d.net.kasSompi, kasText)}</div></div>
              <div><div className="text-xs uppercase tracking-wider text-gray-500">Your kUSD</div><div className="font-mono text-white">{signed(d.net.kusdCents, usdText)}</div></div>
              <p className="col-span-2 text-xs text-gray-500">From the signed transaction: spendable KAS (including the fee and any KAS locked in new boxes) and kUSD you hold.</p>
            </div>
            <Lines title="Spends" lines={d.inputs} />
            <Lines title="Creates" lines={d.outputs} />
            <div className="flex justify-between border-t border-gray-800 pt-2 text-sm">
              <span className="text-gray-500">Network fee</span>
              <span className="font-mono text-gray-200">{d.feeSompi === null ? '?' : kasText(d.feeSompi)}</span>
            </div>
            <p className="text-xs text-gray-500">Signed in this browser{d.clock ? `; valid from DAA ${d.clock}` : ''}. Covenants check every rule again on chain.</p>
          </div>
        )}
        {sheet.status === 'error' && <p className="mt-4 break-words rounded-lg border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-200">{sheet.error}</p>}
        {sheet.status === 'done' && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-emerald-300">Accepted by the node.</p>
            <a href={txUrl(sheet.txid)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all font-mono text-xs text-neon-purple hover:underline">
              {sheet.txid} <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
            </a>
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          {sheet.status === 'review' && <button type="button" className={primary} onClick={confirm}>Sign &amp; broadcast</button>}
          {sheet.status === 'sending' && <button type="button" className={primary} disabled><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Broadcasting…</button>}
          {!busy && <button type="button" className={secondary} onClick={close}>{sheet.status === 'done' ? 'Done' : 'Cancel'}</button>}
        </div>
      </div>
    </div>
  );
}
