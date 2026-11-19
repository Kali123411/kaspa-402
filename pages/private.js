// pages/private.js — demo: paying a kaspa-402 service *privately* via a Kaspa shielded pool.
// A Groth16 ZK privacy primitive on Kaspa L1 (generic — presented standalone). Testnet-10 research
// demo only: unaudited, single-party trusted setup, not for real value. All txids are real on TN10.
import Head from 'next/head';
import { useState } from 'react';
import Term from '../components/Term';
import { BUTTON, H1, H2, H3, LINK, MARK, PAGE, Section, notice } from '../components/Ledger';

const TX = 'https://api-tn10.kaspa.org/transactions/';

// The real, on-chain proof trail (kaspa:testnet-10).
const TRAIL = [
  { k: 'shield',   label: 'deposit',  desc: 'the block reward is deposited into the shielded pool as a ZK commitment', tx: 'e584f5dc1f14e565691baf976953d185b5ee3646d4f56ea9852cda4caa5b5be1' },
  { k: 'screen',   label: 'screen',   desc: 'a governance-screened proof-of-innocence admits the note to the approved set', tx: '89bd3865f98039ee2a08b426a1929ccb4888710d7e09fef21a156df7a7daf990' },
  { k: 'withdraw', label: 'withdraw', desc: 'the note is withdrawn to a FRESH address with no link back to the miner', tx: '54f733ee7daf9a702fcadc940420a3e95a5163316cc9e18b35cdda12a7ea6d05' },
  { k: 'pay',      label: 'pay',      desc: 'the fresh address pays the x402 summarize service — HTTP 200, 1.787 KAS', tx: 'ab3760ac37144d23290778eb18290a23fa42794a7bf15927a54d2150a7673982' },
];

const STEPS = [
  { n: '1', t: 'mine',     d: 'A Kaspa block reward lands at the miner’s address — ordinary, public, fully linkable.' },
  { n: '2', t: 'shield',   d: 'The reward is deposited into the shielded pool as a Groth16 commitment, joining the anonymity set.' },
  { n: '3', t: 'withdraw', d: 'After a proof-of-innocence screen, the note is withdrawn to a fresh address that shares nothing with the miner.' },
  { n: '4', t: 'pay',      d: 'That fresh address pays the x402 service. The service is paid; the payer is unlinkable to where the funds were mined.' },
];

function CopyTx({ tx }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(tx); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked */ }
  }
  return <button type="button" onClick={copy} aria-label="Copy transaction id" className={LINK}>{done ? 'copied' : 'copy'}</button>;
}

function TxRow({ label, desc, tx }) {
  return (
    <li className="grid gap-1 border-t border-gray-800 py-3 lg:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)] lg:gap-6">
      <span className="font-mono text-[12.5px] text-accent">{label}</span>
      <span className="text-[14.5px] leading-relaxed text-gray-400">{desc}</span>
      <span className="flex min-w-0 flex-col gap-1 font-mono text-[12px]">
        <a href={TX + tx} target="_blank" rel="noopener noreferrer" className={`break-all ${LINK}`}>{tx}</a>
        <span className="flex gap-3 text-gray-600"><span>TN10 API · api-tn10.kaspa.org</span><CopyTx tx={tx} /></span>
      </span>
    </li>
  );
}

export default function Private() {
  return (
    <>
      <Head>
        <title>Pay privately — k402 · shielded pool</title>
        <meta name="description" content="A demo of paying a kaspa-402 service privately: the payer settles from a Kaspa shielded pool, unlinkable to the wallet that funded it. A Groth16 ZK privacy primitive on Kaspa L1, on testnet-10." />
      </Head>
      <main className={`${PAGE} py-12 lg:py-16`}>
        <Section mark="0" top={false} note={<>Kaspa · x402 · private payments<div className="mt-2">Research demo: <span className="text-gray-300">unaudited</span> · <span className="text-gray-300">single-party trusted setup</span> (forgeable, drainable) · <span className="text-gray-300">testnet-10 only</span> · not for real value — <a href="#caveat" className={LINK}>details</a>.</div></>}>
          <h1 className={H1}>Pay a service privately</h1>
          <p className="mt-5 max-w-[62ch] text-[clamp(17px,1.25vw,20px)] leading-relaxed text-gray-300">
            An agent can pay any <a href="/" className={LINK}>kaspa-402</a> service <span className="text-gray-100">without its funding wallet being linkable to what it buys</span>.
            The payment settles from a <Term id="shielded-pool"><span className="text-gray-200">Kaspa shielded pool</span></Term> — a <Term id="groth16">Groth16</Term> ZK privacy primitive on Kaspa L1 —
            so the address that pays shares nothing with the address that funded it.
          </p>
          <p className="mt-4 max-w-[62ch] text-[16px] leading-relaxed text-gray-400">
            This is privacy for agent commerce: the <em>service</em> still gets paid on-chain, per call, with no custodian —
            but an observer can’t tie the payment back to the payer’s treasury.
          </p>
          <div className="mt-8 flex flex-wrap items-baseline gap-7 font-mono text-[14px]">
            <a href="#proof" className={BUTTON}>Try it: follow the proof trail</a>
            <a href="/get-started" className={LINK}>Pay a service yourself (not private yet)</a>
          </div>
        </Section>

        <Section id="caveat" mark="1" note="Research demo · testnet-10. The honest status." className="mt-12">
          <div className={`max-w-[70ch] ${notice}`}>
            <p className="leading-relaxed">
              The shielded pool here is <span className="text-gray-100">unaudited</span>, runs a <Term id="trusted-setup"><span className="text-gray-100">single-party trusted setup</span></Term> (so it is forgeable / drainable),
              and lives on <span className="font-mono">kaspa:testnet-10</span> only. It is a proof of concept — <span className="text-gray-100">not for real value</span>.
              A mainnet version needs an MPC trusted-setup ceremony and a ZK audit.
            </p>
            <p className="mt-2 font-mono text-[12.5px] text-gray-400"><span className="text-gray-300">Mainnet path</span> · MPC ceremony: not started · ZK audit: not scheduled · the pool stays testnet-only until both are done.</p>
          </div>
        </Section>

        <Section mark="2" note="The loop, end to end. Recorded on testnet-10: mine → shield → withdraw (fresh address) → pay." className="mt-12">
          <figure className="overflow-hidden border border-gray-800 bg-panel motion-reduce:hidden">
            <img src="/private-loop.gif" alt="Terminal recording: a Kaspa mining reward is shielded, withdrawn to a fresh unlinkable address, and used to pay an x402 service." className="w-full" />
          </figure>
          <figcaption className="mt-2 font-mono text-[12px] text-gray-600 motion-reduce:hidden">Fig. 1 — recorded on testnet-10.</figcaption>
          <details className="mt-3 border-t border-gray-800 pt-3 motion-reduce:block [&_summary]:motion-reduce:hidden" open={false}>
            <summary className={`cursor-pointer ${MARK}`}>Transcript of the recording</summary>
            <ol className="mt-3 space-y-2 font-mono text-[12.5px] leading-relaxed text-gray-300">
              {STEPS.map((st) => <li key={st.n}>{st.n}. <span className="text-accent">{st.t}</span> — {st.d}</li>)}
              {TRAIL.map((t) => <li key={t.k} className="text-gray-500">↳ {t.label}: {t.desc} · tx {t.tx}</li>)}
            </ol>
          </details>
        </Section>

        <Section mark="3" note="How it works. The only linkable moment is the deposit." className="mt-12">
          <h2 className={H2}>How it works</h2>
          <div className="mt-4 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="border-t border-gray-100 pt-4">
                <div className={MARK}>{s.n} · {s.t}</div>
                <p className="mt-2 text-[14.5px] leading-relaxed text-gray-400">{s.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 max-w-[70ch] text-[15px] leading-relaxed text-gray-400">
            After the deposit, the note is one of many in the pool. The withdrawal proves,
            in zero knowledge, that it corresponds to <em>some</em> unspent deposit in a governance-approved set, without revealing <em>which</em>.
            So the fresh payer address is indistinguishable among every note in the pool.
          </p>
        </Section>

        <Section id="proof" mark="4" note="Proof on testnet-10. Every step is a real on-chain transaction; links resolve on the testnet-10 API." className="mt-12 mb-4">
          <h2 className={H2}>Proof on testnet-10</h2>
          <ul className="m-0 mt-4 list-none p-0">
            {TRAIL.map((t) => <TxRow key={t.k} {...t} />)}
          </ul>
          <p className="mt-3 font-mono text-[12px] leading-relaxed text-gray-600">
            The payer <span className="text-gray-400">kaspatest:qz33np6wakmg…</span> was funded only by shielded-pool withdrawals —
            it has no shared history with the mining address.
          </p>
          <div className="mt-8 grid gap-10 lg:grid-cols-2">
            <div className="border-t border-gray-100 pt-4">
              <h3 className={H3}>Check it yourself</h3>
              <ol className="m-0 mt-3 list-none space-y-3 p-0 text-[14.5px] leading-relaxed text-gray-300">
                <li><span className={MARK}>Step 1</span><div>Open the <span className="text-accent">deposit</span> transaction above: its output is the shielded pool&apos;s covenant; the input is the mining address.</div></li>
                <li><span className={MARK}>Step 2</span><div>Open the <span className="text-accent">withdraw</span> transaction: its output address (the fresh payer) appears nowhere in the deposit&apos;s history — search it on the TN10 API and you find only pool withdrawals funding it.</div></li>
                <li><span className={MARK}>Step 3</span><div>Open the <span className="text-accent">pay</span> transaction: the input is that fresh address, the output is the service&apos;s payTo for 1.787 KAS — the x402 payment the service accepted with HTTP 200.</div></li>
              </ol>
            </div>
            <div className="border-t border-gray-100 pt-4 text-[14.5px] leading-relaxed text-gray-400">
              <h3 className={H3}>What the demo pays for</h3>
              <p className="mt-3">The paid service is the k402 <span className="font-mono text-gray-200">summarize</span> endpoint listed in the directory: send text, get a summary, priced in KAS per call behind an HTTP 402. Integration is unchanged for the service — it never knows the payer came from a pool. On the agent&apos;s side the only difference is <em>which wallet pays</em>: fund a fresh key from shielded-pool withdrawals, then call <span className="font-mono text-gray-200">payExact(wallet, url, …)</span> exactly as in <a href="/get-started" className={LINK}>the setup guide</a>.</p>
            </div>
          </div>
        </Section>
      </main>
    </>
  );
}
