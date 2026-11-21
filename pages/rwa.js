// pages/rwa.js — the tokenized-asset showcase. TESS3 is a fictional share register on the KCC-20 standard: every
// holding is an unmodified KCC-20 box whose owner is a compliance script (holder + transfer agent, or 2 of 3 issuers),
// recognised by an independent indexer and settled against kUSD in one transaction. public/rwa/tess3.json is exported
// from the UTXO set; /api/rwa/status re-checks each box. TESS v1/v2 (August 2026, pre-KCC-20) follow as history.
// Fictional, testnet-only, not a securities offering.
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import snap from '../public/rwa/showcase.json';
import t3 from '../public/rwa/tess3.json';
import { Dot } from '../components/kusd/LiveBadge';
import { Tx, short } from '../components/kusd/Timeline';
import { auditOf, fastestSettlement, T_PLUS_ONE_S } from '../lib/rwa/status.mjs';
import { Facts, H1, H2, H3, LINK, MARK, NUM, PAGE, Section, notice } from '../components/Ledger';

const n = (x) => x.toLocaleString('en-US');
const usd = (c) => `$${(c / 100).toFixed(2)}`;
const tkas = (sompi) => `${(sompi / 1e8).toLocaleString('en-US', { maximumFractionDigits: 2 })} tKAS`;
const ADDR = (a) => `https://api-tn10.kaspa.org/addresses/${a}/utxos`;
const OUTCOME = {
  accepted: { glyph: '✓', text: 'accepted on chain', cls: 'text-accent' },
  'network-rejected': { glyph: '✕', text: 'rejected by the network', cls: 'text-gray-100' },
  refused: { glyph: '—', text: 'refused before signing', cls: 'text-gray-400' },
  verified: { glyph: '✓', text: 'checked by an independent indexer', cls: 'text-accent' },
};
const DOT_TEXT = { current: 'unspent', moved: 'moved', unknown: 'not checked', loading: 'checking' };

/** a transaction reference: a link while the public API serves it; a rejected one was never recorded; an old one was pruned */
function Proof({ txid, onExplorer, outcome }) {
  if (!txid) return null;
  if (onExplorer) return <Tx id={txid} />;
  if (outcome === 'network-rejected') return <span className="font-mono text-[12.5px] text-gray-500" title={txid}>{short(txid)} · never recorded</span>;
  return <span className="font-mono text-[12.5px] text-gray-500" title={`${txid} — older than the public API keeps; the boxes it created are checkable by address`}>{short(txid)} · pruned</span>;
}

function Rules({ rules }) {
  return (
    <div className="mt-6 grid gap-10 lg:grid-cols-2">
      {rules.map((r) => (
        <div key={r.id} id={r.id} className="scroll-mt-20 border-t border-gray-100 pt-4">
          <h3 className={H3}>{r.title}</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-gray-400">{r.plain}</p>
          <ul className="m-0 mt-3 list-none space-y-2 p-0">
            {r.proofs.map((p) => (
              <li key={p.label} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2 text-[14px]">
                <span className={`font-mono ${OUTCOME[p.outcome].cls}`} aria-hidden>{OUTCOME[p.outcome].glyph}</span>
                <span className="text-gray-300">{p.label} <span className="text-gray-500">— {OUTCOME[p.outcome].text}, {p.date}{p.note ? `: ${p.note}` : ''}.</span> <Proof txid={p.txid} onExplorer={p.onExplorer} outcome={p.outcome} /></span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function StatusDot({ st }) {
  const s = st === 'current' ? 'current' : st === 'moved' ? 'moved' : st === 'loading' ? 'loading' : 'unknown';
  return <span className="inline-flex items-center gap-1.5"><Dot state={s} /><span className="font-mono text-[11px] text-gray-500">{DOT_TEXT[st]}</span></span>;
}

export default function Rwa() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    let live = true;
    fetch('/api/rwa/status').then((r) => (r.ok ? r.json() : null)).catch(() => null).then((j) => { if (live) setStatus(j); });
    return () => { live = false; };
  }, []);
  const v1Audit = auditOf(snap.holders);
  const v1Fastest = fastestSettlement(snap.settlements);
  const trade = t3.settlements.find((s) => s.currency === 'kUSD');
  const k = t3.kascov || {};
  const stopped = t3.rules.flatMap((r) => r.proofs).filter((p) => p.outcome === 'refused' || p.outcome === 'network-rejected').length;
  const desc = 'A fictional share register on the KCC-20 standard: holdings owned by compliance scripts that require the transfer agent, recognised by an independent indexer, traded for kUSD in one Kaspa transaction. Testnet-10.';

  return (
    <>
      <Head>
        <title>Tokenized assets on Kaspa · testnet-10 | k402</title>
        <meta name="description" content={desc} />
      </Head>
      <main className={`${PAGE} py-12 lg:py-16`}>
        <Section mark="0" top={false} note={<>Real-world assets · testnet-10<div className={`mt-3 ${notice} text-[12.5px]`}>Fictional instrument on Kaspa testnet-10. Reference infrastructure, not a securities offering: no real shares, no real value, nothing to buy.</div></>}>
          <h1 className={H1}>A share register on the KCC‑20 standard, with the transfer agent built into ownership.</h1>
          <p className="mt-6 max-w-[62ch] text-[clamp(17px,1.25vw,20px)] leading-relaxed text-gray-300">
            TESS3 is a fictional stock on testnet-10. Each holding is a standard KCC-20 token box, so any KCC-20 wallet or
            indexer can read it. What makes it a security is who owns the box: not a key, but a small compliance script that
            needs both the holder and the transfer agent to sign, or two of three issuers for a court-ordered recovery.
          </p>
          <p className="mt-4 max-w-[62ch] text-[16px] leading-relaxed text-gray-400">
            Trades settle in <Link href="/kusd" className={LINK}>kUSD</Link>: the shares and the dollars move in the same
            transaction, and the transfer agent&apos;s signature covers both.
          </p>
          <div className="mt-10 grid max-w-[900px] grid-cols-2 gap-8 sm:grid-cols-4">
            {[[n(t3.instrument.authorized), 'shares, fixed at genesis'], [k.status === 'verified' ? 'KCC-20' : '—', 'verified by an independent indexer'], [trade ? usd(trade.price_cents) : '—', 'kUSD trade, one transaction'], [String(stopped), 'forbidden moves stopped']].map(([v, l]) => (
              <div key={l} className="border-t border-gray-100 pt-3"><div className={NUM}>{v}</div><div className={`mt-2 ${MARK}`}>{l}</div></div>
            ))}
          </div>
        </Section>

        <Section mark="1" note={<>The register, read from the UTXO set: every row is an unspent KCC-20 box whose address commits to its owner and share count. Exported {t3.generatedAt.replace('T', ' ').slice(0, 16)} UTC from a {t3.node} node; the dot re-checks the box on testnet-10 now.</>} className="mt-12">
          <h2 className={H2}>TESS3 shareholder register</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr className="font-mono text-[11.5px] text-gray-500">
                  <th scope="col" className="border-b border-gray-100 pb-2 text-left font-normal">holder</th>
                  <th scope="col" className="border-b border-gray-100 pb-2 text-right font-normal">shares</th>
                  <th scope="col" className="hidden border-b border-gray-100 pb-2 pl-6 text-left font-normal sm:table-cell">box</th>
                  <th scope="col" className="hidden border-b border-gray-100 pb-2 pl-6 text-left font-normal lg:table-cell">owned by script</th>
                  <th scope="col" className="border-b border-gray-100 pb-2 text-right font-normal">on chain</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {t3.holders.map((h, i) => (
                  <tr key={`${h.txid}:${h.index}`} className="border-b border-gray-800 align-baseline">
                    <th scope="row" className="py-2.5 pr-4 text-left font-normal text-gray-100">{h.firm}</th>
                    <td className="py-2.5 pr-4 text-right font-mono text-[13.5px] text-gray-100">{n(h.amount)}</td>
                    <td className="hidden py-2.5 pl-6 pr-4 sm:table-cell"><a href={ADDR(h.address)} target="_blank" rel="noreferrer" className={`font-mono text-[12.5px] ${LINK}`} title={h.address}>{short(h.txid)}:{h.index}</a></td>
                    <td className="hidden py-2.5 pl-6 pr-4 font-mono text-[12px] text-gray-500 lg:table-cell" title={`owner = P2SH commitment ${h.owner_commitment}`}>{h.owner_commitment.slice(0, 10)}…</td>
                    <td className="py-2.5 text-right"><StatusDot st={status?.v3 ? status.v3.boxes[i] : 'loading'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-8 grid gap-10 lg:grid-cols-2">
            <Facts rows={[
              ['total', n(t3.audit.total), t3.audit.total === t3.instrument.authorized ? 'equals the 1,000,000 created at genesis' : 'does not reconcile'],
              ['held by the treasury', n(t3.audit.treasury), 'unissued shares and the clawed-back holding'],
              ['terms commitment', `${t3.instrument.terms.slice(0, 16)}…`, 'on every box: which transfer agent and issuers govern it'],
              ['covenant', `${t3.instrument.covid.slice(0, 16)}…`, 'the token family'],
            ]} />
            <div className="border-t border-gray-100 pt-4">
              <h3 className={H3}>Independent check: kascov</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-gray-400">
                kascov indexes every KCC-20 token on testnet-10 by matching the standard program. Its record for this covenant,
                fetched {k.checked_at ? k.checked_at.replace('T', ' ').slice(0, 16) : '—'} UTC:
              </p>
              <Facts className="mt-3" rows={[
                ['status', k.status || '—', k.template || ''],
                ['standard', k.kcc ? `KCC-${k.kcc}` : '—', k.conformant ? `conformant, ${k.nonconformities?.length ? `${k.nonconformities.length} nonconformities` : 'no nonconformities'}` : 'not conformant'],
                ['supply', k.supply != null ? n(k.supply) : '—', `held by scripts: ${k.held_by_script != null ? n(k.held_by_script) : '—'}`],
              ]} />
            </div>
          </div>
        </Section>

        <Section mark="2" note="Each rule is enforced by the token program, the compliance script, or the transfer agent's signature. Next to each: the transactions that proved it, including attempts it stopped." className="mt-12">
          <h2 className={H2}>Rules, and what enforces them</h2>
          <Rules rules={t3.rules} />
        </Section>

        <Section mark="3" note="Delivery versus payment in kUSD: the seller's TESS3 box and the buyer's kUSD box are spent in the same transaction." className="mt-12">
          <h2 className={H2}>A trade, settled in kUSD</h2>
          {trade ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-[14px]">
                <thead>
                  <tr className="font-mono text-[11.5px] text-gray-500">
                    {['trade', 'price', 'settlement', 'transaction'].map((c, i) => <th key={c} scope="col" className={`border-b border-gray-100 pb-2 font-normal ${i === 1 ? 'text-right' : 'text-left'} ${i >= 2 ? 'pl-6' : ''}`}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-800 align-baseline">
                    <td className="py-2.5 pr-4 text-gray-100">{n(trade.qty)} TESS3 · {trade.seller_firm} → {trade.buyer_firm}</td>
                    <td className="py-2.5 pr-4 text-right font-mono text-[13px] text-accent">{usd(trade.price_cents)} kUSD</td>
                    <td className="py-2.5 pl-6 pr-4 text-gray-300">one transaction, accepted on submission</td>
                    <td className="py-2.5 pl-6"><Proof txid={trade.txid} onExplorer={trade.onExplorer} outcome="accepted" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}
          <p className="mt-4 max-w-[70ch] text-[14.5px] leading-relaxed text-gray-400">
            Open the transaction: its first outputs are the shares, under the TESS3 covenant, and its later outputs are the
            dollars, under kUSD&apos;s. T+1 settlement takes {n(T_PLUS_ONE_S)} seconds; this one had no settlement window at all.
          </p>
        </Section>

        <Section mark="4" note="The first version, built in August 2026 before KCC-20 was final. Its boxes are still live; wallets and indexers can't read them as tokens, which is why TESS3 exists." className="mt-12">
          <h2 className={H2}>History: TESS v1 and v2</h2>
          <p className="mt-4 max-w-[70ch] text-[15px] leading-relaxed text-gray-400">
            TESS put the same rules inside its own token program: an on-chain freeze flag, a minter note capping issuance, snapshot
            dividends, and, in v2, Merkle-proof allowlisting with no transfer agent online. It still runs: its register reconciles to
            {' '}{n(v1Audit.total)} shares across {snap.holders.length} boxes, and its fastest trade, paid in testnet KAS, was accepted
            {' '}{v1Fastest.seconds} seconds after matching.
          </p>
          <details className="mt-4 border-t border-gray-800 pt-3">
            <summary className={`cursor-pointer ${MARK}`}>The v1/v2 rules and trades</summary>
            <Rules rules={snap.rules} />
            <div className="mt-8 overflow-x-auto">
              <table className="w-full border-collapse text-[14px]">
                <tbody className="tabular-nums">
                  {[...snap.settlements].reverse().map((s) => (
                    <tr key={s.txid} className="border-b border-gray-800 align-baseline">
                      <td className="py-2 pr-4 font-mono text-[12.5px] text-gray-400">{s.settled_at.replace(/^\w+ /, '').replace(' UTC', '')}</td>
                      <td className="py-2 pr-4 text-gray-200">{n(s.qty)} TESS · {s.seller_firm} → {s.buyer_firm}</td>
                      <td className="py-2 pr-4 text-right font-mono text-[13px] text-gray-300">{tkas(s.price_sompi)}</td>
                      <td className="py-2 pr-4 text-right font-mono text-[13px] text-accent">{s.submit_to_chain_accepted_s} s</td>
                      <td className="py-2 pl-6"><Proof txid={s.txid} onExplorer={s.onExplorer} outcome="accepted" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 font-mono text-[12px] text-gray-500">v1 register: {status ? `${status.counts?.current ?? 0} of ${snap.holders.length} boxes unspent now` : 'checking…'}</p>
          </details>
        </Section>

        <Section mark="5" note="What this is, and how to check it yourself." className="mt-12 mb-4">
          <h2 className={H2}>Check it yourself</h2>
          <div className="mt-4 grid gap-10 lg:grid-cols-2">
            <ol className="m-0 list-none space-y-3 p-0 text-[15px] leading-relaxed text-gray-300">
              <li><span className={MARK}>Step 1</span><div>Open a box in the register: the link lists the unspent outputs at that address on the public testnet-10 API.</div></li>
              <li><span className={MARK}>Step 2</span><div>The box&apos;s address is the hash of the standard KCC-20 program with the state inside it: the share count, the owner (a compliance script&apos;s hash) and the terms commitment. A different owner or count is a different address.</div></li>
              <li><span className={MARK}>Step 3</span><div>Look the covenant up on kascov, an indexer we don&apos;t run: it identifies the token as KCC-20 from the program alone.</div></li>
            </ol>
            <div className="text-[15px] leading-relaxed text-gray-400">
              <p>Freezes are the transfer agent declining to sign, as with a real transfer agent: a policy, recorded in its audit log, not a flag on chain. Clawback is on chain: the issuers&apos; path in every compliance script.</p>
              <p className="mt-3">This is reference infrastructure on a test network. A real offering needs a licensed transfer agent, a regulated venue and legal review; none of that is implied here.</p>
            </div>
          </div>
        </Section>
      </main>
    </>
  );
}
