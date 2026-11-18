import Head from 'next/head';
import Term from '../components/Term';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, ExternalLink, ArrowRight } from 'lucide-react';
import snapshot from '../public/kusd/snapshot.json';
import LiveBadge, { Dot } from '../components/kusd/LiveBadge';
import ProductMap from '../components/kusd/ProductMap';
import { DISCLAIMERS } from '../lib/kusd/story.mjs';
import { oracleStatusLabel } from '../lib/kusd/labels.mjs';
import { vaultView } from '../lib/kusd/status.mjs';

// Units (contracts/v2/README.md): oracle prices are 1e-4 USD per KAS, kUSD amounts are cents, KAS is sompi.
const usdPerKas = (p) => `$${(p / 1e4).toFixed(4)}`;
const dollars = (c) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const kas = (s) => `${(s / 1e8).toLocaleString('en-US', { maximumFractionDigits: 2 })} KAS`;
const STALE_DAA = 36000;
const txUrl = (id) => `https://api-tn10.kaspa.org/transactions/${id}`;
const short = (h) => `${h.slice(0, 8)}…${h.slice(-4)}`;
const day = (t) => new Date(t * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

const STEP_LABEL = {
  'ORACLE-GENESIS': 'Oracle genesis', 'PSM-GENESIS': 'PSM genesis', 'SURPLUS-GENESIS': 'Surplus genesis',
  'BUDGET-GENESIS': 'Budget genesis', 'AUTHORITY-GENESIS': 'Token authority genesis', WIRE: 'Wire PSM',
  'BUDGET-WIRE': 'Wire budget', 'VAULT-GENESIS': 'Vault genesis', REFRESH: 'Price refresh',
  REFUSED_PRINTS: 'Bad prints refused', SET_MEMBER: 'Operator rotation', 'BUDGET-SET-LIMIT': 'Budget limit change',
  MINT: 'Mint', FREEZE: 'Oracle frozen', SWAP_OUT_FEE: 'PSM redeem with fee', LIQUIDATE: 'Liquidation',
  SET_MINER: 'Oracle bound to the miner median', 'MINER-POST': 'Miner median posted',
  SURPLUS_SPEND: 'Surplus spend', CLOSE: 'Vault close', HEARTBEAT: 'Routine refreshes', REPAY: 'Repay', ADJUST: 'Collateral top-up',
  NOT_FINAL: 'Future clock refused', SET_CEILING: 'PSM parameters', SET_RATE: 'Stability fee change', LIQ_REFUSED: 'Liquidation refused (above 150%)', SWAP_IN: 'PSM swap in', SWAP_OUT: 'PSM redeem',
};

// Retired covenant families, shown together under "Previous deployments".
const FAMILY_LABEL = { 'stage1-v1': 'Stage 1, first deployment', 'phase5': 'Phase 5' };

function Tx({ id }) {
  return (
    <a href={txUrl(id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-neon-purple hover:underline">
      {short(id)} <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  );
}

function CopyHex({ value }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked */ }
  };
  return (
    <button type="button" onClick={copy} className="ml-2 inline-flex shrink-0 items-center text-gray-500 hover:text-neon-purple" aria-label="Copy">
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function Card({ title, dot, children }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-neon-purple">{title}</h3>
        {dot}
      </div>
      <dl className="mt-3 space-y-1.5 font-mono text-sm">{children}</dl>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{k}</dt>
      <dd className="text-right text-gray-200">{v}</dd>
    </div>
  );
}

function TimelineEntry({ e }) {
  const refused = e.txid == null;
  const family = FAMILY_LABEL[e.family];
  return (
    <li className={`rounded-xl border p-4 ${refused ? 'border-dashed border-amber-400/50 bg-amber-400/5' : 'border-gray-800 bg-black/30'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-white">
          {STEP_LABEL[e.step] || e.step}
          {family && <span className="ml-2 font-mono text-[10px] font-normal uppercase tracking-wider text-gray-500">{family}</span>}
        </div>
        {refused
          ? <span className="font-mono text-xs uppercase tracking-wider text-amber-300">{e.step === 'NOT_FINAL' ? 'refused by the node' : 'refused by the covenant'} · {'no transaction'}</span>
          : <Tx id={e.txid} />}
      </div>
      <p className="mt-1 text-sm text-gray-400">{e.note}</p>
      <div className="mt-1 font-mono text-[11px] text-gray-600">{day(e.time)}</div>
    </li>
  );
}

export default function Kusd() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  // the status route returns the snapshot it checked (the hourly job's copy when valid)
  const s = status?.snapshot ?? snapshot;
  const c = s.covenants;
  const o = c.oracle.state;

  useEffect(() => {
    let live = true;
    fetch('/api/kusd/status')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((j) => { if (live) { setStatus(j); setLoading(false); } });
    return () => { live = false; };
  }, []);

  const DOT_TEXT = { current: 'matches chain', moved: 'chain moved', unknown: 'not checked', loading: 'checking' };
  const dot = (name) => {
    const st = loading ? 'loading' : status?.covenants?.[name] || 'unknown';
    return <span className="inline-flex items-center gap-1.5"><Dot state={st} /><span className="font-mono text-[10px] text-gray-500">{DOT_TEXT[st]}</span></span>;
  };
  const silence = status?.daaScore != null ? status.daaScore - o.last : null;
  const hoursSilent = silence != null ? (silence / 10 / 3600).toFixed(1) : null;
  const vault = vaultView(c.vault.state, o);   // debt owed now (stability fee applied), ratio null when nothing is owed
  const stage1 = s.timeline.filter((e) => e.family === 'stage1').slice().reverse();
  const previous = s.timeline.filter((e) => e.family !== 'stage1').slice().reverse();
  const signers = new Set(s.operators.lastRefreshSigners);
  const rotated = Object.fromEntries(s.operators.rotated.map((r) => [r.slot, r.txid]));
  const desc = 'kUSD: the covenant-native USD stablecoin built for AI agents, on Kaspa L1 (testnet-10). The money layer of the agent-native marketplace: live state, every transaction, and how to verify it yourself.';

  return (
    <>
      <Head>
        <title>kUSD — the stablecoin built for agents, on Kaspa L1</title>
        <meta name="description" content={desc} />
        <meta property="og:title" content="kUSD — the stablecoin built for agents, on Kaspa L1" />
        <meta property="og:description" content={desc} />
      </Head>

      <main className="font-sans bg-gray-950 text-gray-100">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden border-b border-neon-purple/20">
          <div className="pointer-events-none absolute inset-0 bg-kaspa-card" aria-hidden="true" />
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-16 md:py-24">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-neon-purple/40 bg-black/40 px-3 py-1 uppercase tracking-widest text-neon-purple">Covenant-native</span>
                <span className="rounded-full border border-amber-400/40 bg-black/40 px-3 py-1 uppercase tracking-widest text-amber-400">{s.stage} · TN10</span>
              </div>
              <h1 className="mt-6 font-orbitron text-4xl md:text-6xl font-bold">
                k<span className="text-neon-purple neon-text-pink">USD</span>
              </h1>
              <p className="mt-4 max-w-2xl text-lg text-gray-300">
                The money layer of an agent-native marketplace on Kaspa L1: a USD stablecoin <span className="text-kaspa">built for AI agents</span>,
                living entirely in Kaspa L1 covenants — vaults, a peg stability module, an issuance budget and a five-operator price
                oracle, each enforced by the chain itself. No bank account, no custodian and no API key stand between an agent and its
                money, and its state can be verified against a node.
              </p>
              <p className="mt-3 max-w-2xl text-sm text-gray-400">
                This page is where you <span className="text-gray-200">verify the money</span>: every covenant output and transaction below
                links to testnet-10. The market is where agents spend it.
              </p>
              <p className="mt-3 max-w-2xl text-sm text-gray-300">
                In plain terms: one kUSD is worth one US dollar, kept there by KAS collateral and a chain-enforced price feed. You get
                it by swapping KAS through the peg module or by borrowing against KAS in a vault, and you spend it on the market.
                Test coins are free: <Link href="/get-started" className="text-neon-purple hover:underline">get set up on testnet-10</Link>, then
                open the app below.
              </p>
              <div className="mt-6 rounded-xl border border-amber-400/40 bg-amber-400/5 px-4 py-3 text-sm text-amber-200">
                <strong>{DISCLAIMERS.research}</strong> {DISCLAIMERS.advice}
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <Link href="/kusd/app" className="inline-flex items-center gap-2 rounded-lg bg-neon-purple px-5 py-2.5 text-sm font-semibold text-black hover:bg-neon-purple/90">
                  Open the kUSD app <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <span className="text-sm text-gray-400">Swap, borrow and send on TN10 from your browser.</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <Link href="/market" className="inline-flex items-center gap-2 rounded-lg border border-neon-purple/60 px-5 py-2.5 text-sm font-semibold text-neon-purple hover:bg-neon-purple/10">
                  Open the Kaspa Agent Market <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <span className="text-sm text-gray-400">Watch agents pay agents in kUSD, live — and be one from your wallet.</span>
              </div>
              <div className="mt-6"><LiveBadge status={status} loading={loading} generatedAt={s.generatedAt} /></div>
            </motion.div>
          </div>
        </section>

        {/* ── Risk parameters (UI/UX brief, Phase 3): the lines that were buried in transaction captions ── */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-10">
          <div className="rounded-2xl border border-gray-800 bg-black/30 p-5">
            <div className="font-mono text-[11px] uppercase tracking-wider text-gray-500">Risk parameters</div>
            <dl className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 font-mono text-sm">
              <div><dt className="text-gray-500 text-xs">borrowing line</dt><dd className="text-white text-lg">175%</dd><dd className="text-xs text-gray-500">collateral ÷ debt at the mint price to borrow</dd></div>
              <div><dt className="text-gray-500 text-xs">liquidation line</dt><dd className="text-white text-lg">150%</dd><dd className="text-xs text-gray-500">below it anyone may liquidate: keeper 110%, surplus 3%</dd></div>
              <div><dt className="text-gray-500 text-xs">price moves</dt><dd className="text-white text-lg">+10% / −25% per hour</dd><dd className="text-xs text-gray-500">mint price up, liquidation price down, at most</dd></div>
              <div><dt className="text-gray-500 text-xs">Stage 2 miner bound</dt><dd className="text-white text-lg">±5%</dd><dd className="text-xs text-gray-500">around the miners&apos; median when it is under 45 min old and ≥ ½ of blocks voted; else Stage 1</dd></div>
            </dl>
          </div>
        </section>

        <ProductMap here="money" />

        {/* ── Oracle ── */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-14">
          <div className="flex items-center gap-3">
            <h2 className="font-orbitron text-2xl font-bold text-white">The oracle</h2>
            {dot('oracle')}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-neon-purple/40 bg-neon-purple/5 p-5 md:col-span-1">
              <div className="font-mono text-[11px] uppercase tracking-wider text-gray-500">Median price</div>
              <div className="mt-1 font-orbitron text-4xl font-bold text-white">{usdPerKas(o.price)}</div>
              <div className="font-mono text-xs text-gray-500">per KAS · epoch {o.epoch} · {oracleStatusLabel(o.status, loading ? null : status?.staleOracle ?? null)}</div>
              <dl className="mt-4 space-y-1.5 font-mono text-sm">
                <Row k="mint price" v={usdPerKas(o.mint)} />
                <Row k="liquidation price" v={usdPerKas(o.liq)} />
                {o.rate !== undefined && <Row k="stability fee" v={`${(o.rate / 100).toFixed(2)}% a year`} />}
                {o.index !== undefined && <Row k="rate index" v={(o.index / 1e9).toFixed(9)} />}
              </dl>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5 md:col-span-2">
              <div className="font-mono text-[11px] uppercase tracking-wider text-gray-500">Five operators · latest refresh signed by</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {Array.from({ length: s.operators.slots }, (_, i) => (
                  <div key={i} className={`rounded-lg border px-3 py-2 font-mono text-sm ${signers.has(i) ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300' : 'border-gray-700 text-gray-500'}`}>
                    slot {i}{signers.has(i) ? ' ✓' : ''}
                    {rotated[i] && <div className="text-[10px] text-amber-300">rotated</div>}
                  </div>
                ))}
              </div>
              <ul className="mt-4 space-y-1.5 text-sm text-gray-400">
                <li>· Each operator signs its own price offline. Anyone can relay three prints into a refresh, and the relayer can&apos;t change the price.</li>
                <li>· The price is the <span className="text-gray-200">median of three</span>, and prints more than <span className="text-gray-200">3% apart</span> are refused as a set.</li>
                <li>· The mint price may rise at most 10% per hour and the liquidation price may fall at most 25% per hour, so one manipulated hour can&apos;t mint cheap kUSD or trigger a wave of liquidations.</li>
                <li>· Every clock is proven by the transaction&apos;s <Term id="lock-time">lock time</Term>: the network won&apos;t include a transaction before its lock time, so nobody can claim time that hasn&apos;t passed.</li>
                <li className="text-amber-200/90">· On TN10 the five operators run as separate services on one machine, each with its own key and price source, and a keyless relayer assembles their prints; independent operators are a pre-mainnet gate (each on its own machine).</li>
                {Object.entries(rotated).map(([slot, txid]) => (
                  <li key={slot}>· Slot {slot} was rotated to a fresh key without a redeploy: <Tx id={txid} /></li>
                ))}
              </ul>
            </div>
          </div>
          {c.miner && (
            <div className="mt-4 rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-5">
              <div className="flex items-center gap-3">
                <div className="font-mono text-[11px] uppercase tracking-wider text-gray-500">Stage 2 · <Term id="miner-median">Miner median</Term></div>
                {dot('miner')}
                <span className={`rounded-md border px-2 py-0.5 font-mono text-[11px] ${o.bounded === 1 ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-300' : 'border-gray-700 text-gray-500'}`}>
                  bound {o.bounded === 1 ? 'ON' : 'OFF'}
                </span>
              </div>
              <div className="mt-2 grid gap-4 md:grid-cols-3">
                <div>
                  <div className="font-orbitron text-3xl font-bold text-white">{c.miner.state.votes > 0 ? usdPerKas(c.miner.state.median) : '—'}</div>
                  <div className="font-mono text-xs text-gray-500">
                    {c.miner.state.votes.toLocaleString()} of {c.miner.state.blocks.toLocaleString()} blocks voted · window anchored at DAA {c.miner.state.anchor_daa.toLocaleString()}
                  </div>
                </div>
                <ul className="md:col-span-2 space-y-1.5 text-sm text-gray-400">
                  <li>· Kaspa miners put a 13-byte KAS/USD vote in their blocks&apos; coinbase payload; a RISC Zero proof over a 6,000-block window posts the median here, verified by the chain.</li>
                  <li>· When that median is fresh (under 45 minutes old) and at least half the blocks voted, every refresh is <span className="text-gray-200">clamped to within 5%</span> of it: operators alone cannot move the price past the miners, and miners alone cannot move it past the operators.</li>
                  <li>· Otherwise the refresh falls back to the operators&apos; median and records <span className="font-mono">bounded = 0</span>: miner silence never freezes the feed.</li>
                </ul>
              </div>
            </div>
          )}
          {status?.staleOracle && (
            <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-400/5 px-4 py-3 text-sm text-amber-200">
              Last refresh ~{hoursSilent}h ago. After 1 hour of silence anyone may freeze the oracle, which stops minting until operators refresh it.
            </div>
          )}
          {status && status.staleOracle === false && silence != null && silence < STALE_DAA && (
            <div className="mt-4 font-mono text-xs text-gray-500">Last refresh ~{hoursSilent}h ago.</div>
          )}
        </section>

        {/* ── System state ── */}
        <section className="border-y border-gray-800 bg-gray-900/40">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14">
            <h2 className="font-orbitron text-2xl font-bold text-white">System state</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <Card title="Issuance budget" dot={dot('budget')}>
                <Row k="daily limit" v={dollars(c.budget.state.limit)} />
                <Row k="available now" v={dollars(c.budget.state.available)} />
              </Card>
              <Card title="Peg stability module" dot={dot('psm')}>
                <Row k="ceiling" v={dollars(c.psm.state.ceiling)} />
                <Row k="minted via PSM" v={dollars(c.psm.state.minted)} />
              </Card>
              <Card title="Vault" dot={dot('vault')}>
                <Row k="collateral" v={kas(c.vault.state.collateral)} />
                <Row k="debt owed now" v={dollars(vault.debtCents)} />
                <Row k="ratio at liq. price" v={vault.ratioPct == null ? 'no debt' : `${Math.round(vault.ratioPct).toLocaleString('en-US')}%`} />
              </Card>
              <Card title="kUSD in circulation" dot={dot('minted')}>
                <Row k="minted holder" v={dollars(c.minted.state.amount)} />
              </Card>
              <Card title="Token authority" dot={dot('authority')}>
                <Row k="unissued supply" v={dollars(c.authority.state.amount)} />
              </Card>
              <Card title="Surplus pot" dot={dot('surplus')}>
                <Row k="balance" v={kas(c.surplus.amount)} />
              </Card>
            </div>
            <p className="mt-4 font-mono text-xs text-gray-500">Values as exported {s.generatedAt}. &quot;matches chain&quot; beside a dot: that covenant output is still unspent on TN10, so the value is current.</p>
            <details className="mt-3 rounded-xl border border-gray-800 bg-black/30 px-4 py-3 text-sm text-gray-400">
              <summary className="cursor-pointer font-mono text-xs uppercase tracking-wider text-gray-400">What these figures mean</summary>
              <ul className="mt-2 space-y-1.5">
                <li>· <span className="text-gray-200">minted holder</span>: the kUSD issued to users (here, the deployer&apos;s test box). <span className="text-gray-200">unissued supply</span>: what the <Term id="token-authority">token authority</Term> still holds and has never issued; the two always sum to the fixed 1,000,000 kUSD.</li>
                <li>· <span className="text-gray-200">surplus pot</span>: the protocol&apos;s revenue — PSM fees, interest, the 3% liquidation share — in KAS, under governance.</li>
                <li>· The <span className="text-gray-200">mint</span> and <span className="text-gray-200">liquidation</span> prices are identical whenever the price has been steady for an hour: the rate limits only pull them apart during a move (mint lags a rise, liquidation lags a fall), which is what stops one manipulated hour from minting cheap kUSD or triggering liquidations.</li>
              </ul>
            </details>
          </div>
        </section>

        {/* ── Timeline ── */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-14">
          <h2 className="font-orbitron text-2xl font-bold text-white">Every transaction, {s.stage}</h2>
          <p className="mt-2 max-w-2xl font-mono text-sm text-gray-400">Newest first. Each link opens the raw transaction on the public TN10 API.</p>
          <ol className="mt-6 space-y-3">{stage1.map((e, i) => <TimelineEntry key={`${e.step}-${i}`} e={e} />)}</ol>
        </section>

        {/* ── Previous deployment ── */}
        <section className="border-y border-gray-800 bg-gray-900/40">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14">
            <h2 className="font-orbitron text-2xl font-bold text-white">Previous deployments (retired covenants)</h2>
            <p className="mt-2 max-w-2xl font-mono text-sm text-gray-400">
              Changing a covenant&apos;s code means re-creating the whole family. The first Stage 1 deployment (before lock-time clocks)
              and Phase 5, which showed the safety rails working live, are still on TN10.
            </p>
            <ol className="mt-6 space-y-3">{previous.map((e, i) => <TimelineEntry key={`${e.family}-${e.step}-${i}`} e={e} />)}</ol>
          </div>
        </section>

        {/* ── Metering ── */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-14">
          <h2 className="font-orbitron text-2xl font-bold text-white">Cost on chain</h2>
          <p className="mt-2 max-w-2xl font-mono text-sm text-gray-400"><Term id="compute-mass">Compute mass</Term> against Kaspa&apos;s 500,000 per-transaction cap, measured by the test suite.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {s.metering.map((m) => (
              <div key={m.path} className="rounded-xl border border-gray-800 bg-black/30 p-5">
                <div className="font-semibold text-white">{m.path}</div>
                <div className="mt-2 font-orbitron text-2xl text-neon-purple">{m.pctCap}%</div>
                <div className="font-mono text-xs text-gray-500">{m.computeMass.toLocaleString('en-US')} compute mass</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Verify ── */}
        <section className="border-t border-gray-800 bg-gray-900/40">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14">
            <h2 className="font-orbitron text-2xl font-bold text-white">Don&apos;t trust this page. Verify it.</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="min-w-0 rounded-xl border border-gray-800 bg-black/30 p-5 text-sm text-gray-400">
                <p>
                  Source, whitepaper and the full evidence archive (MIT):{' '}
                  <a href={s.repo} target="_blank" rel="noreferrer" className="text-neon-purple hover:underline break-all">{s.repo.replace('https://', '')}</a>
                </p>
                <ol className="mt-4 space-y-3">
                  <li><span className="font-mono text-xs uppercase tracking-wider text-gray-500">Step 1 · the boxes are real.</span> Open any covenant id&apos;s current output on the explorer (links on the right) and check it is unspent and carries that covenant id — the same check the status dots make.</li>
                  <li><span className="font-mono text-xs uppercase tracking-wider text-gray-500">Step 2 · the code is what the chain runs.</span> From the repo, reproduce each genesis covenant id from its source and bootstrap: <code className="font-mono text-xs text-emerald-400">argentc genesis verify … --require-argent --source</code> (the exact commands are in <code className="font-mono text-xs">contracts/v2/deploy/genesis-*/README.md</code>).</li>
                  <li><span className="font-mono text-xs uppercase tracking-wider text-gray-500">Step 3 · the rules hold.</span> One command reruns all {s.tests.count} tests, attack regressions included:</li>
                </ol>
                <pre className="mt-2 overflow-x-auto rounded-lg border border-gray-800 bg-black/50 p-3 font-mono text-xs text-emerald-400">{s.tests.command}</pre>
                <p className="mt-3">
                  Why the values aren&apos;t read live: every kUSD <Term id="covenant">covenant</Term> output is a <Term id="script-hash">script hash</Term>, and its state sits
                  inside the hashed script until it is spent. This page shows the exported values and checks the outputs
                  are still unspent. To check a value yourself, compile the covenant template with that state and compare
                  its script hash with the output on chain; the repo&apos;s tests and evidence show how.
                </p>
              </div>
              <div className="min-w-0 rounded-xl border border-gray-800 bg-black/30 p-5">
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-gray-500">Covenant IDs (testnet-10)</div>
                <ul className="mt-2 space-y-2">
                  {['oracle', 'miner', 'psm', 'surplus', 'budget', 'authority', 'vault'].filter((n) => c[n]).map((n) => (
                    <li key={n} className="font-mono text-[11px]">
                      <span className="text-gray-400">{n}</span>
                      <div className="flex items-start">
                        <span className="break-all text-emerald-400">{c[n].covid}</span>
                        <CopyHex value={c[n].covid} />
                      </div>
                      <a href={txUrl(c[n].txid)} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-neon-purple">current output: {short(c[n].txid)}:{c[n].index} ↗ explorer</a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
