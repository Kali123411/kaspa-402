// pages/private.js — demo: paying a kaspa-402 service *privately* via a Kaspa shielded pool.
// A Groth16 ZK privacy primitive on Kaspa L1 (generic — presented standalone). Testnet-10 research
// demo only: unaudited, single-party trusted setup, not for real value. All txids are real on TN10.
import Head from 'next/head';
import { useState } from 'react';
import Term from '../components/Term';

const TX = 'https://api-tn10.kaspa.org/transactions/';
const short = (h) => h.slice(0, 10) + '…' + h.slice(-6);

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

function StepCard({ n, t, d }) {
  return (
    <div className="glass rounded-2xl border border-violet-400/15 p-5">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-violet-300/70">{n} ·</span>
        <span className="font-orbitron text-[14px] font-bold uppercase tracking-tight text-gray-100">{t}</span>
      </div>
      <p className="mt-2 text-[13.5px] leading-relaxed text-gray-400">{d}</p>
    </div>
  );
}

function CopyTx({ tx }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(tx); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked */ }
  }
  return <button type="button" onClick={copy} aria-label="Copy transaction id" className="hover:text-teal-400">{done ? 'copied' : 'copy'}</button>;
}

function TxRow({ label, desc, tx }) {
  return (
    <li className="flex flex-col gap-1 border-b border-gray-800 py-3 last:border-0 sm:flex-row sm:items-center sm:gap-4">
      <span className="w-20 shrink-0 rounded border border-violet-400/30 bg-violet-400/5 px-2 py-0.5 text-center font-mono text-[11px] uppercase tracking-wider text-violet-300">{label}</span>
      <span className="flex-1 text-[13px] leading-relaxed text-gray-400">{desc}</span>
      <span className="flex min-w-0 flex-col gap-1 font-mono text-[11.5px] sm:w-[22rem]">
        <a href={TX + tx} target="_blank" rel="noopener noreferrer" className="break-all text-teal-400 hover:underline">{tx}</a>
        <span className="flex gap-3 text-gray-600"><span>TN10 API ↗ api-tn10.kaspa.org</span><CopyTx tx={tx} /></span>
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
      <main className="mx-auto max-w-5xl px-6 py-12">
        <section className="max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-violet-300">Kaspa · x402 · private payments</p>
          <h1 className="mt-4 font-orbitron text-4xl font-bold uppercase leading-tight tracking-tight sm:text-5xl">Pay a service privately</h1>
          <p className="mt-5 text-[16px] leading-relaxed text-gray-300">
            An agent can pay any <a href="/" className="text-teal-400 hover:underline">kaspa-402</a> service <span className="text-violet-300">without its funding wallet being linkable to what it buys</span>.
            The payment settles from a <Term id="shielded-pool"><span className="text-gray-200">Kaspa shielded pool</span></Term> — a <Term id="groth16">Groth16</Term> ZK privacy primitive on Kaspa L1 —
            so the address that pays shares nothing with the address that funded it.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-gray-400">
            This is privacy for agent commerce: the <em>service</em> still gets paid on-chain, per call, with no custodian —
            but an observer can’t tie the payment back to the payer’s treasury.
          </p>
          <p className="mt-3 font-mono text-[12px] text-amber-200/90">
            Research demo: <span className="font-semibold">unaudited</span> · <span className="font-semibold">single-party trusted setup</span> (forgeable, drainable) · <span className="font-semibold">testnet-10 only</span> · not for real value — <a href="#caveat" className="underline hover:text-amber-100">details</a>.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a href="#proof" className="btn-kaspa rounded-lg px-5 py-2.5 font-orbitron text-[12.5px] font-bold uppercase tracking-wide text-[#04121a]">Try it: follow the proof trail →</a>
            <a href="/get-started" className="rounded-lg border border-gray-700 px-5 py-2.5 font-mono text-[12.5px] text-gray-300 hover:border-violet-400/40 hover:text-violet-300">Pay a service yourself (not private yet)</a>
          </div>
        </section>

        <div id="caveat" className="mt-8 scroll-mt-20 rounded-xl border border-amber-400/30 bg-amber-400/5 px-5 py-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-amber-300">Research demo · testnet-10</p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-amber-100/80">
            The shielded pool here is <span className="font-semibold">unaudited</span>, runs a <Term id="trusted-setup"><span className="font-semibold">single-party trusted setup</span></Term> (so it is forgeable / drainable),
            and lives on <span className="font-mono">kaspa:testnet-10</span> only. It is a proof of concept — <span className="font-semibold">not for real value</span>.
            A mainnet version needs an MPC trusted-setup ceremony and a ZK audit.
          </p>
          <p className="mt-2 font-mono text-[12px] text-amber-100/70"><span className="uppercase tracking-wider">Mainnet path</span> · MPC ceremony: not started · ZK audit: not scheduled · the pool stays testnet-only until both are done.</p>
        </div>

        <section className="mt-12">
          <h2 className="mb-4 font-mono text-[12.5px] uppercase tracking-[0.18em] text-gray-400">The loop, end to end</h2>
          <figure className="overflow-hidden rounded-2xl border border-gray-800 bg-[#0e1420] motion-reduce:hidden">
            <img src="/private-loop.gif" alt="Terminal recording: a Kaspa mining reward is shielded, withdrawn to a fresh unlinkable address, and used to pay an x402 service." className="w-full" />
          </figure>
          <figcaption className="mt-2 font-mono text-[11px] text-gray-600 motion-reduce:hidden">Recorded on testnet-10. mine → shield → withdraw (fresh address) → pay.</figcaption>
          <details className="mt-3 rounded-2xl border border-gray-800 bg-gray-950/40 px-5 py-4 motion-reduce:block [&_summary]:motion-reduce:hidden" open={false}>
            <summary className="cursor-pointer font-mono text-[12px] uppercase tracking-wider text-gray-400">Transcript of the recording</summary>
            <ol className="mt-3 space-y-2 font-mono text-[12.5px] leading-relaxed text-gray-300">
              {STEPS.map((st) => <li key={st.n}>{st.n}. <span className="text-violet-300">{st.t}</span> — {st.d}</li>)}
              {TRAIL.map((t) => <li key={t.k} className="text-gray-500">↳ {t.label}: {t.desc} · tx {t.tx}</li>)}
            </ol>
          </details>
        </section>

        <section className="mt-14">
          <h2 className="font-orbitron text-[22px] font-bold uppercase tracking-tight">How it works</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => <StepCard key={s.n} {...s} />)}
          </div>
          <p className="mt-6 max-w-3xl text-[14px] leading-relaxed text-gray-400">
            The only linkable moment is the deposit — after that, the note is one of many in the pool. The withdrawal proves,
            in zero knowledge, that it corresponds to <em>some</em> unspent deposit in a governance-approved set, without revealing <em>which</em>.
            So the fresh payer address is indistinguishable among every note in the pool.
          </p>
        </section>

        <section id="proof" className="mt-14 scroll-mt-20">
          <div className="flex flex-wrap items-baseline gap-3 border-b border-violet-400/20 pb-2">
            <h2 className="font-orbitron text-[15px] font-bold uppercase tracking-tight text-violet-300">Proof on testnet-10</h2>
            <span className="font-mono text-[11.5px] text-gray-500">every step is a real on-chain transaction</span>
          </div>
          <ul className="mt-4 rounded-2xl border border-gray-800 bg-gray-950/40 px-5 py-2">
            {TRAIL.map((t) => <TxRow key={t.k} {...t} />)}
          </ul>
          <p className="mt-3 font-mono text-[11.5px] leading-relaxed text-gray-600">
            The payer <span className="text-gray-400">kaspatest:qz33np6wakmg…</span> was funded only by shielded-pool withdrawals —
            it has no shared history with the mining address. Links resolve on the testnet-10 API.
          </p>
          <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-950/40 p-5">
            <div className="font-mono text-[11px] uppercase tracking-wider text-gray-500">Check it yourself</div>
            <ol className="mt-3 space-y-2 text-[13.5px] leading-relaxed text-gray-300">
              <li><span className="font-mono text-xs uppercase tracking-wider text-gray-500">Step 1</span> · Open the <span className="text-violet-300">deposit</span> transaction above: its output is the shielded pool&apos;s covenant; the input is the mining address.</li>
              <li><span className="font-mono text-xs uppercase tracking-wider text-gray-500">Step 2</span> · Open the <span className="text-violet-300">withdraw</span> transaction: its output address (the fresh payer) appears nowhere in the deposit&apos;s history — search it on the TN10 API and you find only pool withdrawals funding it.</li>
              <li><span className="font-mono text-xs uppercase tracking-wider text-gray-500">Step 3</span> · Open the <span className="text-violet-300">pay</span> transaction: the input is that fresh address, the output is the service&apos;s payTo for 1.787 KAS — the x402 payment the service accepted with HTTP 200.</li>
            </ol>
          </div>
          <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-950/40 p-5 text-[13.5px] leading-relaxed text-gray-400">
            <div className="font-mono text-[11px] uppercase tracking-wider text-gray-500">What the demo pays for</div>
            <p className="mt-2">The paid service is the k402 <span className="font-mono text-gray-200">summarize</span> endpoint listed in the directory: send text, get a summary, priced in KAS per call behind an HTTP 402. Integration is unchanged for the service — it never knows the payer came from a pool. On the agent&apos;s side the only difference is <em>which wallet pays</em>: fund a fresh key from shielded-pool withdrawals, then call <span className="font-mono text-gray-200">payExact(wallet, url, …)</span> exactly as in <a href="/get-started" className="text-teal-400 hover:underline">the setup guide</a>.</p>
          </div>
        </section>

      </main>
    </>
  );
}
