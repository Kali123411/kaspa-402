// pages/skill/[cap].js — the human page for a capability. Shows what it does, how to pay via x402 v2,
// and which listed services offer it (from the registry). The machine twin is /skill/<cap>.md.
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { capInfo, categoryOf } from '../../lib/catalog';

const SOMPI = 1e8;
const kas = (s) => { const n = Number(s) / SOMPI; return isFinite(n) ? parseFloat(n.toFixed(8)) : null; };

export default function Skill() {
  const router = useRouter();
  const cap = String(router.query.cap || '').replace(/\.md$/, '');
  const [services, setServices] = useState([]);
  useEffect(() => {
    if (!cap) return;
    fetch('/api/registry/list').then((r) => r.json())
      .then((d) => setServices((d.listings || []).filter((l) => (l.capability || '') === cap).sort((a, b) => Number(a.amount_sompi) - Number(b.amount_sompi))))
      .catch(() => {});
  }, [cap]);
  const info = capInfo(cap);

  return (
    <>
      <Head><title>{cap} — Kaspa x402 skill</title></Head>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <a href="/" className="font-mono text-[12.5px] text-gray-500 hover:text-teal-400">← marketplace</a>
        <h1 className="mt-4 font-orbitron text-3xl font-bold tracking-tight text-gray-100">{cap}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-gray-300">{info.what}</p>
        <div className="mt-2 font-mono text-[12px] text-gray-500">{categoryOf(cap)} · settled on Kaspa L1 via x402 v2</div>

        {info.send ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div><div className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-gray-500">Input</div>
              <pre className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-950/40 p-4 font-mono text-[12px] text-gray-300">{info.send}</pre></div>
            <div><div className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-gray-500">Output</div>
              <pre className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-950/40 p-4 font-mono text-[12px] text-gray-300">{info.get}</pre></div>
          </div>
        ) : null}

        <h2 className="mt-10 font-orbitron text-[18px] font-bold uppercase tracking-tight">How to call (x402 v2)</h2>
        <pre className="mt-3 overflow-x-auto rounded-xl border border-gray-800 bg-gray-950/40 p-4 font-mono text-[12.5px] text-gray-300">{`npm i @kaspa-x402/client\n\nimport { DirectModeClient } from '@kaspa-x402/client';\n// configure with your Kaspa funding provider + signer, then:\nconst r = await client.paidFetch(${services[0] ? JSON.stringify(services[0].resource) : "'<service resource url>'"});`}</pre>

        <h2 className="mt-10 font-orbitron text-[18px] font-bold uppercase tracking-tight">Services ({services.length})</h2>
        <div className="mt-4 flex flex-col gap-3">
          {services.map((l) => (
            <a key={l.id || l.resource} href={l.resource} target="_blank" rel="noopener noreferrer"
              className="glass card-hover flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-400/15 p-4">
              <div><div className="font-orbitron text-[14px] font-bold text-gray-100">{l.serviceName}</div>
                <div className="font-mono text-[11.5px] text-gray-500">{l.resource}</div></div>
              <div className="font-mono text-[12px] text-gray-400">{l.scheme} · {l.network} · {l.amount_sompi} sompi ({kas(l.amount_sompi)} KAS)</div>
            </a>
          ))}
          {services.length === 0 ? <p className="font-mono text-[13px] text-gray-500">No services listed for this capability yet.</p> : null}
        </div>

        <p className="mt-10 border-t border-gray-800 pt-5 font-mono text-[12px] text-gray-500">
          <a href={`/skill/${encodeURIComponent(cap)}.md`} className="hover:text-teal-400">SKILL.md ↗</a> ·
          <a href="/llms.txt" className="hover:text-teal-400"> /llms.txt</a> ·
          <a href="https://kaspa-x402.org" target="_blank" rel="noopener noreferrer" className="hover:text-teal-400"> standard ↗</a>
        </p>
      </main>
    </>
  );
}
