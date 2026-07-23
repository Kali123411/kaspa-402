// pages/index.js — the Kaspa x402 marketplace. A directory of x402-payable services (built on the
// Kaspa x402 v2 standard, @kaspa-x402/*). Reads the merged registry (curated seed + approved
// submissions) from /api/registry/list; lets anyone submit a service (gated by a live x402 v2 probe).
import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';

const SOMPI = 1e8;
const kas = (s) => { const n = Number(s) / SOMPI; return isFinite(n) ? parseFloat(n.toFixed(8)) : null; };
// USD-pegged services settle in KAS at the live rate (amountSompi is the dust floor); fixed services show KAS.
const priceLabel = (l) => { const u = Number(l.priceUsd); return u > 0 ? `$${u.toFixed(2)}/call · in KAS at spot (min ${kas(l.amountSompi)} KAS)` : `${l.amountSompi} sompi · ${kas(l.amountSompi)} KAS`; };
const short = (s) => (s && s.length > 34 ? s.slice(0, 16) + '…' + s.slice(-8) : s);
const FIELD = 'rounded-xl border border-teal-400/20 bg-gray-950/70 px-4 py-2.5 font-mono text-[13px] text-gray-100 outline-none placeholder:text-gray-600 focus:border-teal-400/60';

function ServiceCard({ l }) {
  const isBase = l.kind === 'base';
  const baseUsd = isBase && l.base ? `$${Number(l.base.usd).toFixed(Number(l.base.usd) < 0.01 ? 3 : 2)}` : null;
  return (
    <article className={`glass card-hover flex flex-col gap-3 rounded-2xl border p-5 ${isBase ? 'border-sky-400/20' : 'border-teal-400/15'}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-orbitron text-[15px] font-bold tracking-tight text-gray-100">{l.serviceName}</h3>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${isBase ? 'border-sky-400/40 text-sky-300' : l.verified ? 'border-teal-400/40 text-teal-400' : 'border-amber-400/40 text-amber-400'}`}>
          {isBase ? 'via router' : l.verified ? 'verified' : 'submitted'}
        </span>
      </div>
      {l.description ? <p className="text-[13.5px] leading-relaxed text-gray-400">{l.description}</p> : null}
      <div className="mt-1 flex flex-wrap gap-2 font-mono text-[11px]">
        <span className="rounded border border-gray-800 bg-white/5 px-2 py-0.5 text-teal-400">{l.scheme}</span>
        <span className="rounded border border-gray-800 bg-white/5 px-2 py-0.5 text-gray-400">{l.network}</span>
        {isBase ? <span className="rounded border border-sky-500/30 bg-sky-500/5 px-2 py-0.5 text-sky-300">→ {baseUsd} on Base</span> : null}
        <span className="rounded border border-gray-800 bg-white/5 px-2 py-0.5 text-gray-300">{priceLabel(l)}</span>
        {(l.tags || []).map((t) => <span key={t} className="rounded border border-gray-800 px-2 py-0.5 text-gray-500">{t}</span>)}
      </div>
      <div className="mt-1 font-mono text-[11.5px] text-gray-500">
        <div className="truncate">resource: <a href={l.resource} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-teal-400">{l.resource}</a></div>
        {isBase && l.base ? (
          <div className="truncate">settles on: <span className="text-sky-300">{l.base.host}</span> <span className="text-gray-600">· {l.base.network}</span></div>
        ) : l.payTo ? <div className="truncate">payTo: <span className="text-gray-400">{short(l.payTo)}</span></div> : null}
      </div>
      <a href={`/validate?u=${encodeURIComponent(l.resource)}`} className="mt-1 self-start font-mono text-[11.5px] text-teal-400 hover:underline">verify it →</a>
    </article>
  );
}

function SubmitForm({ onAdded }) {
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
      <p className="sm:col-span-2 font-mono text-[11px] leading-relaxed text-gray-600">We send one unpaid request to your resource; it must return HTTP 402 with a valid x402 v2 PAYMENT-REQUIRED header before it appears. Nothing is charged.</p>
    </form>
  );
}

export default function Marketplace() {
  const [listings, setListings] = useState([]);
  const [q, setQ] = useState('');
  const [net, setNet] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = () => fetch('/api/registry/list').then((r) => r.json()).then((d) => setListings(d.listings || [])).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return listings.filter((l) => {
      if (net !== 'all' && l.network !== net) return false;
      if (!needle) return true;
      return [l.serviceName, l.description, l.capability, l.scheme, ...(l.tags || [])].join(' ').toLowerCase().includes(needle);
    });
  }, [listings, q, net]);

  const kaspaSvcs = useMemo(() => shown.filter((l) => l.kind !== 'base'), [shown]);
  const baseSvcs = useMemo(() => shown.filter((l) => l.kind === 'base'), [shown]);

  return (
    <>
      <Head>
        <title>Kaspa x402 marketplace — pay-per-call services on Kaspa</title>
        <meta name="description" content="A directory of x402-payable services settled on Kaspa L1, built on the Kaspa x402 v2 standard. Pay per call with @kaspa-x402/client — no account, no API key." />
      </Head>
      <main className="mx-auto max-w-5xl px-6 py-12">
        <section className="max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-teal-400">Kaspa · x402 v2</p>
          <h1 className="mt-4 font-orbitron text-4xl font-bold uppercase leading-tight tracking-tight sm:text-5xl">A marketplace of x402-payable services on Kaspa</h1>
          <p className="mt-5 text-[16px] leading-relaxed text-gray-300">
            Every service here speaks the <a href="https://kaspa-x402.org" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline">Kaspa x402</a> standard.
            An agent calls a resource, gets an HTTP <span className="font-mono text-gray-200">402</span>, and pays per call on Kaspa L1 —
            no account, no API key, no custodian. Settled on <span className="font-mono text-gray-200">kaspa:testnet-10</span> today, <span className="font-mono text-gray-200">kaspa:mainnet</span> as the standard hardens.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-gray-400">
            Two directions: <span className="text-teal-400">Kaspa-native</span> services you pay in KAS, and <span className="text-sky-300">Base-native</span> services you can now pay for in KAS too —
            the <a href="https://github.com/Kali123411/kaspa-x402-router" target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:underline">router</a> settles the Base leg for you.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#browse" className="btn-kaspa rounded-lg px-5 py-2.5 font-orbitron text-[12.5px] font-bold uppercase tracking-wide text-[#04121a]">Browse services →</a>
            <a href="/validate" className="rounded-lg border border-teal-400/40 px-5 py-2.5 font-mono text-[12.5px] text-teal-400 hover:bg-teal-400/10">Validate your service</a>
          </div>
        </section>

        <section className="mt-12 grid gap-4 rounded-2xl border border-gray-800 bg-gray-950/40 p-6 sm:grid-cols-3">
          <div><div className="font-mono text-[11px] uppercase tracking-wider text-gray-500">1 · call</div><p className="mt-1.5 text-[13.5px] text-gray-300">Request a resource. It answers <span className="font-mono">402</span> with a <span className="font-mono">PAYMENT-REQUIRED</span> header.</p></div>
          <div><div className="font-mono text-[11px] uppercase tracking-wider text-gray-500">2 · pay</div><p className="mt-1.5 text-[13.5px] text-gray-300"><span className="font-mono">@kaspa-x402/client</span> pays on Kaspa (exact or batch-settlement) and retries.</p></div>
          <div><div className="font-mono text-[11px] uppercase tracking-wider text-gray-500">3 · settle</div><p className="mt-1.5 text-[13.5px] text-gray-300">Value moves on Kaspa L1. You get the result. No middleman held the funds.</p></div>
        </section>

        <section id="browse" className="mt-14 scroll-mt-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-orbitron text-[22px] font-bold uppercase tracking-tight">Browse services</h2>
            <div className="flex flex-wrap gap-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search services…" className={FIELD + ' min-w-[200px]'} />
              <select value={net} onChange={(e) => setNet(e.target.value)} className={FIELD}>
                <option value="all">all networks</option><option value="kaspa:testnet-10">kaspa:testnet-10</option><option value="kaspa:mainnet">kaspa:mainnet</option>
              </select>
            </div>
          </div>
          <div className="mt-8 space-y-12">
            {kaspaSvcs.length > 0 ? (
              <div>
                <div className="flex flex-wrap items-baseline gap-3 border-b border-teal-400/15 pb-2">
                  <h3 className="font-orbitron text-[15px] font-bold uppercase tracking-tight text-teal-400">Kaspa-native</h3>
                  <span className="font-mono text-[11.5px] text-gray-500">pay in KAS · settled on Kaspa L1 · {kaspaSvcs.length}</span>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {kaspaSvcs.map((l) => <ServiceCard key={l.id || l.resource} l={l} />)}
                </div>
              </div>
            ) : null}
            {baseSvcs.length > 0 ? (
              <div>
                <div className="flex flex-wrap items-baseline gap-3 border-b border-sky-400/20 pb-2">
                  <h3 className="font-orbitron text-[15px] font-bold uppercase tracking-tight text-sky-300">Base-native · via the router</h3>
                  <span className="font-mono text-[11.5px] text-gray-500">pay in KAS · router settles USDC on Base · {baseSvcs.length}</span>
                </div>
                <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-gray-500">
                  These services live on Base. You still pay in KAS — the <a href="https://github.com/Kali123411/kaspa-x402-router" target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:underline">kaspa-x402-router</a> pays
                  the service’s USDC on Base for you and returns the result, with an on-chain receipt for each leg.
                </p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {baseSvcs.map((l) => <ServiceCard key={l.id || l.resource} l={l} />)}
                </div>
              </div>
            ) : null}
          </div>
          {!loading && shown.length === 0 ? (
            <p className="mt-6 rounded-xl border border-gray-800 bg-gray-950/40 px-5 py-4 font-mono text-[13px] text-gray-500">
              No services match. {listings.length === 0 ? 'Be the first — submit yours below.' : 'Try a different filter.'}
            </p>
          ) : null}
        </section>

        <section id="list" className="mt-16 scroll-mt-20">
          <h2 className="font-orbitron text-[22px] font-bold uppercase tracking-tight">List your service</h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-gray-400">
            Ship an x402 v2 endpoint with <a href="https://www.npmjs.com/package/@kaspa-x402/server" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline">@kaspa-x402/server</a>, then submit it.
            It only appears once it passes a live x402 v2 probe.
          </p>
          <div className="mt-5"><SubmitForm onAdded={load} /></div>
        </section>

        <section className="mt-16">
          <h2 className="mb-4 font-mono text-[12.5px] uppercase tracking-[0.18em] text-gray-400">Pay from an agent</h2>
          <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-gray-950/40 p-5 font-mono text-[12.5px] leading-relaxed text-gray-300">
            <div className="text-gray-500"># install the standard client</div>
            <div>npm i @kaspa-x402/client</div>
            <div className="mt-3 text-gray-500"># call a resource — it pays the 402 and retries for you</div>
            <div><span className="text-teal-400">import</span> {'{ DirectModeClient }'} <span className="text-teal-400">from</span> <span className="text-gray-200">'@kaspa-x402/client'</span>;</div>
            <div><span className="text-teal-400">const</span> r = <span className="text-teal-400">await</span> client.paidFetch(<span className="text-gray-200">'https://demo.kaspa-x402.org/exact'</span>);</div>
          </div>
        </section>

        <footer className="mt-16 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-gray-800 pt-6 font-mono text-[12px] text-gray-500">
          <a href="/llms.txt" className="hover:text-teal-400">/llms.txt</a>
          <a href="/llms.json" className="hover:text-teal-400">/llms.json</a>
          <a href="/validate" className="hover:text-teal-400">validate</a>
          <a href="https://kaspa-x402.org" target="_blank" rel="noopener noreferrer" className="hover:text-teal-400">standard ↗</a>
          <a href="https://github.com/elldeeone/kaspa-x402" target="_blank" rel="noopener noreferrer" className="hover:text-teal-400">SDK ↗</a>
          <span className="ml-auto text-gray-600">unaudited · testnet-first · not financial advice</span>
        </footer>
      </main>
    </>
  );
}
