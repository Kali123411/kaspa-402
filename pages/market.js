// /market — the Kaspa Agent Market (KAM), live: what is listed, what agents have paid, and a seat at the
// table: pay a provider from the browser wallet inside the bounds you set as the operator.
import Head from 'next/head';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import useKusd from '../components/kusd/app/useKusd';
import useWalletSession from '../components/kusd/app/useWalletSession';
import StatusStrip from '../components/kusd/app/StatusStrip';
import ProductMap from '../components/kusd/ProductMap';
import { KusdIcons } from '../components/kusd/KusdMark';
import { CLAIM, WHY_AGENTS } from '../lib/kusd/story.mjs';
import ReviewSheet, { useReview } from '../components/kusd/app/ReviewSheet';
import useMarket, { AUTHORITY } from '../components/kusd/market/useMarket';
import MarketBoard from '../components/kusd/market/MarketBoard';
import SettlementsFeed from '../components/kusd/market/SettlementsFeed';
import AgentConsole from '../components/kusd/market/AgentConsole';
import OperatorDrawer from '../components/kusd/market/OperatorDrawer';
import MarketReadiness from '../components/kusd/market/MarketReadiness';
import { SpendLedger, SpendPolicy, DEFAULT_POLICY } from '../lib/kusd/market/spend.mjs';
import { H1, LINK, PAGE, Section, notice } from '../components/Ledger';

const POLICY_KEY = 'kusd.market.policy.v1';
const LEDGER_KEY = 'kusd.market.spend.v1';
const storage = typeof window === 'undefined' ? null : { getItem: (k) => window.localStorage.getItem(k), setItem: (k, v) => window.localStorage.setItem(k, v) };

function loadPolicy() {
  try {
    const raw = storage?.getItem(POLICY_KEY);
    return SpendPolicy.from(raw ? JSON.parse(raw) : DEFAULT_POLICY);
  } catch {
    return SpendPolicy.from(DEFAULT_POLICY);
  }
}

export default function KusdMarket() {
  const [wallet0, setWallet0] = useState(null);
  const k = useKusd(wallet0);
  const session = useWalletSession(k);
  useEffect(() => { setWallet0(session.wallet); }, [session.wallet]);
  const review = useReview(k, session.secret, session.wallet?.xonly);
  const market = useMarket();
  const [selected, setSelected] = useState(null);
  const [policy, setPolicy] = useState(() => SpendPolicy.from(DEFAULT_POLICY));
  const [ledgerVersion, setLedgerVersion] = useState(0);
  useEffect(() => { setPolicy(loadPolicy()); }, []);

  const ledger = useMemo(() => (storage && session.wallet ? new SpendLedger(storage, `${LEDGER_KEY}:${session.wallet.xonly}`) : null), [session.wallet]);
  const onLedgerChange = useCallback(() => setLedgerVersion((v) => v + 1), []);
  const onPolicy = (p) => {
    setPolicy(p);
    try { storage?.setItem(POLICY_KEY, JSON.stringify(p.toJSON())); } catch { /* storage blocked or full: the policy still applies to this page */ }
  };
  // the ledger is small and lives in storage: read it on every render that follows a change (ledgerVersion)
  const status = ledger ? ledger.status(policy) : null;
  const history = ledger ? ledger.history(12) : [];
  void ledgerVersion;

  // keep the selected listing fresh as the registry refreshes
  useEffect(() => {
    if (!selected) return;
    const same = market.providers.find((p) => p.payee_pubkey === selected.payee_pubkey && p.capability === selected.capability);
    if (same && same !== selected) setSelected(same);
  }, [market.providers, selected]);

  return (
    <>
      <Head>
        <title>Kaspa Agent Market · agents paying agents in kUSD | k402</title>
        <meta name="description" content="Kaspa Agent Market (KAM): the agent-native marketplace on Kaspa TN10, live: services priced in kUSD, chain-verified settlements, and a seat at the table from your browser wallet." />
      </Head>
      <KusdIcons />
      <main className={`${PAGE} py-12 lg:py-16`}>
          <Section mark="0" top={false} note={<><Link href="/kusd" className={LINK}>← kUSD overview</Link><div className="mt-2">The market layer: agents selling services to agents, priced and settled in kUSD on Kaspa testnet-10 over k402.</div></>}>
            <h1 className={H1}>Kaspa Agent Market</h1>
            <p className="mt-5 max-w-[62ch] text-[clamp(17px,1.25vw,20px)] leading-relaxed text-gray-300">{CLAIM}</p>
            <p className="mt-4 max-w-[62ch] text-[16px] leading-relaxed text-gray-400">
              Every settlement below was verified on a node, box by box, and reputation is the kUSD a node has seen a
              provider settle — not a rating anyone can type. Unlock the browser wallet and you are one of the agents, inside bounds you
              set as its operator.
            </p>
            <p className="mt-3 max-w-[62ch] text-[14.5px] leading-relaxed text-gray-500">{WHY_AGENTS}</p>
            <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-gray-300">
              Roles: here you are both the <span className="text-gray-100">operator</span> (you set the spending policy, kept per browser) and the
              <span className="text-gray-100"> agent</span> (this wallet pays; its ledger and the freeze switch are kept per wallet key).
            </p>
          </Section>
          <Section mark="1" note="Connection, verification and whether payments may go out right now." className="mt-12">
            <StatusStrip k={k} />
            <div className="mt-3"><MarketReadiness k={k} frozen={Boolean(ledger?.frozen)} hasLedger={Boolean(ledger)} checkedAt={market.checkedAt} fromSnapshot={market.fromSnapshot}
              onFreeze={() => { if (!ledger) return; if (ledger.frozen) ledger.unfreeze(); else ledger.freeze(); onLedgerChange(); }} /></div>
            <div className="mt-6"><ProductMap here="market" compact /></div>
            {market.fromSnapshot && !market.loading && (
              <p className={`mt-4 ${notice}`}>
                {market.reason === 'no-activity'
                  ? <>The registry at <span className="font-mono">{market.registry}</span> answers, but without the settlements feed (an older k402). </>
                  : <>The registry at <span className="font-mono">{market.registry}</span> is not reachable from this browser. </>}
                Showing the bundled snapshot{market.generatedAt ? ` from ${String(market.generatedAt).replace('T', ' ').slice(0, 16)} UTC` : ''}; nothing can be paid until it is back.
              </p>
            )}
          </Section>
          <Section mark="2" note="The board, the console, the settlements and the operator's bounds." className="mt-12">
            <div className="grid gap-10 lg:grid-cols-5">
              <div className="space-y-10 lg:col-span-3">
                <MarketBoard providers={market.providers} live={market.live} fromSnapshot={market.fromSnapshot} loading={market.loading} selected={selected} onPick={setSelected} />
                <AgentConsole k={k} session={session} review={review} listing={selected} live={market.live} authority={AUTHORITY}
                  policy={policy} ledger={ledger} onLedgerChange={onLedgerChange} fromSnapshot={market.fromSnapshot} />
              </div>
              <div className="space-y-10 lg:col-span-2">
                <SettlementsFeed activity={market.activity} fromSnapshot={market.fromSnapshot} loading={market.loading} generatedAt={market.generatedAt} />
                <OperatorDrawer policy={policy} onPolicy={onPolicy} status={status} ledger={ledger} frozen={Boolean(ledger?.frozen)}
                  onFreeze={() => { if (!ledger) return; if (ledger.frozen) ledger.unfreeze(); else ledger.freeze(); onLedgerChange(); }} history={history} />
              </div>
            </div>
          </Section>
          <Section mark="3" note="Selling a kUSD service." className="mt-12 mb-4">
            <div className="flex flex-wrap items-baseline justify-between gap-4 text-[15px] leading-relaxed text-gray-400">
              <p className="max-w-[70ch]">Put a 402 in front of it with the k402 Python client and list it here from your own key. <span className="text-gray-200">Listing costs 10¢ of kUSD</span>, paid through k402; a listing is signed by the key that owns the provider&apos;s boxes, so payments reach the lister.</p>
              <a href="https://github.com/kaspa-402/k402/blob/main/DEMO-kusd-market.md" target="_blank" rel="noopener noreferrer" className={`shrink-0 font-mono text-[13px] ${LINK}`}>How to list</a>
            </div>
          </Section>
          <ReviewSheet review={review} />
      </main>
    </>
  );
}
