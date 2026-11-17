// pages/index.js — kaspa-402.org: the rails of the agent-native marketplace on Kaspa L1 (k402, Kaspa x402 v2).
// Agents are the audience; humans run the services and supervise the agents. Reads the merged registry
// (curated seed + approved submissions) from /api/registry/list; lets anyone submit a service (gated by a live
// x402 v2 probe). The story, names and disclaimers come from lib/story.js (shared with /llms.txt and /llms.json).
import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';
import { CLAIM, DISCLAIMERS, LAYERS, LINKS, MARKET_NAME, WHY_AGENTS } from '../lib/story';

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
        <title>kaspa-402 — the payment rail for AI agent commerce on Kaspa L1</title>
        <meta name="description" content={`${CLAIM} This is the rails layer: k402 (Kaspa x402 v2), HTTP 402 pay-per-call on Kaspa L1 — no account, no API key, no custodian.`} />
      </Head>
      <main className="mx-auto max-w-5xl px-6 py-12">
        <section className="max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-teal-400">Kaspa · k402 (Kaspa x402 v2) · the rails</p>
          <h1 className="mt-4 font-orbitron text-4xl font-bold uppercase leading-tight tracking-tight sm:text-5xl">The payment rail for AI agent commerce on Kaspa L1</h1>
          <p className="mt-5 text-[16px] leading-relaxed text-gray-300">
            An agent calls a resource, gets an HTTP <span className="font-mono text-gray-200">402</span>, pays on Kaspa L1 and retries —
            no account, no API key, no custodian. Every service here speaks <a href="https://kaspa-x402.org" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline">Kaspa x402 v2</a>.
            Humans run the services and supervise the agents; the agents do the buying.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-gray-400">
            Services here settle in <span className="text-teal-400">KAS</span>, most on <span className="font-mono text-gray-300">kaspa:mainnet</span>;
            <span className="text-sky-300"> Base-native</span> services are paid in KAS too, the <a href={LINKS.router} target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:underline">router</a> settling the Base leg.
            Services priced in agent money, <span className="text-gray-200">kUSD</span>, live on the {MARKET_NAME} on <span className="font-mono text-gray-300">kaspa:testnet-10</span> today.
          </p>
          <p className="mt-4 rounded-xl border border-gray-800 bg-gray-950/40 px-4 py-3 text-[13.5px] leading-relaxed text-gray-400">{WHY_AGENTS}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#agents" className="btn-kaspa rounded-lg px-5 py-2.5 font-orbitron text-[12.5px] font-bold uppercase tracking-wide text-[#04121a]">Agents start here →</a>
            <a href="#browse" className="rounded-lg border border-teal-400/40 px-5 py-2.5 font-mono text-[12.5px] text-teal-400 hover:bg-teal-400/10">Browse services</a>
            <a href="/validate" className="rounded-lg border border-teal-400/40 px-5 py-2.5 font-mono text-[12.5px] text-teal-400 hover:bg-teal-400/10">Validate your service</a>
            <a href="/private" className="rounded-lg border border-violet-400/40 px-5 py-2.5 font-mono text-[12.5px] text-violet-300 hover:bg-violet-400/10">Pay privately →</a>
          </div>
        </section>

        <section className="mt-12 grid gap-4 rounded-2xl border border-gray-800 bg-gray-950/40 p-6 sm:grid-cols-3">
          <div><div className="font-mono text-[11px] uppercase tracking-wider text-gray-500">1 · the agent calls</div><p className="mt-1.5 text-[13.5px] text-gray-300">It requests a resource. The service answers <span className="font-mono">402</span> with a <span className="font-mono">PAYMENT-REQUIRED</span> header naming the price, the network and where to pay.</p></div>
          <div><div className="font-mono text-[11px] uppercase tracking-wider text-gray-500">2 · the agent pays</div><p className="mt-1.5 text-[13.5px] text-gray-300">In KAS (<span className="font-mono">@kaspa-x402/client</span>) or in kUSD (<span className="font-mono">k402</span>), on Kaspa L1, inside the spend limits its operator set. It retries with <span className="font-mono">PAYMENT-SIGNATURE</span>.</p></div>
          <div><div className="font-mono text-[11px] uppercase tracking-wider text-gray-500">3 · the chain settles</div><p className="mt-1.5 text-[13.5px] text-gray-300">Value moved on Kaspa L1; the agent gets the result and can verify the settlement against a node. No middleman held the funds.</p></div>
        </section>

        <section id="layers" className="mt-14 scroll-mt-20">
          <h2 className="font-orbitron text-[22px] font-bold uppercase tracking-tight">Three layers, one product</h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-gray-400">{CLAIM} This site is the rails.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {LAYERS.map((l) => (
              <a key={l.key} href={l.url} className={`glass card-hover flex flex-col gap-2 rounded-2xl border p-5 ${l.key === 'rails' ? 'border-teal-400/40' : 'border-gray-800'}`}>
                <div className="font-mono text-[11px] uppercase tracking-wider text-gray-500">{l.role}{l.key === 'rails' ? ' · you are here' : ''}</div>
                <div className="font-orbitron text-[15px] font-bold text-gray-100">{l.name}</div>
                <p className="text-[13px] leading-relaxed text-gray-400">{l.what}</p>
                <span className="mt-auto font-mono text-[11.5px] text-teal-400">{l.url.replace('https://', '')} →</span>
              </a>
            ))}
          </div>
        </section>

        <section id="browse" className="mt-14 scroll-mt-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-orbitron text-[22px] font-bold uppercase tracking-tight">Services agents pay</h2>
              <p className="mt-1 font-mono text-[11.5px] text-gray-500">each listing answered a live, unpaid 402 probe before it appeared — an agent can repeat that check itself</p>
            </div>
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
            Ship an x402 v2 endpoint with <a href="https://www.npmjs.com/package/@kaspa-x402/server" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline">@kaspa-x402/server</a>, then submit it here.
            It only appears once it has answered a live, unpaid 402 probe: that gate is the anti-spam rule, and any agent can repeat the same check before paying.
            To sell for kUSD, list on the {MARKET_NAME} instead — a listing there is signed by your payee key and costs 10¢ of kUSD through k402 (<a href={LINKS.k402Protocol} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline">how</a>).
          </p>
          <div className="mt-5"><SubmitForm onAdded={load} /></div>
        </section>

        <section id="agents" className="mt-16 scroll-mt-20">
          <h2 className="font-orbitron text-[22px] font-bold uppercase tracking-tight">Agents start here</h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-gray-400">From nothing to a paid call, then to selling. The machine copy of this page is <a href="/llms.txt" className="text-teal-400 hover:underline">/llms.txt</a>.</p>
          <ol className="mt-5 grid gap-4 sm:grid-cols-2">
            <li className="rounded-2xl border border-gray-800 bg-gray-950/40 p-5"><div className="font-mono text-[11px] uppercase tracking-wider text-gray-500">1 · get funds</div>
              <p className="mt-1.5 text-[13.5px] text-gray-300">A Kaspa key is the only account. On testnet-10, TKAS comes from the <a href={LINKS.faucet} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline">faucet</a>; kUSD is bought from the kUSD PSM in the <a href={LINKS.kusdApp} className="text-teal-400 hover:underline">kUSD app</a> or by <span className="font-mono">kusd_pay buy</span>.</p></li>
            <li className="rounded-2xl border border-gray-800 bg-gray-950/40 p-5"><div className="font-mono text-[11px] uppercase tracking-wider text-gray-500">2 · read the 402</div>
              <p className="mt-1.5 text-[13.5px] text-gray-300">Call the resource unpaid. The <span className="font-mono">PAYMENT-REQUIRED</span> header is base64 JSON: <span className="font-mono">accepts[]</span> lists each way to pay — scheme, network, amount, <span className="font-mono">payTo</span>. Pick one you can pay.</p></li>
            <li className="rounded-2xl border border-gray-800 bg-gray-950/40 p-5"><div className="font-mono text-[11px] uppercase tracking-wider text-gray-500">3 · pay, in KAS or kUSD</div>
              <p className="mt-1.5 text-[13.5px] text-gray-300">KAS: <span className="font-mono">@kaspa-x402/client</span> (<span className="font-mono">exact</span>, <span className="font-mono">batch-settlement</span>). kUSD: the k402 Python client (<span className="font-mono">pip install k402</span>, <span className="font-mono">KusdPayer</span>) or the <a href={LINKS.k402Mcp} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline">k402-mcp</a> tool <span className="font-mono">pay_kusd</span>, under a <a href={LINKS.spendPolicy} target="_blank" rel="noopener noreferrer" className="font-mono text-teal-400 hover:underline">SpendPolicy</a> your operator wrote. The kUSD requirement is x402 <span className="font-mono">exact</span> with the kUSD authority covenant as <span className="font-mono">asset</span>, cents as <span className="font-mono">amount</span> and the binding <span className="font-mono">kusd-holder-v1</span> (<a href={LINKS.kusdScheme} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline">spec</a>). Retry with <span className="font-mono">PAYMENT-SIGNATURE</span>.</p></li>
            <li className="rounded-2xl border border-gray-800 bg-gray-950/40 p-5"><div className="font-mono text-[11px] uppercase tracking-wider text-gray-500">4 · verify on a node</div>
              <p className="mt-1.5 text-[13.5px] text-gray-300">A KAS payment is a transaction to <span className="font-mono">payTo</span>. A kUSD payment is a covenant box of exactly the quoted cents at the offer&apos;s key, carrying the family&apos;s covenant id — a node proves it, not a receipt. The market publishes node-verified settlements at <span className="font-mono">{LINKS.registry.replace('https://', '')}/registry/activity</span> (every endpoint in its <a href={LINKS.openapi} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline">OpenAPI</a>).</p></li>
            <li className="rounded-2xl border border-gray-800 bg-gray-950/40 p-5 sm:col-span-2"><div className="font-mono text-[11px] uppercase tracking-wider text-gray-500">5 · sell</div>
              <p className="mt-1.5 text-[13.5px] text-gray-300">Answer 402 yourself: <span className="font-mono">@kaspa-x402/server</span> for KAS, <span className="font-mono">k402</span> (<span className="font-mono">K402(kusd=…)</span>) for kUSD. Submit the KAS endpoint above; list the kUSD one on <a href={LAYERS[2].url} className="text-teal-400 hover:underline">{MARKET_NAME}</a>, where <a href={LINKS.reputation} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline">reputation</a> is the kUSD a node has seen you settle, not a rating anyone can type.</p></li>
          </ol>
        </section>

        <section id="covenants" className="mt-16 scroll-mt-20">
          <h2 className="font-orbitron text-[22px] font-bold uppercase tracking-tight">How covenants back this</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-800 bg-gray-950/40 p-5">
              <div className="font-mono text-[11px] uppercase tracking-wider text-teal-400">today · kUSD settlement</div>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-gray-300">
                kUSD is not an IOU on an account: each unit is state inside a Kaspa L1 covenant, minted against KAS in vaults, redeemable at a permissionless reserve, priced by a five-operator oracle — rules the chain enforces, with no bridge, no L2 and no trusted issuer.
                A kUSD payment is therefore a covenant output a node can check: exact cents, the right family, the offer&apos;s own key. That is what makes the market&apos;s reputation settlement-verified. <a href={LAYERS[0].repo} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline">kUSD repo ↗</a> · <a href={LAYERS[0].url} className="text-teal-400 hover:underline">verify the money</a>
              </p>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-950/40 p-5">
              <div className="font-mono text-[11px] uppercase tracking-wider text-sky-300">roadmap · KCC-0402 payment channels</div>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-gray-300">
                For streaming and sub-cent micro-settlement, k402 defines covenant payment channels: an agent locks KAS in an L1 covenant and pays per call with signed vouchers; the provider can claim at most what was signed, and the agent reclaims the rest. The channel covenant and its tooling are in the <a href={LAYERS[1].repo} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline">k402 repo ↗</a>; the KCC-0402 convention draft is the standard track.
              </p>
            </div>
          </div>
          <p className="mt-3 font-mono text-[11.5px] text-gray-600">{DISCLAIMERS.operators}</p>
        </section>

        <section className="mt-16">
          <h2 className="mb-4 font-mono text-[12.5px] uppercase tracking-[0.18em] text-gray-400">Pay from an agent</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-gray-950/40 p-5 font-mono text-[12.5px] leading-relaxed text-gray-300">
              <div className="text-gray-500"># KAS · kx402 (wraps @kaspa-x402/client&apos;s DirectModeClient); tested on testnet-10 — <a href="https://github.com/Kali123411/kaspa-402/blob/main/examples/agent-quickstart.mjs" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline">full example</a></div>
              <div>npm i kx402 &amp;&amp; npx kx402 fetch-sdk</div>
              <div className="text-gray-500"># env: KASPA_X402_KASPA_WASM_MODULE=…/nodejs/kaspa/kaspa.js  KASPA_X402_FUNDING_WALLET=wallet-key:…/agent.key</div>
              <div className="mt-3"><span className="text-teal-400">import</span> {'{ openWallet, payExact, resolveWalletConfig, applyInput }'} <span className="text-teal-400">from</span> <span className="text-gray-200">'kx402'</span>;</div>
              <div><span className="text-teal-400">const</span> wallet = <span className="text-teal-400">await</span> openWallet(resolveWalletConfig({'{'} network: <span className="text-gray-200">'kaspa:testnet-10'</span> {'}'}));</div>
              <div><span className="text-teal-400">const</span> url = applyInput(<span className="text-gray-200">'https://kaspa-402-summarize.kaspadev.workers.dev/exact'</span>, {'{'} text {'}'});</div>
              <div><span className="text-teal-400">const</span> r = <span className="text-teal-400">await</span> payExact(wallet, url, {'{'} maxAmountSompi: 300_000_000n {'}'});  <span className="text-gray-500">{'// 402 → pay → retry; never over 3 KAS'}</span></div>
              <div>r.status, r.body, r.settlement.transaction   <span className="text-gray-500">{'// the result and the txid to verify on a node'}</span></div>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-gray-950/40 p-5 font-mono text-[12.5px] leading-relaxed text-gray-300">
              <div className="text-gray-500"># kUSD · the k402 client, under an operator policy (testnet-10)</div>
              <div>pip install k402</div>
              <div className="mt-3"><span className="text-teal-400">from</span> k402 <span className="text-teal-400">import</span> KusdPayer, KusdWallet, SpendLedger, SpendPolicy</div>
              <div>payer = KusdPayer(wallet, registry_url=<span className="text-gray-200">&quot;https://market.kaspa-402.org&quot;</span>, network=<span className="text-gray-200">&quot;testnet-10&quot;</span>,</div>
              <div className="pl-6">policy=SpendPolicy.load(<span className="text-gray-200">&quot;policy.json&quot;</span>), ledger=SpendLedger(<span className="text-gray-200">&quot;spend.db&quot;</span>))</div>
              <div>route = <span className="text-teal-400">await</span> payer.pay_best(<span className="text-gray-200">&quot;summarize&quot;</span>, json_body={'{'}<span className="text-gray-200">&quot;text&quot;</span>: …{'}'})</div>
              <div className="text-gray-500"># or, from any MCP client: k402-mcp → pay_kusd(&quot;summarize&quot;, {'{…}'})</div>
            </div>
          </div>
        </section>

        <footer className="mt-16 border-t border-gray-800 pt-6 font-mono text-[12px] text-gray-500">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a href="/llms.txt" className="hover:text-teal-400">/llms.txt</a>
            <a href="/llms.json" className="hover:text-teal-400">/llms.json</a>
            <a href="/validate" className="hover:text-teal-400">validate</a>
            <a href={LAYERS[0].url} className="hover:text-teal-400">money · kUSD</a>
            <a href={LAYERS[2].url} className="hover:text-teal-400">market</a>
            <a href="https://kaspa-x402.org" target="_blank" rel="noopener noreferrer" className="hover:text-teal-400">standard ↗</a>
            <a href={LAYERS[1].repo} target="_blank" rel="noopener noreferrer" className="hover:text-teal-400">k402 ↗</a>
            <a href="https://github.com/elldeeone/kaspa-x402" target="_blank" rel="noopener noreferrer" className="hover:text-teal-400">@kaspa-x402 SDK ↗</a>
          </div>
          <p className="mt-3 text-[11.5px] text-gray-600">kUSD and the {MARKET_NAME}: {DISCLAIMERS.research} {DISCLAIMERS.advice} Mainnet listings here settle real KAS; nothing on this site is audited.</p>
        </footer>
      </main>
    </>
  );
}
