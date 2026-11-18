// Be the agent: pick a listing, ask for the quote, see every check, pay from the browser wallet inside the
// operator's bounds, present the proof, read the answer. Order of operations (the page's own invariant):
//   quote → checkPolicy → ledger.reserve → review.start [the wallet signs; the sheet broadcasts]
//   → ledger.settle(txid) → present(PAYMENT-SIGNATURE) → ledger.settle(http) → result.
// What each move of the review sheet means for the reservation is decided by lib/kusd/market/flow.mjs
// (followSheet): voided only when nothing can have been signed; kept once sending began.
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, XCircle } from 'lucide-react';
import { input, primary, secondary, usdText, kasText, Panel, Row, txUrl } from '../app/ui';
import { UnlockForm, storedWallet, WALLET_KEY } from '../app/WalletTab';
import { writeStored } from '../app/useKusd';
import { quote, checkPolicy, present, QuoteError, PaymentSent } from '../../../lib/kusd/market/payer.mjs';
import { followSheet } from '../../../lib/kusd/market/flow.mjs';
import { fetchProvider } from '../../../lib/kusd/market/registry.mjs';
import { SpendRefused } from '../../../lib/kusd/market/spend.mjs';
import { NETWORK_TESTNET } from '../../../lib/kusd/market/x402.mjs';
import { LiveDot } from './MarketBoard';
import { REGISTRY } from './useMarket';

const HOLDER_VALUE_SOMPI = 150_000_000;
const SEND_FEE_SOMPI = 10_000_000;
const SAMPLE = 'Kaspa is a proof-of-work blockDAG with one-second blocks and fast confirmation for everyday payments. kUSD is a USD stablecoin living in its covenants.';
const when = (t) => (t ? `${new Date(t * 1000).toISOString().replace('T', ' ').slice(0, 16)} UTC` : '—');

const Check = ({ ok, children }) => (
  <li className="flex items-start gap-2 text-sm">
    {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />}
    <span className={ok ? 'text-gray-200' : 'text-red-300'}>{children}</span>
  </li>
);

/** The provider behind a listing: every listing it has, what it has earned, the key and the address its boxes sit at. */
function ProviderDetail({ listing, fromSnapshot }) {
  const [p, setP] = useState(null);
  useEffect(() => {
    setP(null);
    if (!listing || fromSnapshot) return undefined;
    let stop = false;
    fetchProvider(REGISTRY, listing.payee_pubkey).then((d) => { if (!stop) setP(d); }).catch(() => { if (!stop) setP({ error: true }); });
    return () => { stop = true; };
  }, [listing?.payee_pubkey, fromSnapshot]);
  if (!listing) return null;
  const rep = p?.reputation || listing.reputation || {};
  return (
    <details className="rounded-lg border border-gray-800 bg-black/20 p-3 text-xs text-gray-400">
      <summary className="cursor-pointer text-gray-300">About this provider</summary>
      <div className="mt-2 space-y-1">
        <Row k="listed key" v={<span className="break-all">{listing.payee_pubkey}</span>} />
        {p?.address && <Row k="boxes sit at" v={<span className="break-all">{p.address}</span>} />}
        <Row k="settled" v={`${usdText(rep.settled_cents || 0)} over ${rep.closes || 0} report(s)`} />
        <Row k="first / last" v={`${when(rep.first_settled)} / ${when(rep.last_settled)}`} />
        <Row k="listings" v={(p?.listings || [listing]).map((l) => `${l.capability} ${usdText(l.price_cents)}`).join(' · ')} />
        {p?.error && <p className="text-amber-200">The registry did not answer for this provider; showing the listing's own figures.</p>}
      </div>
    </details>
  );
}

export default function AgentConsole({ k, session, review, listing, live, authority, policy, ledger, onLedgerChange, fromSnapshot }) {
  const { secret, wallet, open, lock } = session;
  const [text, setText] = useState(SAMPLE);
  const [q, setQ] = useState(null);           // the checked quote
  const [refusal, setRefusal] = useState(null); // {code, reason, nothingMoved}
  const [busy, setBusy] = useState(null);     // 'quoting' | 'presenting'
  const [result, setResult] = useState(null); // {status, json, attempts, txid, cents, failed?}
  const pending = useRef(null);               // {id, quote, body, ledger, txid, sending, finished}
  const [stored, setStored] = useState(null); // the sealed keystore blob exists in this browser (read after mount: no SSR mismatch)
  useEffect(() => { setStored(Boolean(storedWallet())); }, [wallet]);

  useEffect(() => { setQ(null); setRefusal(null); setResult(null); }, [listing?.payee_pubkey, listing?.capability]);

  const forget = () => {
    writeStored(WALLET_KEY, null);   // the sealed keystore leaves this browser, as the wallet tab's own button does
    setStored(false);
    lock();
  };

  // follow the review sheet; the pending flow carries its own ledger so an idle lock mid-flow cannot lose it
  useEffect(() => {
    const p = pending.current;
    const a = followSheet(p, review.sheet);
    if (a.type === 'noop') return;
    const led = p.ledger;
    if (a.type === 'sending') { p.sending = true; return; }
    if (a.type === 'void') {
      led.void(p.id);
      onLedgerChange();
      if (a.reason) setRefusal({ code: 'build', reason: a.reason, nothingMoved: true });
      pending.current = null;
      return;
    }
    if (a.type === 'unknown') {
      led.settle(p.id, { http: 0 });   // counted: the wallet may have broadcast before it failed
      onLedgerChange();
      p.finished = true;
      setRefusal({ code: 'unknown', reason: `${a.reason || 'the wallet failed while sending'} — the box may exist: check the kUSD app's Activity tab and the ledger below before paying again`, nothingMoved: false });
      return;
    }
    // settle: the box was broadcast
    p.txid = a.txid;
    led.settle(p.id, { txid: a.txid });
    onLedgerChange();
    setBusy('presenting');
    present({ quote: p.quote, body: p.body, txid: a.txid, payer: wallet?.xonly })
      .then((r) => {
        led.settle(p.id, { http: r.status });
        setResult({ ...r, txid: a.txid, cents: p.quote.cents });
      })
      .catch((e) => {
        if (e instanceof PaymentSent) {
          led.settle(p.id, { http: e.status });
          setResult({ status: e.status, json: e.json, attempts: e.attempts, txid: e.txid, cents: e.cents, failed: e.message });
        } else {
          led.settle(p.id, { http: 0 });
          setResult({ status: 0, json: null, attempts: 0, txid: a.txid, cents: p.quote.cents, failed: e.message });
        }
      })
      .finally(() => { onLedgerChange(); setBusy(null); p.finished = true; pending.current = null; setQ(null); });
  }, [review.sheet, onLedgerChange, wallet?.xonly]);

  const body = { text, max_words: 40 };

  const getQuote = async () => {
    setBusy('quoting'); setRefusal(null); setResult(null); setQ(null);
    try {
      setQ(await quote({ listing, body, authority, network: NETWORK_TESTNET }));
    } catch (e) {
      setRefusal({ code: e instanceof QuoteError ? e.code : 'error', reason: e.reason || e.message, nothingMoved: true });
    } finally {
      setBusy(null);
    }
  };

  const pay = () => {
    setRefusal(null); setResult(null);
    let id;
    try {
      checkPolicy(policy, q, ledger.status(policy));
      id = ledger.reserve(policy, { cents: q.cents, provider: q.provider, capability: q.capability });
    } catch (e) {
      setRefusal({ code: e instanceof SpendRefused ? e.code : 'error', reason: e.reason || e.message, nothingMoved: true });
      onLedgerChange();
      return;
    }
    onLedgerChange();
    pending.current = { id, quote: q, body, ledger, txid: null, sending: false, finished: false };
    review.start('send', { holders: k.chain.holders, to: q.payTo, cents: q.cents }, `Pay ${usdText(q.cents)} to ${listing.capability} (${q.provider.slice(0, 8)}…)`);
  };

  const kusd = (k.chain?.holders || []).reduce((s, h) => s + h.state.amount, 0);
  const canQuote = Boolean(listing) && !fromSnapshot && !busy;
  const canPay = Boolean(q) && !fromSnapshot && !busy && !pending.current && Boolean(ledger) && k.canAct?.ok && kusd >= (q?.cents || 0) && !review.sheet;

  return (
    <Panel title="Buy a call — be the agent">
      <ol className="flex flex-wrap gap-2 font-mono text-[11px] uppercase tracking-wider">
        {[['1 · wallet', Boolean(wallet)], ['2 · pick a listing', Boolean(wallet && listing)], ['3 · quote & pay', Boolean(q)]].map(([label, done], i, arr) => {
          const current = !done && (i === 0 || arr[i - 1][1]);
          return <li key={label} className={`rounded-full border px-2.5 py-0.5 ${done ? 'border-emerald-400/50 text-emerald-300' : current ? 'border-neon-purple text-neon-purple' : 'border-gray-800 text-gray-600'}`}>{label}{done ? ' ✓' : ''}</li>;
        })}
      </ol>
      {stored === false && (
        <div className="rounded-lg border border-neon-purple/40 bg-neon-purple/5 p-4 text-sm text-gray-300">
          <p>Step 1 is a browser wallet. It never leaves this browser: a key sealed with your passphrase, funded with free testnet-10 KAS, holding a few cents of kUSD.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <a href="/kusd/app" className="rounded-lg bg-neon-purple px-4 py-2 text-sm font-semibold text-black hover:bg-neon-purple/90">Create a wallet in the kUSD app →</a>
            <a href="/get-started" className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:border-neon-purple/60">Get test funds first</a>
          </div>
        </div>
      )}
      {stored && (!secret || !wallet) && <UnlockForm k={k} onOpen={open} onForget={forget} />}
      {wallet && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
            <span>wallet <span className="font-mono text-gray-200">{wallet.xonly.slice(0, 8)}…</span> · <span className="font-mono text-gray-200">{usdText(kusd)}</span> · {kasText((k.coins || []).reduce((s, c) => s + c.entry.amount, 0))}</span>
            <button type="button" className="text-gray-400 hover:text-white" onClick={lock}>Lock</button>
          </div>
          {!listing && <p className="text-sm text-gray-400">Pick a listing on the board.</p>}
          {listing && (
            <>
              <div className="rounded-lg border border-gray-800 bg-black/30 p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-white">{listing.capability}</span>
                  <span className="font-mono text-neon-purple" title={`${listing.price_cents}¢`}>{usdText(listing.price_cents)}/call</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
                  <span className="break-all font-mono">{listing.endpoint}</span>
                  {!fromSnapshot && <LiveDot probe={live[listing.endpoint]} />}
                </div>
              </div>
              <ProviderDetail listing={listing} fromSnapshot={fromSnapshot} />
              <label className="block text-xs text-gray-400">
                Request (the text to {listing.capability})
                <textarea className={`${input} mt-1 min-h-[88px]`} value={text} onChange={(e) => setText(e.target.value)} />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={secondary} onClick={getQuote} disabled={!canQuote}>{busy === 'quoting' ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Asking…</> : 'Quote'}</button>
                <button type="button" className={primary} onClick={pay} disabled={!canPay}>{q ? `Pay ${usdText(q.cents)}` : 'Pay'}</button>
              </div>
              {fromSnapshot && <p className="text-xs text-amber-200">The registry is unreachable from this browser; quoting and paying are off until it is back.</p>}
              {q && (
                <ul className="space-y-1 rounded-lg border border-gray-800 bg-black/30 p-3">
                  <Check ok>the provider answered 402 with an x402 <span className="font-mono">PAYMENT-REQUIRED</span> for <span className="font-mono">{usdText(q.cents)}</span></Check>
                  <Check ok>asset is our kUSD family <span className="font-mono">{authority.slice(0, 8)}…</span>, network {q.network}</Check>
                  <Check ok>pays to the listed key tweaked by offer <span className="font-mono">{q.paymentId}</span>: <span className="font-mono">{q.payTo.slice(0, 12)}…</span> (recomputed here)</Check>
                  <Check ok={policy.cap(null) == null || q.cents <= policy.cap(null)}>operator ceiling {policy.cap(null) == null ? 'none' : usdText(policy.cap(null))}</Check>
                  <li className="pt-1 text-xs text-gray-400">Outlay if you pay: {usdText(q.cents)} + {kasText(HOLDER_VALUE_SOMPI)} locked in the box (the provider&apos;s to recover) + up to {kasText(SEND_FEE_SOMPI)} fee. The quote expires {Math.max(0, Math.round((q.expiresAt - Date.now()) / 1000))}s from now.</li>
                </ul>
              )}
              {wallet && q && kusd < q.cents && <p className="text-xs text-amber-200">Not enough kUSD in this wallet ({usdText(kusd)}); buy some on the kUSD app first.</p>}
            </>
          )}
          {refusal && (
            <div className={`rounded-lg border p-3 text-sm ${refusal.nothingMoved ? 'border-red-900/60 bg-red-950/30 text-red-200' : 'border-amber-700/60 bg-amber-950/20 text-amber-100'}`}>
              <span className={`font-mono text-xs uppercase tracking-wider ${refusal.nothingMoved ? 'text-red-400' : 'text-amber-300'}`}>{refusal.nothingMoved ? 'refused' : 'outcome unknown'} · {refusal.code}</span>
              <div className="mt-1">{refusal.reason}</div>
              <div className="mt-1 text-xs opacity-80">{refusal.nothingMoved ? 'Nothing was built or broadcast.' : 'Counted in the ledger as paid.'}</div>
            </div>
          )}
          {busy === 'presenting' && <p className="inline-flex items-center gap-2 text-sm text-gray-300"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Box broadcast; presenting <span className="font-mono">PAYMENT-SIGNATURE</span> and waiting for the provider&apos;s node to see it…</p>}
          {result && (
            <div className={`rounded-lg border p-3 text-sm ${result.failed ? 'border-amber-700/60 bg-amber-950/20' : 'border-emerald-900/60 bg-emerald-950/20'}`}>
              <div className="font-mono text-xs uppercase tracking-wider text-gray-400">{result.failed ? 'paid, not served' : 'served'}</div>
              {result.json?.summary && <p className="mt-1 text-gray-100">{result.json.summary}</p>}
              {result.failed && <p className="mt-1 text-amber-200">{result.failed}</p>}
              <div className="mt-2 space-y-1">
                <Row k="paid" v={usdText(result.cents)} />
                <Row k="KAS in the box" v={`${kasText(HOLDER_VALUE_SOMPI)} (the provider's to recover)`} />
                <Row k="network fee" v={`up to ${kasText(SEND_FEE_SOMPI)}`} />
                <Row k="HTTP" v={`${result.status} after ${result.attempts} attempt(s)`} />
                <Row k="box" v={<a href={txUrl(result.txid)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-neon-purple hover:underline">{result.txid.slice(0, 16)}… <ExternalLink className="h-3 w-3" aria-hidden /></a>} />
              </div>
              <p className="mt-2 text-xs text-gray-400">Watch the settlements feed: the provider reports this box to the registry, which checks it on its node.</p>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
