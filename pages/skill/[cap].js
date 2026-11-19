// pages/skill/[cap].js — the human page for a capability. Shows what it does, how to pay via x402 v2,
// and which listed services offer it (from the registry). The machine twin is /skill/<cap>.md.
import Head from 'next/head';
import { EXTERNAL } from '../../lib/brand.mjs';
import ExternalLink from '../../components/ExternalLink';
import { useEffect, useState } from 'react';
import { capInfo, categoryOf } from '../../lib/catalog';
import { H1, H2, LINK, MARK, PAGE, Section } from '../../components/Ledger';

const SOMPI = 1e8;
const kas = (s) => { const n = Number(s) / SOMPI; return isFinite(n) ? parseFloat(n.toFixed(8)) : null; };
const priceLabel = (l) => { const u = Number(l.priceUsd); return u > 0 ? `$${u.toFixed(2)}/call · in KAS at spot (min ${kas(l.amountSompi)} KAS)` : `${l.amountSompi} sompi · ${kas(l.amountSompi)} KAS`; };

export default function Skill({ cap }) {
  const [services, setServices] = useState([]);
  useEffect(() => {
    if (!cap) return;
    fetch('/api/registry/list').then((r) => r.json())
      .then((d) => setServices((d.listings || []).filter((l) => (l.capability || '') === cap).sort((a, b) => Number(a.amountSompi) - Number(b.amountSompi))))
      .catch(() => {});
  }, [cap]);
  const info = capInfo(cap);

  return (
    <>
      <Head>
        <title>{cap} — k402 skill</title>
        <meta name="description" content={`${cap} on k402: ${info.what || 'a capability agents pay for per call over x402 v2 on Kaspa'} Listed services, how to call it, and what each one charges.`} />
      </Head>
      <main className={`${PAGE} py-12 lg:py-16`}>
        <Section mark="0" top={false} note={<><a href="/" className={LINK}>← the directory</a><div className="mt-2">{categoryOf(cap)} · settled on Kaspa L1 via x402 v2</div></>}>
          <h1 className={H1}>{cap}</h1>
          <p className="mt-5 max-w-[62ch] text-[16px] leading-relaxed text-gray-300">{info.what}</p>
          {info.send ? (
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div><div className={`mb-1.5 ${MARK}`}>input</div>
                <pre className="overflow-x-auto border border-gray-800 bg-panel p-4 font-mono text-[12px] text-gray-300">{info.send}</pre></div>
              <div><div className={`mb-1.5 ${MARK}`}>output</div>
                <pre className="overflow-x-auto border border-gray-800 bg-panel p-4 font-mono text-[12px] text-gray-300">{info.get}</pre></div>
            </div>
          ) : null}
        </Section>

        <Section mark="1" note="How to call it. x402 v2: the first request answers 402, the client pays and retries." className="mt-12">
          <h2 className={H2}>How to call (x402 v2)</h2>
          <pre className="mt-4 overflow-x-auto border border-gray-800 bg-panel p-4 font-mono text-[12.5px] text-gray-300">{`npm i kx402 && npx kx402 fetch-sdk   # wraps @kaspa-x402/client's DirectModeClient\n# env: KASPA_X402_KASPA_WASM_MODULE=…/nodejs/kaspa/kaspa.js  KASPA_X402_FUNDING_WALLET=wallet-key:…/agent.key\n\nimport { openWallet, payExact, resolveWalletConfig } from 'kx402';\nconst wallet = await openWallet(resolveWalletConfig({ network: 'kaspa:testnet-10' }));\nconst r = await payExact(wallet, ${services[0] ? JSON.stringify(services[0].resource) : "'<service resource url>'"}, { maxAmountSompi: 300_000_000n });\n// r.status, r.body, r.settlement.transaction — full example: github.com/Kali123411/kaspa-402/examples`}</pre>
        </Section>

        <Section mark="2" note="Listed services offering this capability, cheapest first. Each line is one unpaid 402 probe away from proof." className="mt-12 mb-4">
          <h2 className={H2}>Services ({services.length})</h2>
          <div className="mt-4 min-h-[6rem]">
          <ul className="m-0 list-none p-0">
            {services.map((l) => (
              <li key={l.id || l.resource} className="grid gap-1 border-t border-gray-800 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6">
                <div><div className="font-orbitron text-[17px] text-gray-100">{l.serviceName}</div>
                  <a href={l.resource} target="_blank" rel="noopener noreferrer" className={`break-all font-mono text-[12px] text-gray-500 ${LINK}`}>{l.resource}</a></div>
                <div className="font-mono text-[12.5px] text-gray-400 lg:text-right">{l.scheme} · {l.network} · {priceLabel(l)}</div>
              </li>
            ))}
          </ul>
          {services.length === 0 ? <p className="mt-3 font-mono text-[13px] text-gray-500">No services listed for this capability yet.</p> : null}
          </div>
          <p className="mt-10 border-t border-gray-800 pt-5 font-mono text-[12.5px] text-gray-500">
            <a href={`/skill/${encodeURIComponent(cap)}.md`} className={LINK}>SKILL.md</a> ·
            <a href="/llms.txt" className={LINK}> /llms.txt</a> ·
            {' '}<ExternalLink href={EXTERNAL.standard}>standard</ExternalLink>
          </p>
        </Section>
      </main>
    </>
  );
}

/** the capability comes from the URL on the server, so the page renders whole (no shift, and the description is in the HTML) */
export async function getServerSideProps({ params }) {
  return { props: { cap: String(params.cap || '').replace(/\.md$/, '') } };
}
