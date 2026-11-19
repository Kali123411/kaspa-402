// pages/index.js — kaspa-402.org, the rails of the agent-native marketplace on Kaspa L1 (k402, Kaspa x402 v2).
// Agents are the audience; humans run the services and supervise the agents. Reads the merged registry
// (curated seed + approved submissions) from /api/registry/list. The story, names and disclaimers come from lib/story.js
// (shared with /llms.txt and /llms.json). Layout and type: docs/uiux/2026-11-18-identity-design.md ("the live wire").
import Head from 'next/head';
import Term from '../components/Term';
import { useEffect, useMemo, useState } from 'react';
import { CLAIM, DISCLAIMERS, LAYERS, LINKS, MARKET_NAME, WHY_AGENTS } from '../lib/story';
import { EXTERNAL } from '../lib/brand.mjs';
import ExternalLink from '../components/ExternalLink';
import StatStrip from '../components/StatStrip';
import ProbeDemo from '../components/ProbeDemo';
import LiveTicker from '../components/LiveTicker';
import RoundTrip from '../components/RoundTrip';
import CodeBlock from '../components/CodeBlock';
import CodeTabs from '../components/CodeTabs';
import LayersDiagram from '../components/LayersDiagram';
import { SAMPLES, STEP_COMMANDS, LLMS_CURL } from '../lib/samples.mjs';

const SOMPI = 1e8;
const kas = (s) => { const n = Number(s) / SOMPI; return isFinite(n) ? parseFloat(n.toFixed(8)) : null; };
// USD-pegged services settle in KAS at the live rate (amountSompi is the dust floor); fixed services show KAS.
const priceLabel = (l) => { const u = Number(l.priceUsd); return u > 0 ? `$${u.toFixed(2)}/call · in KAS at spot (min ${kas(l.amountSompi)} KAS)` : `${kas(l.amountSompi)} KAS`; };
const short = (s) => (s && s.length > 34 ? s.slice(0, 16) + '…' + s.slice(-8) : s);
// "last verified 12m ago" from a unix-seconds or ISO timestamp
const agoText = (t) => {
  const ms = typeof t === 'number' ? t * 1000 : Date.parse(t);
  if (!Number.isFinite(ms)) return null;
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : s < 172800 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`;
};
const stamp = (l) => { const t = l.listedAt || l.probedAt; return typeof t === 'number' ? t * 1000 : Date.parse(t) || 0; };

// the ledger's vocabulary: section marks in the margin, hairline rules, underlined text links, one filled button per view
const MARK = 'font-mono text-[12px] leading-relaxed text-gray-500';
const H2 = 'font-orbitron text-[clamp(26px,2.2vw,34px)] font-medium leading-tight tracking-[-0.02em] text-gray-100';
const H3 = 'font-orbitron text-[clamp(20px,1.6vw,24px)] font-medium tracking-[-0.02em] text-gray-100';
const LINK = 'underline decoration-gray-700 underline-offset-4 hover:text-accent hover:decoration-accent';
const FIELD = 'border border-gray-800 bg-panel px-3 py-2 font-mono text-[13px] text-gray-100 outline-none placeholder:text-gray-600 focus:border-accent';
/** a numbered section: § mark + side note in the margin column, content beside it; one column on phones */
const Section = ({ id, mark, note, children, className = '' }) => (
  <section id={id} className={`grid gap-6 border-t border-gray-100 pt-6 scroll-mt-20 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-10 ${className}`}>
    <div className={MARK}><div>§ {mark}</div>{note ? <div className="mt-1 text-gray-600">{note}</div> : null}</div>
    <div className="min-w-0">{children}</div>
  </section>
);

function CopyUrl({ l }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(l.resource); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked */ }
  }
  return (
    <button type="button" onClick={copy} aria-label="Copy URL" title="Copy the resource URL" className={`font-mono text-[11.5px] text-gray-500 ${LINK}`}>
      {done ? 'copied' : 'copy URL'}
    </button>
  );
}

/** one directory row: name and description, then the facts in mono; no card, a rule */
function ServiceCard({ l }) {
  const isBase = l.kind === 'base';
  const baseUsd = isBase && l.base ? `$${Number(l.base.usd).toFixed(Number(l.base.usd) < 0.01 ? 3 : 2)}` : null;
  const status = isBase ? 'via router' : l.verified ? '402 probe passed' : 'submitted · probe pending';
  return (
    <article className="grid gap-3 border-t border-gray-800 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
      <div className="min-w-0">
        <h3 className={H3}>{l.serviceName}</h3>
        {l.description ? <p className="mt-1.5 text-[15px] leading-relaxed text-gray-300">{l.description}</p> : null}
        {(l.tags || []).length ? <div className="mt-2 font-mono text-[11.5px] text-gray-600">{(l.tags || []).join(' · ')}</div> : null}
      </div>
      <dl className="m-0 grid grid-cols-[96px_minmax(0,1fr)] gap-x-4 gap-y-1 font-mono text-[12.5px] text-gray-300 tabular-nums">
        <dt className="text-gray-500">status</dt><dd className={`m-0 ${l.verified || isBase ? 'text-accent' : 'text-gray-400'}`}>{status}{l.verified && l.probedAt && agoText(l.probedAt) ? <span className="text-gray-500"> · last verified {agoText(l.probedAt)}</span> : null}</dd>
        <dt className="text-gray-500">network</dt><dd className="m-0">{l.network}{isBase && l.base ? <span className="text-gray-500"> · settles on {l.base.host} ({l.base.network})</span> : null}</dd>
        <dt className="text-gray-500">price</dt><dd className="m-0" title={`${l.amountSompi} sompi`}>{priceLabel(l)}{isBase ? <span className="text-gray-500"> → {baseUsd} on Base</span> : null}<span className="text-gray-500"> · {l.scheme}</span></dd>
        <dt className="text-gray-500">resource</dt><dd className="m-0 flex min-w-0 items-baseline gap-3"><a href={l.resource} target="_blank" rel="noopener noreferrer" className={`truncate ${LINK}`}>{l.resource}</a><CopyUrl l={l} /></dd>
        {!isBase && l.payTo ? <><dt className="text-gray-500">payTo</dt><dd className="m-0 truncate text-gray-400">{short(l.payTo)}</dd></> : null}
        <dt className="text-gray-500">check</dt><dd className="m-0"><a href={`/validate?u=${encodeURIComponent(l.resource)}`} className={LINK}>verify it yourself</a></dd>
      </dl>
    </article>
  );
}

export default function Marketplace() {
  const [listings, setListings] = useState([]);
  const [q, setQ] = useState('');
  const [net, setNet] = useState('all');
  const [sort, setSort] = useState('recent');
  const [loading, setLoading] = useState(true);

  const load = () => fetch('/api/registry/list').then((r) => r.json()).then((d) => setListings(d.listings || [])).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = listings.filter((l) => {
      if (net !== 'all' && l.network !== net) return false;
      if (!needle) return true;
      return [l.serviceName, l.description, l.capability, l.scheme, ...(l.tags || [])].join(' ').toLowerCase().includes(needle);
    });
    return rows.sort((a, b) => (sort === 'price' ? Number(a.amountSompi) - Number(b.amountSompi) : stamp(b) - stamp(a)));
  }, [listings, q, net, sort]);

  const kaspaSvcs = useMemo(() => shown.filter((l) => l.kind !== 'base'), [shown]);
  const baseSvcs = useMemo(() => shown.filter((l) => l.kind === 'base'), [shown]);
  const description = `${CLAIM} This is the rails layer: k402 (Kaspa x402 v2), HTTP 402 pay-per-call on Kaspa L1 — no account, no API key, no custodian.`;

  return (
    <>
      <Head>
        <title>k402 — the payment rail for AI agent commerce on Kaspa L1</title>
        <meta name="description" content={description} />
        <meta property="og:title" content="k402 — Payment Required is not an error. It is the price list." />
        <meta property="og:description" content={description} />
        <meta property="og:image" content="https://www.kaspa-402.org/api/og" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://www.kaspa-402.org/api/og" />
      </Head>
      <main className="w-full">
        <LiveTicker />
        <div className="mx-auto w-full max-w-[1600px] px-6 lg:px-14">

          {/* the hero: the claim on the left, the recorded round trip replaying on the right; one column on phones */}
          <section className="grid gap-12 pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(400px,38%)] lg:items-start lg:gap-16 lg:pt-16">
            <div className="min-w-0">
              <p className="font-mono text-[12.5px] text-accent">Agents are paying agents on this rail. Watch one, on the right.</p>
              <h1 className="mt-5 font-orbitron text-[clamp(40px,4.4vw,78px)] font-medium leading-[1.02] tracking-[-0.035em] text-gray-100 [text-wrap:balance]">Every API a vending machine. Every agent a customer with a wallet.</h1>
              <p className="mt-7 max-w-[62ch] text-[clamp(17px,1.25vw,20px)] leading-relaxed text-gray-300">
                An agent asks a service for work and gets an HTTP <span className="font-mono text-gray-200">402</span> with the price inside. It pays on Kaspa L1, the payment is accepted on Kaspa in about a second, and it asks again with the proof. No account, no API key, no custodian.
                Every service here speaks k402, the <Term id="x402-v2"><ExternalLink href={EXTERNAL.standard}>Kaspa x402 v2 standard</ExternalLink></Term>. Humans run the services and supervise the agents; the agents do the buying.
              </p>
              <p className="mt-4 max-w-[62ch] text-[16px] leading-relaxed text-gray-400">
                Services here settle in <span className="text-gray-200">KAS</span>, most on <span className="font-mono text-gray-300">kaspa:mainnet</span>; Base-native services are paid in KAS too, the <a href={LINKS.router} target="_blank" rel="noopener noreferrer" className={LINK}>router</a> settling the Base leg.
                Services priced in agent money, <span className="text-gray-200">kUSD</span>, live on the {MARKET_NAME} on <span className="font-mono text-gray-300">kaspa:testnet-10</span> today.
              </p>
              <div className="mt-8 flex flex-wrap items-baseline gap-7 font-mono text-[14px]">
                <a href="#agents" className="btn-kaspa px-5 py-3 font-medium">Agents start here</a>
                <a href="#browse" className={LINK}>Browse services</a>
              </div>
              <p className="mt-8 max-w-[62ch] border-l border-gray-800 pl-4 text-[14.5px] leading-relaxed text-gray-400">{WHY_AGENTS}</p>
            </div>
            <RoundTrip />
          </section>

          <div className="mt-14"><StatStrip /></div>
          <div className="mt-10"><ProbeDemo /></div>

          {/* Who are you? One path each (UI/UX brief, Phase 2 P0-4): operators no longer scroll past the agent content. */}
          <section id="personas" className="mt-16 grid gap-10 border-t border-gray-100 pt-6 sm:grid-cols-2">
            <div>
              <h2 className={H2}>I&apos;m building an agent</h2>
              <p className="mt-3 text-[16px] leading-relaxed text-gray-300">Five steps from nothing to a paid call: funds, read the 402, pay in KAS or kUSD, verify on a node, then sell.</p>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[13px]"><a href="#agents" className={LINK}>the five steps</a><a href="/get-started" className={`text-gray-400 ${LINK}`}>get set up on testnet-10</a></div>
            </div>
            <div>
              <h2 className={H2}>I&apos;m selling an API</h2>
              <p className="mt-3 text-[16px] leading-relaxed text-gray-300">Put a 402 in front of your endpoint, validate it here (one unpaid probe, nothing charged), then list it for agents to find.</p>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[13px]"><a href="/validate" className={LINK}>validate your service</a><a href="/list" className={`text-gray-400 ${LINK}`}>list it</a></div>
            </div>
          </section>

          <Section mark="1" note="The whole protocol, in three moves." className="mt-16">
            <div className="grid gap-8 sm:grid-cols-3">
              <div><div className={MARK}>1 · the agent calls</div><p className="mt-2 text-[15px] leading-relaxed text-gray-300">It requests a resource. The service answers <span className="font-mono">402</span> with a <span className="font-mono">PAYMENT-REQUIRED</span> header: every way to pay, with the amount and the address.</p></div>
              <div><div className={MARK}>2 · the agent pays</div><p className="mt-2 text-[15px] leading-relaxed text-gray-300">In KAS (<span className="font-mono">@kaspa-x402/client</span>) or in kUSD (<span className="font-mono">k402</span>), on Kaspa L1, in one transaction, and retries with the proof in a <span className="font-mono">PAYMENT-SIGNATURE</span> header.</p></div>
              <div><div className={MARK}>3 · the chain settles</div><p className="mt-2 text-[15px] leading-relaxed text-gray-300">Value moved on Kaspa L1; the agent gets the result and can verify the settlement against a node. No middleman held the funds.</p></div>
            </div>
          </Section>

          <Section id="layers" mark="2" note="Three layers, one product. This site is the rails." className="mt-16">
            <h2 className={H2}>Three layers, one product</h2>
            <p className="mt-2 max-w-[70ch] text-[15px] leading-relaxed text-gray-400">{CLAIM} This site is the rails.</p>
            <LayersDiagram />
            <div className="mt-6 grid gap-8 sm:grid-cols-3">
              {LAYERS.map((l) => (
                <a key={l.key} href={l.url} className={`block border-t py-4 ${l.key === 'rails' ? 'border-accent' : 'border-gray-800'}`}>
                  <div className={MARK}>{l.role}{l.key === 'rails' ? ' · you are here' : ''}</div>
                  <div className={`mt-1 ${H3}`}>{l.name}</div>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-gray-400">{l.what}</p>
                  <span className={`mt-3 inline-block font-mono text-[12.5px] ${LINK}`}>{l.url.replace('https://', '')}</span>
                </a>
              ))}
            </div>
          </Section>

          <Section id="browse" mark="3" note="The directory. Each listing answered a live, unpaid 402 probe before it appeared; an agent can repeat that check itself." className="mt-16">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className={H2}>Services agents pay</h2>
              <div className="flex flex-wrap gap-2">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search services…" className={FIELD + ' min-w-[200px]'} />
                <select value={net} onChange={(e) => setNet(e.target.value)} className={FIELD}>
                  <option value="all">all networks</option><option value="kaspa:testnet-10">kaspa:testnet-10</option><option value="kaspa:mainnet">kaspa:mainnet</option>
                </select>
                <select value={sort} onChange={(e) => setSort(e.target.value)} className={FIELD} aria-label="sort">
                  <option value="recent">newest first</option><option value="price">cheapest first</option>
                </select>
              </div>
            </div>
            <div className="mt-8 space-y-12">
              {kaspaSvcs.length > 0 ? (
                <div>
                  <div className="flex flex-wrap items-baseline gap-3 pb-2 font-mono text-[12.5px] text-gray-500"><span className="text-gray-100">Kaspa-native</span><span>pay in KAS · settled on Kaspa L1 · {kaspaSvcs.length}</span></div>
                  {kaspaSvcs.map((l) => <ServiceCard key={l.id || l.resource} l={l} />)}
                </div>
              ) : null}
              {baseSvcs.length > 0 ? (
                <div>
                  <div className="flex flex-wrap items-baseline gap-3 pb-2 font-mono text-[12.5px] text-gray-500"><span className="text-gray-100">Base-native · via the router</span><span>pay in KAS · router settles USDC on Base · {baseSvcs.length}</span></div>
                  <p className="mb-3 max-w-[70ch] text-[14px] leading-relaxed text-gray-500">
                    These services live on Base. You still pay in KAS — the <a href="https://github.com/kaspa-402/kaspa-x402-router" target="_blank" rel="noopener noreferrer" className={LINK}>kaspa-x402-router</a> pays
                    the service’s USDC on Base for you and returns the result, with an on-chain receipt for each leg.
                  </p>
                  {baseSvcs.map((l) => <ServiceCard key={l.id || l.resource} l={l} />)}
                </div>
              ) : null}
            </div>
            {!loading && shown.length === 0 ? (
              <p className="mt-6 border-t border-gray-800 pt-4 font-mono text-[13px] text-gray-500">
                {net === 'all' ? 'No services match' : `No ${net} services match`}. {listings.length === 0 ? 'Be the first — list yours.' : net === 'all' ? 'Try a different search.' : 'Try another network, or list the first one.'}
              </p>
            ) : null}
            <div id="list" className="mt-10 flex flex-wrap items-baseline justify-between gap-4 border-t border-gray-800 pt-5 scroll-mt-20">
              <p className="max-w-[70ch] text-[15px] leading-relaxed text-gray-300">Selling an API? Put a 402 in front of it and list it here. One unpaid probe is the only gate; kUSD-priced services list on the {MARKET_NAME}.</p>
              <a href="/list" className={`font-mono text-[13px] ${LINK}`}>List your service</a>
            </div>
          </Section>

          <Section id="agents" mark="4" note={<>Agents start here. From nothing to a paid call, then to selling. The machine copy of this page is <a href="/llms.txt" className={LINK}>/llms.txt</a>.</>} className="mt-16">
            <h2 className={H2}>Agents start here</h2>
            <div className="mt-4 grid gap-4 border-t border-gray-800 pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
              <p className="text-[15px] leading-relaxed text-gray-300">This site is <span className="text-gray-100">machine-readable</span> — point your agent at <a href="/llms.txt" className={`font-mono ${LINK}`}>/llms.txt</a> (and <a href="/llms.json" className={`font-mono ${LINK}`}>/llms.json</a>) and it gets the same story, names and steps as a human reader.</p>
              <CodeBlock code={LLMS_CURL} className="min-w-0" />
            </div>
            <ol className="m-0 mt-6 list-none p-0">
              {[
                ['1 · get funds', <>A Kaspa key is the only account. On testnet-10, TKAS comes from the <a href={LINKS.faucet} target="_blank" rel="noopener noreferrer" className={LINK}>faucet</a>; kUSD is bought from the kUSD PSM in the <a href="/kusd/app" className={LINK}>browser wallet</a> or with the k402 client.</>, STEP_COMMANDS[0]],
                ['2 · read the 402', <>Call the resource unpaid. The <Term id="payment-required"><span className="font-mono">PAYMENT-REQUIRED</span></Term> header is base64 JSON: <span className="font-mono">accepts[]</span> lists each way to pay — scheme, network, amount, <Term id="payto"><span className="font-mono">payTo</span></Term>.</>, STEP_COMMANDS[1]],
                ['3 · pay, in KAS or kUSD', <>KAS: <span className="font-mono">@kaspa-x402/client</span> (<span className="font-mono">exact</span>, <span className="font-mono">batch-settlement</span>). kUSD: the k402 Python client (<span className="font-mono">pip install k402</span>) picks the best kUSD-priced provider and pays it inside <Term id="spendpolicy">the bounds its operator set</Term>.</>, STEP_COMMANDS[2]],
                ['4 · verify on a node', <>A KAS payment is a transaction to <Term id="payto"><span className="font-mono">payTo</span></Term>. A kUSD payment is a <Term id="covenant">covenant</Term> <Term id="box">box</Term> of exactly the quoted cents at the offer&apos;s key, checkable against any Kaspa node.</>, STEP_COMMANDS[3]],
                ['5 · sell', <>Answer 402 yourself: <span className="font-mono">@kaspa-x402/server</span> for KAS, <span className="font-mono">k402</span> (<span className="font-mono">K402(kusd=…)</span>) for kUSD. Submit the KAS endpoint above; list the kUSD one on the {MARKET_NAME}.</>, STEP_COMMANDS[4]],
              ].map(([mark, body, cmd]) => (
                <li key={mark} className="grid gap-4 border-t border-gray-800 py-5 lg:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
                  <div className={MARK}>{mark}</div>
                  <p className="m-0 text-[15px] leading-relaxed text-gray-300">{body}</p>
                  <CodeBlock code={cmd} className="min-w-0" />
                </li>
              ))}
            </ol>
          </Section>

          <Section id="covenants" mark="5" note="How covenants back this." className="mt-16">
            <h2 className={H2}>How covenants back this</h2>
            <div className="mt-4 grid gap-10 sm:grid-cols-2">
              <div className="border-t border-gray-800 pt-4">
                <div className={MARK}>today · kUSD settlement</div>
                <p className="mt-2 text-[15px] leading-relaxed text-gray-300">
                  kUSD is not an IOU on an account: each unit is state inside a Kaspa L1 covenant, minted against KAS in vaults, redeemable at a permissionless reserve, priced by a five-operator oracle — rules the chain enforces, with no bridge, no L2 and no trusted issuer.
                  A kUSD payment is therefore a covenant output a node can check: exact cents, the right family, the offer&apos;s own key. That is what makes the market&apos;s reputation settlement-verified. <a href={LAYERS[0].repo} target="_blank" rel="noopener noreferrer" className={LINK}>The kUSD code</a>.
                </p>
              </div>
              <div className="border-t border-gray-800 pt-4">
                <div className={MARK}>roadmap · KCC-0402 payment channels</div>
                <p className="mt-2 text-[15px] leading-relaxed text-gray-300">
                  For streaming and sub-cent micro-settlement, k402 defines covenant payment channels: an agent locks KAS in an L1 covenant and pays per call with signed vouchers; the provider can claim at most what was signed, and the agent reclaims the rest. The channel covenant and its tooling are in the k402 code.
                </p>
              </div>
            </div>
            <p className="mt-4 font-mono text-[12px] text-gray-600">{DISCLAIMERS.operators}</p>
          </Section>

          <Section id="attested" mark="6" note="Attested data: answers from our own mainnet node, signed by a registered attester, anchored on chain every hour." className="mt-16">
            <h2 className={H2}>Attested data, from a node that signs its answers</h2>
            <p className="mt-2 max-w-[70ch] text-[15px] leading-relaxed text-gray-300">
              Two paid endpoints run next to our mainnet node. Each answer is a signed envelope that states exactly what the node&apos;s index holds, the hash of every served answer is merkle-anchored in a mainnet transaction once an hour, and a node-less agent can verify both offline. Each costs 1 kUSD cent per call (KAS accepted); both are listed on the {MARKET_NAME}.
            </p>
            <div className="mt-4 grid gap-8 sm:grid-cols-2">
              <div className="border-t border-gray-800 pt-4">
                <div className={MARK}>attest.receipt</div>
                <h3 className={`mt-1 ${H3}`}>Settlement receipt</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-gray-400">For a Kaspa mainnet txid: accepted, seen or unknown, the accepting block, blue score, confirmations and when our node first saw it. Unknown always comes with the coverage window it was judged against.</p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12.5px]"><a href="https://attest.kaspa-402.org/receipt" className={LINK}>POST attest.kaspa-402.org/receipt</a><a href="https://attest.kaspa-402.org/methodology/receipt" className={`text-gray-400 ${LINK}`}>method and limits</a></div>
              </div>
              <div className="border-t border-gray-800 pt-4">
                <div className={MARK}>attest.fees</div>
                <h3 className={`mt-1 ${H3}`}>Fee and inclusion forecast</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-gray-400">The node&apos;s fee buckets plus what only a node operator watching its mempool can measure: first-seen to acceptance delays by feerate over the last hour, on a fixed grid with a 50-sample floor.</p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12.5px]"><a href="https://attest.kaspa-402.org/fees" className={LINK}>GET attest.kaspa-402.org/fees</a><a href="https://attest.kaspa-402.org/methodology/fees" className={`text-gray-400 ${LINK}`}>method and limits</a></div>
              </div>
            </div>
            <p className="mt-5 max-w-[70ch] font-mono text-[12.5px] leading-relaxed text-gray-500">
              Verify any answer: <a href="https://github.com/kaspa-402/k402-attest" className={LINK}>verify.py</a> checks the signature offline; with the proof from <a href="https://attest.kaspa-402.org/audit/2026-11-19T01" className={LINK}>attest.kaspa-402.org/audit/&lt;hour&gt;</a> and any Kaspa node it checks the hourly anchor on chain. Attesters, weights and disputes: <a href="https://attest.kaspa-402.org/attesters" className={LINK}>/attesters</a>.
            </p>
          </Section>

          <Section mark="7" note="Pay from an agent: the same call in three languages." className="mt-16 mb-4">
            <CodeTabs samples={SAMPLES} />
            <p className="mt-3 font-mono text-[12px] text-gray-600">Full example: <a href="https://github.com/kaspa-402/kaspa-402/blob/main/examples/agent-quickstart.mjs" target="_blank" rel="noopener noreferrer" className={LINK}>examples/agent-quickstart.mjs</a> on GitHub.</p>
          </Section>
        </div>
      </main>
    </>
  );
}
