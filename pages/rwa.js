// pages/rwa.js — the tokenized-asset showcase. A fictional share register (Tessera's TESS) that lives in Kaspa
// covenants on testnet-10: the live holder boxes (public/rwa/showcase.json, exported from the UTXO set and checked
// unspent by /api/rwa/status), the rules the chain enforces with the transactions that proved them, the trades that
// settled in one transaction, and proof of reserves. Fictional, testnet-only, not a securities offering.
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import snap from '../public/rwa/showcase.json';
import { Dot } from '../components/kusd/LiveBadge';
import { Tx, short } from '../components/kusd/Timeline';
import { auditOf, fastestSettlement, T_PLUS_ONE_S } from '../lib/rwa/status.mjs';
import { Facts, H1, H2, H3, LINK, MARK, NUM, PAGE, Section, notice } from '../components/Ledger';

const n = (x) => x.toLocaleString('en-US');
const tkas = (sompi) => `${(sompi / 1e8).toLocaleString('en-US', { maximumFractionDigits: 2 })} tKAS`;
const ADDR = (a) => `https://api-tn10.kaspa.org/addresses/${a}/utxos`;
const OUTCOME = {
  accepted: { glyph: '✓', text: 'accepted on chain', cls: 'text-accent' },
  'network-rejected': { glyph: '✕', text: 'rejected by the network', cls: 'text-gray-100' },
  refused: { glyph: '—', text: 'refused before signing', cls: 'text-gray-400' },
};
const DOT_TEXT = { current: 'unspent', moved: 'moved', unknown: 'not checked', loading: 'checking' };

/** a transaction reference: a link while the public API still serves it, else the full id to look up on a node */
function Proof({ txid, onExplorer }) {
  if (!txid) return null;
  if (onExplorer) return <Tx id={txid} />;
  return <span className="font-mono text-[12.5px] text-gray-500" title={`${txid} — older than the public API keeps; the boxes it created are checkable by address`}>{short(txid)} · pruned</span>;
}

export default function Rwa() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    let live = true;
    fetch('/api/rwa/status').then((r) => (r.ok ? r.json() : null)).catch(() => null).then((j) => { if (live) setStatus(j); });
    return () => { live = false; };
  }, []);
  const audit = auditOf(snap.holders);
  const fastest = fastestSettlement(snap.settlements);
  const refusedMoves = snap.rules.flatMap((r) => r.proofs).filter((p) => p.outcome !== 'accepted').length;
  const backed = snap.attestation.supply === audit.circulating;
  const desc = 'A fictional share register living in Kaspa covenants on testnet-10: transfer-agent approval, freezes, clawback, capped issuance, dividends and one-transaction trades, each enforced by the chain.';

  return (
    <>
      <Head>
        <title>Tokenized assets on Kaspa · testnet-10 | k402</title>
        <meta name="description" content={desc} />
      </Head>
      <main className={`${PAGE} py-12 lg:py-16`}>
        <Section mark="0" top={false} note={<>Real-world assets · testnet-10<div className={`mt-3 ${notice} text-[12.5px]`}>Fictional instrument on Kaspa testnet-10. Reference infrastructure, not a securities offering: no real shares, no real value, nothing to buy.</div></>}>
          <h1 className={H1}>A share register that lives in Kaspa covenants.</h1>
          <p className="mt-6 max-w-[62ch] text-[clamp(17px,1.25vw,20px)] leading-relaxed text-gray-300">
            Tessera Holdings Class A (TESS) is a fictional stock issued on testnet-10. Each holding is a covenant box, and
            the rules a transfer agent and an issuer would enforce live in the box&apos;s own script: who may receive shares,
            freezes, court-ordered clawback, capped issuance, dividends. The network checks them on every transaction.
          </p>
          <p className="mt-4 max-w-[62ch] text-[16px] leading-relaxed text-gray-400">
            A trade is one transaction: shares and payment move together or not at all. The fastest recorded trade was accepted
            by the network {fastest.seconds} seconds after it was submitted. US equities settle T+1, a full business day later.
          </p>
          <div className="mt-10 grid max-w-[900px] grid-cols-2 gap-8 sm:grid-cols-4">
            {[[n(snap.instrument.authorized), 'shares authorized'], [n(snap.holders.length), 'holder boxes on chain'], [`${fastest.seconds} s`, 'fastest trade to acceptance'], [String(refusedMoves), 'forbidden moves stopped']].map(([v, k]) => (
              <div key={k} className="border-t border-gray-100 pt-3"><div className={NUM}>{v}</div><div className={`mt-2 ${MARK}`}>{k}</div></div>
            ))}
          </div>
        </Section>

        <Section mark="1" note={<>The register, read from the UTXO set: each row is an unspent covenant box whose address commits to its holder and share count. Exported {snap.generatedAt.replace('T', ' ').slice(0, 16)} UTC from a {snap.node} node; the dot re-checks the box on testnet-10 now.</>} className="mt-12">
          <h2 className={H2}>Shareholder register</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr className="font-mono text-[11.5px] text-gray-500">
                  <th scope="col" className="border-b border-gray-100 pb-2 text-left font-normal">holder</th>
                  <th scope="col" className="border-b border-gray-100 pb-2 text-right font-normal">shares</th>
                  <th scope="col" className="hidden border-b border-gray-100 pb-2 pl-6 text-left font-normal sm:table-cell">box</th>
                  <th scope="col" className="border-b border-gray-100 pb-2 text-right font-normal">on chain</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {snap.holders.map((h, i) => {
                  const st = status ? status.boxes[i] : 'loading';
                  return (
                    <tr key={`${h.txid}:${h.index}`} className="border-b border-gray-800 align-baseline">
                      <th scope="row" className="py-2.5 pr-4 text-left font-normal text-gray-100">{h.label}{h.minter ? <span className="ml-2 font-mono text-[11.5px] text-gray-500">unissued</span> : null}</th>
                      <td className="py-2.5 pr-4 text-right font-mono text-[13.5px] text-gray-100">{n(h.amount)}</td>
                      <td className="hidden py-2.5 pl-6 pr-4 sm:table-cell"><a href={ADDR(h.address)} target="_blank" rel="noreferrer" className={`font-mono text-[12.5px] ${LINK}`} title={h.address}>{short(h.txid)}:{h.index}</a></td>
                      <td className="py-2.5 text-right"><span className="inline-flex items-center gap-1.5"><Dot state={st === 'current' ? 'current' : st === 'moved' ? 'moved' : st === 'loading' ? 'loading' : 'unknown'} /><span className="font-mono text-[11px] text-gray-500">{DOT_TEXT[st]}</span></span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Facts className="mt-6 max-w-[760px]" rows={[
            ['unissued (minter note)', n(audit.minter), 'what the issuers may still mint'],
            ['held by investors', n(audit.circulating), 'every non-minter box above'],
            ['total', n(audit.total), audit.total === snap.instrument.authorized ? 'equals the authorized supply exactly' : 'does not reconcile'],
            ['custodian attests', n(snap.attestation.supply), backed ? `fully backed: matches the shares held (epoch ${snap.attestation.epoch})` : 'does not match the shares held'],
          ]} />
        </Section>

        <Section mark="2" note="Each rule is part of the covenant script, so the network enforces it. Next to each: the transactions that proved it, including attempts the rules stopped." className="mt-12">
          <h2 className={H2}>Rules the chain enforces</h2>
          <div className="mt-6 grid gap-10 lg:grid-cols-2">
            {snap.rules.map((r) => (
              <div key={r.id} id={r.id} className="scroll-mt-20 border-t border-gray-100 pt-4">
                <h3 className={H3}>{r.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-gray-400">{r.plain}</p>
                <ul className="m-0 mt-3 list-none space-y-2 p-0">
                  {r.proofs.map((p) => (
                    <li key={p.label} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2 text-[14px]">
                      <span className={`font-mono ${OUTCOME[p.outcome].cls}`} aria-hidden>{OUTCOME[p.outcome].glyph}</span>
                      <span className="text-gray-300">{p.label} <span className="text-gray-500">— {OUTCOME[p.outcome].text}, {p.date}{p.note ? `: ${p.note}` : ''}.</span> <Proof txid={p.txid} onExplorer={p.onExplorer} /></span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <Section mark="3" note="Delivery versus payment: one Kaspa transaction carries the shares to the buyer and the price to the seller, with the transfer agent's eligibility check inside it." className="mt-12">
          <h2 className={H2}>Trades, settled in one transaction</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr className="font-mono text-[11.5px] text-gray-500">
                  {['settled (UTC)', 'trade', 'price', 'to acceptance', 'transaction'].map((c, i) => <th key={c} scope="col" className={`border-b border-gray-100 pb-2 font-normal ${i >= 2 && i <= 3 ? 'text-right' : 'text-left'} ${i === 4 ? 'pl-6' : ''}`}>{c}</th>)}
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {[...snap.settlements].reverse().map((s) => (
                  <tr key={s.txid} className="border-b border-gray-800 align-baseline">
                    <td className="py-2.5 pr-4 font-mono text-[12.5px] text-gray-400">{s.settled_at.replace(/^\w+ /, '').replace(' UTC', '')}</td>
                    <td className="py-2.5 pr-4 text-gray-100">{n(s.qty)} TESS · {s.seller_firm} → {s.buyer_firm}</td>
                    <td className="py-2.5 pr-4 text-right font-mono text-[13px] text-gray-300">{tkas(s.price_sompi)}</td>
                    <td className="py-2.5 pr-4 text-right font-mono text-[13px] text-accent">{s.submit_to_chain_accepted_s} s</td>
                    <td className="py-2.5 pl-6"><Proof txid={s.txid} onExplorer={s.onExplorer} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 max-w-[70ch] text-[14.5px] leading-relaxed text-gray-400">
            For comparison, T+1 settlement takes {n(T_PLUS_ONE_S)} seconds. These trades also settled on a Saturday: the chain has no closing bell.
            The payment leg is testnet KAS today; paying in <Link href="/kusd" className={LINK}>kUSD</Link> is the next step.
          </p>
        </Section>

        <Section mark="4" note="What this is, and how to check it yourself." className="mt-12 mb-4">
          <h2 className={H2}>Check it yourself</h2>
          <div className="mt-4 grid gap-10 lg:grid-cols-2">
            <ol className="m-0 list-none space-y-3 p-0 text-[15px] leading-relaxed text-gray-300">
              <li><span className={MARK}>Step 1</span><div>Open any box in the register. The link asks the public testnet-10 API for the unspent outputs at that box&apos;s address; the outpoint shown is among them.</div></li>
              <li><span className={MARK}>Step 2</span><div>The address is the hash of the covenant script with the holder and share count inside it, so a different holder or count would be a different address. Tessera&apos;s exporter compiles each claimed holding and keeps only the boxes a node reports.</div></li>
              <li><span className={MARK}>Step 3</span><div>Add the rows. Unissued plus held must equal {n(snap.instrument.authorized)}, and the held total must equal what the custodian attests.</div></li>
            </ol>
            <div className="text-[15px] leading-relaxed text-gray-400">
              <p>Most proofs above date from August 2026. The public API has since pruned those transactions, so they show as pruned with their full id on hover; the boxes they created are still unspent and checkable by address, and any archival node can replay them. The rows marked with a link were made today on a 2.1.0 node.</p>
              <p className="mt-3">This is reference infrastructure on a test network. A real offering needs a licensed transfer agent, a regulated venue and legal review; none of that is implied here.</p>
            </div>
          </div>
        </Section>
      </main>
    </>
  );
}
