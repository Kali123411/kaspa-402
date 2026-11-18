import { useState } from 'react';
import Term from './Term';

// The provider's listing form (moved from the landing page: UI/UX brief, Phase 2 P1-7). One unpaid probe decides.
const FIELD = 'rounded-xl border border-teal-400/20 bg-gray-950/70 px-4 py-2.5 font-mono text-[13px] text-gray-100 outline-none placeholder:text-gray-600 focus:border-teal-400/60';

export default function SubmitForm({ onAdded }) {
  const empty = { serviceName: '', resource: '', description: '', capability: '', scheme: 'exact', network: 'kaspa:testnet-10', amountSompi: '', payTo: '' };
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const upd = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setMsg(null);
    try {
      const body = { ...f, amountSompi: Number(f.amountSompi), payTo: f.payTo.trim() || undefined, capability: f.capability.trim() || undefined };
      const r = await fetch('/api/registry/submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (d.ok) { setMsg({ level: 'ok', text: 'Listed — your endpoint passed the live x402 v2 probe.' }); setF(empty); onAdded && onAdded(); }
      else setMsg({ level: 'err', text: d.error || 'submission failed' });
    } catch { setMsg({ level: 'err', text: 'request failed — check the endpoint and try again' }); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="glass grid gap-3 rounded-2xl border border-teal-400/15 p-5 sm:grid-cols-2">
      <div className="sm:col-span-2"><label className="font-mono text-[11px] uppercase tracking-wider text-gray-500">Service name</label>
        <input className={FIELD + ' mt-1.5 w-full'} value={f.serviceName} onChange={upd('serviceName')} placeholder="My inference API" required /></div>
      <div className="sm:col-span-2"><label className="font-mono text-[11px] uppercase tracking-wider text-gray-500">Resource URL (the x402-paid endpoint)</label>
        <input className={FIELD + ' mt-1.5 w-full'} value={f.resource} onChange={upd('resource')} placeholder="https://your-host/run" inputMode="url" required /></div>
      <div className="sm:col-span-2"><label className="font-mono text-[11px] uppercase tracking-wider text-gray-500">Description</label>
        <textarea className={FIELD + ' mt-1.5 w-full resize-y'} rows={2} value={f.description} onChange={upd('description')} placeholder="One or two lines: what it does, what you send and get back." /></div>
      <div><label className="font-mono text-[11px] uppercase tracking-wider text-gray-500">Scheme</label>
        <select className={FIELD + ' mt-1.5 w-full'} value={f.scheme} onChange={upd('scheme')}>
          <option value="exact">exact</option><option value="batch-settlement">batch-settlement</option></select></div>
      <div><label className="font-mono text-[11px] uppercase tracking-wider text-gray-500">Network</label>
        <select className={FIELD + ' mt-1.5 w-full'} value={f.network} onChange={upd('network')}>
          <option value="kaspa:testnet-10">kaspa:testnet-10</option><option value="kaspa:mainnet">kaspa:mainnet</option></select></div>
      <div><label className="font-mono text-[11px] uppercase tracking-wider text-gray-500">Price (sompi)</label>
        <input className={FIELD + ' mt-1.5 w-full'} value={f.amountSompi} onChange={upd('amountSompi')} type="number" placeholder="20000000" required /></div>
      <div><label className="font-mono text-[11px] uppercase tracking-wider text-gray-500">Capability <span className="text-gray-600">(optional)</span></label>
        <input className={FIELD + ' mt-1.5 w-full'} value={f.capability} onChange={upd('capability')} placeholder="summarize" /></div>
      <div className="flex items-center gap-4 sm:col-span-2">
        <button type="submit" disabled={busy} className="btn-kaspa rounded-lg px-5 py-2.5 font-orbitron text-[12.5px] font-bold uppercase tracking-wide text-[#04121a] disabled:opacity-60">
          {busy ? 'probing endpoint…' : 'Submit for listing →'}</button>
        {msg ? <span className={`font-mono text-[12px] ${msg.level === 'ok' ? 'text-teal-400' : 'text-rose-400'}`}>{msg.text}</span> : null}
      </div>
      <p className="sm:col-span-2 font-mono text-[11px] leading-relaxed text-gray-600">We send one unpaid request to your resource; it must return HTTP 402 with a valid <Term id="x402-v2">x402 v2</Term> <Term id="payment-required">PAYMENT-REQUIRED</Term> header before it appears. Nothing is charged.</p>
    </form>
  );
}
