import Head from 'next/head';
import Term from '../components/Term';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import snapshot from '../public/kusd/snapshot.json';
import LiveBadge, { Dot } from '../components/kusd/LiveBadge';
import ProductMap from '../components/kusd/ProductMap';
import CrashReplay from '../components/kusd/CrashReplay';
import KusdMark, { KusdIcons } from '../components/kusd/KusdMark';
import { DISCLAIMERS } from '../lib/kusd/story.mjs';
import { oracleStatusLabel } from '../lib/kusd/labels.mjs';
import { vaultView, circulatingCents } from '../lib/kusd/status.mjs';
import { STEP_LABEL, Tx, TimelineEntry, txUrl, short } from '../components/kusd/Timeline';
import { groupTimeline, filterTimeline } from '../lib/kusd/timeline.mjs';
import { BUTTON, FIELD, Facts, H1, H2, H3, LINK, MARK, NUM, PAGE, Section } from '../components/Ledger';

// Units (contracts/v2/README.md): oracle prices are 1e-4 USD per KAS, kUSD amounts are cents, KAS is sompi.
const usdPerKas = (p) => `$${(p / 1e4).toFixed(4)}`;
const dollars = (c) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const kas = (s) => `${(s / 1e8).toLocaleString('en-US', { maximumFractionDigits: 2 })} KAS`;
const STALE_DAA = 36000;

function CopyHex({ value }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked */ }
  };
  return (
    <button type="button" onClick={copy} className={`ml-3 shrink-0 font-mono text-[11.5px] text-gray-500 ${LINK}`} aria-label="Copy">{done ? 'copied' : 'copy'}</button>
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

  const DOT_TEXT = { live: 'read live', current: 'matches chain', moved: 'chain moved', unknown: 'not checked', loading: 'checking' };
  const liveKinds = new Set(status?.live?.kinds || []);
  const dot = (name) => {
    const st = loading ? 'loading' : status?.covenants?.[name] || 'unknown';
    if (st === 'current' && liveKinds.has(name)) return <span className="inline-flex items-center gap-1.5"><Dot state="current" /><span className="font-mono text-[11px] text-gray-500">{DOT_TEXT.live}</span></span>;
    return <span className="inline-flex items-center gap-1.5"><Dot state={st} /><span className="font-mono text-[11px] text-gray-500">{DOT_TEXT[st]}</span></span>;
  };
  const silence = status?.daaScore != null ? status.daaScore - o.last : null;
  const hoursSilent = silence != null ? (silence / 10 / 3600).toFixed(1) : null;
  const vault = vaultView(c.vault.state, o);   // debt owed now (stability fee applied), ratio null when nothing is owed
  const stage1 = s.timeline.filter((e) => e.family === 'stage1').slice().reverse();
  const retired = s.timeline.filter((e) => e.family !== 'stage1').length;
  const [logQ, setLogQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const grouped = groupTimeline(filterTimeline(stage1, logQ, STEP_LABEL));
  const PAGE_ROWS = 20;
  const visible = showAll || logQ ? grouped : grouped.slice(0, PAGE_ROWS);
  const signers = new Set(s.operators.lastRefreshSigners);
  const rotated = Object.fromEntries(s.operators.rotated.map((r) => [r.slot, r.txid]));
  const desc = 'kUSD: the covenant-native USD stablecoin built for AI agents, on Kaspa L1 (testnet-10). The money layer of the agent-native marketplace: live state, every transaction, and how to verify it yourself.';
  const covenantRows = [
    ['Issuance budget', dot('budget'), [['daily limit', dollars(c.budget.state.limit)], ['available now', dollars(c.budget.state.available)]]],
    ['Peg stability module', dot('psm'), [['ceiling', dollars(c.psm.state.ceiling)], ['minted via PSM', dollars(c.psm.state.minted)]]],
    ['Vault', dot('vault'), [['collateral', kas(c.vault.state.collateral)], ['debt owed now', dollars(vault.debtCents)], ['ratio at liq. price', vault.ratioPct == null ? 'no debt' : `${Math.round(vault.ratioPct).toLocaleString('en-US')}%`]]],
    ['kUSD in circulation', dot('authority'), [['all holders', dollars(circulatingCents(c.authority.state.amount))]]],
    ["Deployer's test box", dot('minted'), [['one holder box', dollars(c.minted.state.amount)]]],
    ['Token authority', dot('authority'), [['unissued supply', dollars(c.authority.state.amount)]]],
    ['Surplus pot', dot('surplus'), [['balance', kas(c.surplus.amount)]]],
  ];

  return (
    <>
      <Head>
        <title>kUSD — the stablecoin built for agents, on Kaspa L1</title>
        <meta name="description" content={desc} />
        <meta property="og:title" content="kUSD — the stablecoin built for agents, on Kaspa L1" />
        <meta property="og:description" content={desc} />
        <meta property="og:image" content="https://www.kaspa-402.org/api/og-kusd" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://www.kaspa-402.org/api/og-kusd" />
      </Head>
      <KusdIcons />

      <main className={`${PAGE} py-12 lg:py-16`}>
        {/* ── § 0 the claim ── */}
        <Section mark="0" top={false} note={<><div>{s.stage} · testnet-10</div><div className="mt-2">{DISCLAIMERS.research} {DISCLAIMERS.advice}</div><div className="mt-2"><LiveBadge status={status} loading={loading} generatedAt={s.generatedAt} /></div></>}>
          <KusdMark size={72} className="mb-5" />
          <h1 className={H1}>kUSD: a dollar that lives inside Kaspa covenants, built for agents.</h1>
          <p className="mt-6 max-w-[62ch] text-[clamp(17px,1.25vw,20px)] leading-relaxed text-gray-300">
            The money layer of an agent-native marketplace on Kaspa L1: a USD stablecoin living entirely in Kaspa L1 covenants — vaults, a peg stability module, an issuance budget and a five-operator price
            oracle, each enforced by the chain itself. No bank account, no custodian and no API key stand between an agent and its
            money, and its state can be verified against a node.
          </p>
          <p className="mt-4 max-w-[62ch] text-[16px] leading-relaxed text-gray-400">
            This page is where you <span className="text-gray-200">verify the money</span>: every covenant output and transaction below
            links to testnet-10. The market is where agents spend it.
          </p>
          <p className="mt-4 max-w-[62ch] text-[16px] leading-relaxed text-gray-300">
            In plain terms: one kUSD is worth one US dollar, kept there by KAS collateral and a chain-enforced price feed. You get
            it by swapping KAS through the peg module or by borrowing against KAS in a vault, and you spend it on the market.
            Test coins are free: <Link href="/get-started" className={LINK}>get set up on testnet-10</Link>, then
            open the app.
          </p>
          <div className="mt-8 flex flex-wrap items-baseline gap-7 font-mono text-[14px]">
            <Link href="/kusd/app" className={BUTTON}>Open the kUSD app</Link>
            <Link href="/market" className={LINK}>Open the Kaspa Agent Market</Link>
          </div>
          <p className="mt-3 text-[14px] text-gray-500">Swap, borrow and send on TN10 from your browser; on the market, watch agents pay agents in kUSD, live, and be one from your wallet.</p>
        </Section>

        {/* ── § 1 Risk parameters (UI/UX brief, Phase 3): the lines that were buried in transaction captions ── */}
        <Section mark="1" note="Risk parameters. The numbers the covenants enforce." className="mt-12">
          <h2 className={H2}>Risk parameters</h2>
          <div className="mt-4 grid gap-x-10 gap-y-6 border-y border-gray-100 py-5 sm:grid-cols-2 lg:grid-cols-4">
            <div><div className={NUM}>175%</div><div className="mt-2 text-[14px] text-gray-300">borrowing line</div><div className="text-[13px] text-gray-500">collateral ÷ debt at the mint price to borrow</div></div>
            <div><div className={NUM}>150%</div><div className="mt-2 text-[14px] text-gray-300">liquidation line</div><div className="text-[13px] text-gray-500">below it anyone may liquidate: keeper 110%, surplus 3%</div></div>
            <div><div className={NUM}>+10% / −25%</div><div className="mt-2 text-[14px] text-gray-300">price moves per hour</div><div className="text-[13px] text-gray-500">mint price up, liquidation price down, at most</div></div>
            <div><div className={NUM}>±5%</div><div className="mt-2 text-[14px] text-gray-300">Stage 2 miner bound</div><div className="text-[13px] text-gray-500">around the miners&apos; median when it is under 45 min old and ≥ ½ of blocks voted; else Stage 1</div></div>
          </div>
        </Section>

        {/* ── § 1b Crash replay: the 10 Oct 2025 crash through the oracle and vault rules (kusd-framework #56) ── */}
        <Section id="crash-replay" mark="1b" note="Stress test. The worst day KAS has had, replayed through the rules these covenants enforce." className="mt-12">
          <h2 className={H2}>Replay the 10 October 2025 crash</h2>
          <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-gray-300">
            On 10 October 2025 a market-wide liquidation cascade took KAS from $0.071 to $0.009 in an hour. Drag through
            the night and watch what happens to two vaults under today&apos;s lines and under any other pair you choose.
          </p>
          <CrashReplay />
        </Section>

        <Section mark="2" note="Three layers, one product. This page is the money." className="mt-12">
          <ProductMap here="money" />
        </Section>

        {/* ── § 3 Oracle ── */}
        <Section mark="3" note={<>The oracle. {dot('oracle')}</>} className="mt-12">
          <h2 className={H2}>The oracle</h2>
          <div className="mt-4 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <div className="border-t border-gray-100 pt-4">
              <div className={MARK}>median price</div>
              <div className={`mt-1 ${NUM}`}>{usdPerKas(o.price)}</div>
              <div className="mt-1 font-mono text-[12px] text-gray-500">per KAS · epoch {o.epoch} · {oracleStatusLabel(o.status, loading ? null : status?.staleOracle ?? null)}</div>
              <Facts className="mt-4" rows={[
                ['mint price', usdPerKas(o.mint)],
                ['liquidation price', usdPerKas(o.liq)],
                ...(o.rate !== undefined ? [['stability fee', `${(o.rate / 100).toFixed(2)}% a year`]] : []),
                ...(o.index !== undefined ? [['rate index', (o.index / 1e9).toFixed(9)]] : []),
              ]} />
            </div>
            <div className="border-t border-gray-100 pt-4">
              <div className={MARK}>five operators · latest refresh signed by</div>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[13px]">
                {Array.from({ length: s.operators.slots }, (_, i) => (
                  <span key={i} className={signers.has(i) ? 'text-accent' : 'text-gray-500'}>slot {i}{signers.has(i) ? ' ✓' : ''}{rotated[i] ? ' · rotated' : ''}</span>
                ))}
              </div>
              <ul className="mt-4 space-y-2 text-[15px] leading-relaxed text-gray-400">
                <li>Each operator signs its own price offline. Anyone can relay three prints into a refresh, and the relayer can&apos;t change the price.</li>
                <li>The price is the <span className="text-gray-200">median of three</span>, and prints more than <span className="text-gray-200">3% apart</span> are refused as a set.</li>
                <li>The mint price may rise at most 10% per hour and the liquidation price may fall at most 25% per hour, so one manipulated hour can&apos;t mint cheap kUSD or trigger a wave of liquidations.</li>
                <li>Every clock is proven by the transaction&apos;s <Term id="lock-time">lock time</Term>: the network won&apos;t include a transaction before its lock time, so nobody can claim time that hasn&apos;t passed.</li>
                <li className="text-gray-300">On TN10 the five operators run as separate services on one machine, each with its own key and price source, and a keyless relayer assembles their prints; independent operators are a pre-mainnet gate (each on its own machine).</li>
                {Object.entries(rotated).map(([slot, txid]) => (
                  <li key={slot}>Slot {slot} was rotated to a fresh key without a redeploy: <Tx id={txid} />.</li>
                ))}
              </ul>
            </div>
          </div>
          {c.miner && (
            <div className="mt-8 border-t border-gray-100 pt-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className={MARK}>Stage 2 · <Term id="miner-median">Miner median</Term></div>
                {dot('miner')}
                <span className={`font-mono text-[12px] ${o.bounded === 1 ? 'text-accent' : 'text-gray-500'}`}>bound {o.bounded === 1 ? 'ON' : 'OFF'}</span>
              </div>
              <div className="mt-2 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <div>
                  <div className={NUM}>{c.miner.state.votes > 0 ? usdPerKas(c.miner.state.median) : '—'}</div>
                  <div className="mt-1 font-mono text-[12px] text-gray-500">
                    {c.miner.state.votes.toLocaleString()} of {c.miner.state.blocks.toLocaleString()} blocks voted · window anchored at DAA {c.miner.state.anchor_daa.toLocaleString()}
                  </div>
                </div>
                <ul className="space-y-2 text-[15px] leading-relaxed text-gray-400">
                  <li>Kaspa miners put a 13-byte KAS/USD vote in their blocks&apos; coinbase payload; a RISC Zero proof over a 6,000-block window posts the median here, verified by the chain.</li>
                  <li>When that median is fresh (under 45 minutes old) and at least half the blocks voted, every refresh is <span className="text-gray-200">clamped to within 5%</span> of it: operators alone cannot move the price past the miners, and miners alone cannot move it past the operators.</li>
                  <li>Otherwise the refresh falls back to the operators&apos; median and records <span className="font-mono">bounded = 0</span>: miner silence never freezes the feed.</li>
                </ul>
              </div>
            </div>
          )}
          {status?.staleOracle && (
            <p className="mt-4 border-l border-gray-500 pl-4 text-[14.5px] text-gray-300">
              Last refresh ~{hoursSilent}h ago. After 1 hour of silence anyone may freeze the oracle, which stops minting until operators refresh it.
            </p>
          )}
          {status && status.staleOracle === false && silence != null && silence < STALE_DAA && (
            <div className="mt-4 font-mono text-[12px] text-gray-500">Last refresh ~{hoursSilent}h ago.</div>
          )}
        </Section>

        {/* ── § 4 System state ── */}
        <Section mark="4" note={<>System state. {liveKinds.size > 0 ? <>Rows marked &quot;read live&quot; come from the kUSD relay and were re-checked against TN10 {status.checkedAt.slice(11, 19)} UTC: the box&apos;s address commits to the figures shown, it sits under the pinned covenant and it is unspent. Other rows as exported {s.generatedAt}.</> : <>Values as exported {s.generatedAt}.</>} &quot;matches chain&quot; beside a row: that covenant output is still unspent on TN10, so the value is current.</>} className="mt-12">
          <h2 className={H2}>System state</h2>
          <table className="mt-4 w-full border-collapse text-[14px]">
            <thead>
              <tr className="font-mono text-[11.5px] text-gray-500"><th scope="col" className="border-b border-gray-100 pb-2 text-left font-normal">covenant</th><th scope="col" className="border-b border-gray-100 pb-2 text-left font-normal">item</th><th scope="col" className="border-b border-gray-100 pb-2 text-left font-normal">value</th><th scope="col" className="border-b border-gray-100 pb-2 text-right font-normal">on chain</th></tr>
            </thead>
            <tbody className="tabular-nums">
              {covenantRows.map(([title, d, rows]) => rows.map(([k, v], i) => (
                <tr key={`${title}-${k}`} className="border-b border-gray-800 align-baseline">
                  <th scope="row" className="py-2.5 pr-4 text-left font-normal text-gray-100">{i === 0 ? title : ''}</th>
                  <td className="py-2.5 pr-4 text-gray-500">{k}</td>
                  <td className="py-2.5 pr-4 font-mono text-[13.5px] text-gray-100">{v}</td>
                  <td className="py-2.5 text-right">{i === 0 ? d : null}</td>
                </tr>
              )))}
            </tbody>
          </table>
          <details className="mt-4 border-t border-gray-800 pt-3 text-[14.5px] text-gray-400">
            <summary className="cursor-pointer font-mono text-[12px] text-gray-400">What these figures mean</summary>
            <ul className="mt-2 space-y-2 leading-relaxed">
              <li><span className="text-gray-200">kUSD in circulation</span>: every kUSD held by anyone — the $1,000,000 genesis supply minus what the token authority still holds. <span className="text-gray-200">deployer&apos;s test box</span>: one holder box among them, from the deployment. <span className="text-gray-200">unissued supply</span>: what the <Term id="token-authority">token authority</Term> still holds and has never issued; the two always sum to the fixed 1,000,000 kUSD.</li>
              <li><span className="text-gray-200">surplus pot</span>: the protocol&apos;s revenue — PSM fees, interest, the 3% liquidation share — in KAS, under governance.</li>
              <li>The <span className="text-gray-200">mint</span> and <span className="text-gray-200">liquidation</span> prices are identical whenever the price has been steady for an hour: the rate limits only pull them apart during a move (mint lags a rise, liquidation lags a fall), which is what stops one manipulated hour from minting cheap kUSD or triggering liquidations.</li>
            </ul>
          </details>
        </Section>

        {/* ── § 5 Timeline ── */}
        <Section mark="5" note={<>Every transaction, {s.stage}. Newest first. Each link opens the raw transaction on the public TN10 API. Runs of routine events (refreshes, repayments, governance knobs) are folded into one row each — expand to see every transaction.</>} className="mt-12">
          <h2 className={H2}>Every transaction, {s.stage}</h2>
          <input value={logQ} onChange={(e) => setLogQ(e.target.value)} aria-label="Search the transaction log" placeholder="search: liquidation, set_miner, a txid…"
            className={`mt-4 w-full max-w-md ${FIELD}`} />
          <ol className="m-0 mt-6 list-none p-0">
            {visible.map((g, i) => g.kind === 'one'
              ? <TimelineEntry key={`${g.entry.step}-${i}`} e={g.entry} />
              : (
                <li key={`${g.step}-${i}`} className="border-t border-gray-800">
                  <details>
                    <summary className="cursor-pointer py-3 text-[15px] text-gray-300"><span className="text-gray-100">{STEP_LABEL[g.step] || g.step}</span> <span className="font-mono text-[12px] text-gray-500">× {g.entries.length} · {g.entries[g.entries.length - 1] && g.entries[0] ? `${short(g.entries[g.entries.length - 1].txid || '')} … ${short(g.entries[0].txid || '')}` : ''} · expand</span></summary>
                    <ol className="m-0 list-none p-0 pl-4">{g.entries.map((e, k) => <TimelineEntry key={`${e.step}-${k}`} e={e} />)}</ol>
                  </details>
                </li>
              ))}
          </ol>
          {!showAll && !logQ && grouped.length > PAGE_ROWS && (
            <button type="button" onClick={() => setShowAll(true)} className={`mt-4 font-mono text-[13px] ${LINK}`}>Show all {grouped.length} rows</button>
          )}
          {grouped.length === 0 && <p className="mt-4 font-mono text-[13px] text-gray-500">Nothing matches &quot;{logQ}&quot;.</p>}
          {/* Previous deployments: archived on their own page */}
          <p className="mt-8 border-t border-gray-800 pt-4 text-[14.5px] leading-relaxed text-gray-400">
            Changing a covenant&apos;s code means re-creating the whole family. The retired deployments ({retired} captioned transactions: the first Stage 1 family and Phase 5) stay on TN10 as evidence: <Link href="/kusd/history" className={LINK}>history of deployments</Link>.
          </p>
        </Section>

        {/* ── § 6 Metering ── */}
        <Section mark="6" note={<><Term id="compute-mass">Compute mass</Term> against Kaspa&apos;s 500,000 per-transaction cap, measured by the test suite.</>} className="mt-12">
          <h2 className={H2}>Cost on chain</h2>
          <Facts className="mt-4" rows={s.metering.map((m) => [m.path, `${m.pctCap}% of the cap`, `${m.computeMass.toLocaleString('en-US')} compute mass`])} />
        </Section>

        {/* ── § 7 Verify ── */}
        <Section mark="7" note={<>Don&apos;t trust this page. Verify it. Source, whitepaper and the full evidence archive (MIT): <a href={s.repo} target="_blank" rel="noreferrer" className={`break-all ${LINK}`}>{s.repo.replace('https://', '')}</a></>} className="mt-12 mb-4">
          <h2 className={H2}>Don&apos;t trust this page. Verify it.</h2>
          <div className="mt-4 grid gap-10 lg:grid-cols-2">
            <div className="min-w-0 text-[15px] leading-relaxed text-gray-400">
              <ol className="m-0 list-none space-y-3 p-0">
                <li><span className={MARK}>Step 1 · the boxes are real.</span><div>Open any covenant id&apos;s current output on the explorer (links on the right) and check it is unspent and carries that covenant id — the same check the status dots make.</div></li>
                <li><span className={MARK}>Step 2 · the code is what the chain runs.</span><div>From the repo, reproduce each genesis covenant id from its source and bootstrap: <code className="font-mono text-[12.5px] text-gray-200">argentc genesis verify … --require-argent --source</code> (the exact commands are in <code className="font-mono text-[12.5px]">contracts/v2/deploy/genesis-*/README.md</code>).</div></li>
                <li><span className={MARK}>Step 3 · the rules hold.</span><div>One command reruns all {s.tests.count} tests, attack regressions included:</div></li>
              </ol>
              <pre className="mt-2 overflow-x-auto border border-gray-800 bg-panel p-3 font-mono text-[12.5px] text-gray-200">{s.tests.command}</pre>
              <p className="mt-3">
                Why the values aren&apos;t read live: every kUSD <Term id="covenant">covenant</Term> output is a <Term id="script-hash">script hash</Term>, and its state sits
                inside the hashed script until it is spent. This page shows the exported values and checks the outputs
                are still unspent. To check a value yourself, compile the covenant template with that state and compare
                its script hash with the output on chain; the repo&apos;s tests and evidence show how.
              </p>
            </div>
            <div className="min-w-0">
              <div className={MARK}>covenant ids (testnet-10)</div>
              <ul className="m-0 mt-2 list-none p-0">
                {['oracle', 'miner', 'psm', 'surplus', 'budget', 'authority', 'vault'].filter((n) => c[n]).map((n) => (
                  <li key={n} className="border-t border-gray-800 py-2.5 font-mono text-[12px]">
                    <span className="text-gray-400">{n}</span>
                    <div className="flex items-start">
                      <span className="break-all text-gray-100">{c[n].covid}</span>
                      <CopyHex value={c[n].covid} />
                    </div>
                    <a href={txUrl(c[n].txid)} target="_blank" rel="noreferrer" className={`text-gray-500 ${LINK}`}>current output: {short(c[n].txid)}:{c[n].index} · explorer</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>
      </main>
    </>
  );
}
