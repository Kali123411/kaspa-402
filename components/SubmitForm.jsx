import { useState } from 'react';
import Term from './Term';
import { BUTTON, FIELD, MARK } from './Ledger';

// The provider's listing form (moved from the landing page: UI/UX brief, Phase 2 P1-7). One unpaid probe decides.
const Field = ({ label, children, span }) => (
  <div className={span ? 'sm:col-span-2' : ''}><label className={MARK}>{label}</label>{children}</div>
);

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
  const field = `${FIELD} mt-1.5 w-full`;
  return (
    <form onSubmit={submit} className="grid gap-4 border-t border-gray-100 pt-5 sm:grid-cols-2">
      <Field label="Service name" span><input className={field} value={f.serviceName} onChange={upd('serviceName')} placeholder="My inference API" required /></Field>
      <Field label="Resource URL (the x402-paid endpoint)" span><input className={field} value={f.resource} onChange={upd('resource')} placeholder="https://your-host/run" inputMode="url" required /></Field>
      <Field label="Description" span><textarea className={`${field} resize-y`} rows={2} value={f.description} onChange={upd('description')} placeholder="One or two lines: what it does, what you send and get back." /></Field>
      <Field label="Scheme"><select className={field} value={f.scheme} onChange={upd('scheme')}><option value="exact">exact</option><option value="batch-settlement">batch-settlement</option></select></Field>
      <Field label="Network"><select className={field} value={f.network} onChange={upd('network')}><option value="kaspa:testnet-10">kaspa:testnet-10</option><option value="kaspa:mainnet">kaspa:mainnet</option></select></Field>
      <Field label="Price (sompi)"><input className={field} value={f.amountSompi} onChange={upd('amountSompi')} type="number" placeholder="20000000" required /></Field>
      <Field label={<>Capability <span className="text-gray-600">(optional)</span></>}><input className={field} value={f.capability} onChange={upd('capability')} placeholder="summarize" /></Field>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <button type="submit" disabled={busy} className={`${BUTTON} disabled:opacity-60`}>{busy ? 'probing endpoint…' : 'Submit for listing'}</button>
        {msg ? <span className={`font-mono text-[12.5px] ${msg.level === 'ok' ? 'text-accent' : 'text-gray-200'}`}>{msg.text}</span> : null}
      </div>
      <p className="font-mono text-[12px] leading-relaxed text-gray-500 sm:col-span-2">We send one unpaid request to your resource; it must return HTTP 402 with a valid <Term id="x402-v2">x402 v2</Term> <Term id="payment-required">PAYMENT-REQUIRED</Term> header (a recognized Kaspa <Term id="scheme">scheme</Term> and a well-formed <Term id="payto">payTo</Term>) to be listed. Nothing is charged or stored.</p>
    </form>
  );
}
