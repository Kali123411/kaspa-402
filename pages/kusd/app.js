import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import useKusd from '../../components/kusd/app/useKusd';
import useWalletSession from '../../components/kusd/app/useWalletSession';
import StatusStrip from '../../components/kusd/app/StatusStrip';
import WalletTab from '../../components/kusd/app/WalletTab';
import SwapTab from '../../components/kusd/app/SwapTab';
import VaultTab from '../../components/kusd/app/VaultTab';
import ActivityTab from '../../components/kusd/app/ActivityTab';
import ReviewSheet, { useReview } from '../../components/kusd/app/ReviewSheet';
import { H1, LINK, PAGE, Section } from '../../components/Ledger';
import KusdMark, { KusdIcons } from '../../components/kusd/KusdMark';

const TABS = ['Wallet', 'Swap', 'Vault', 'Activity'];

export default function KusdApp() {
  const [tab, setTab] = useState('Wallet');
  const [wallet0, setWallet0] = useState(null);   // what useKusd follows; useWalletSession owns the open key
  const k = useKusd(wallet0);
  // the open key leaves memory after 15 minutes without input, including while the page is hidden
  const { secret, wallet, open, lock } = useWalletSession(k);
  useEffect(() => { setWallet0(wallet); }, [wallet]);
  const review = useReview(k, secret, wallet?.xonly);

  return (
    <>
      <Head>
        <title>kUSD app · TN10 | k402</title>
        <meta name="description" content="Swap KAS for kUSD and run vaults on Kaspa TN10, signed and broadcast from your browser." />
      </Head>
      <KusdIcons />
      <main className={`${PAGE} py-12 lg:py-16`}>
          <Section mark="0" top={false} note={<><Link href="/kusd" className={LINK}>← kUSD overview</Link><div className="mt-2">Every transaction is built and signed in this browser and broadcast straight to Kaspa. No server holds a key.</div></>}>
            <h1 className={`${H1} flex items-center gap-4`}><KusdMark size={56} />kUSD app</h1>
            <p className="mt-5 max-w-[62ch] text-[16px] leading-relaxed text-gray-300">
              Swap KAS for kUSD through the PSM, borrow against KAS in a vault, and send kUSD. Holding kUSD here also makes this wallet an
              agent on the <Link href="/market" className={LINK}>Kaspa Agent Market</Link>.
            </p>
            <div className="mt-6 min-h-[2.75rem]"><StatusStrip k={k} /></div>
          </Section>
          <Section mark="1" note="Wallet, swap, vault, activity." className="mt-12 mb-4">
            <nav className="flex gap-6 border-b border-gray-100" aria-label="kUSD app sections" role="tablist">
              {TABS.map((t) => (
                <button key={t} type="button" role="tab" onClick={() => setTab(t)} aria-selected={tab === t} aria-current={tab === t ? 'page' : undefined}
                  className={`-mb-px border-b-2 px-1 py-2 font-mono text-[14px] ${tab === t ? 'border-accent text-gray-100' : 'border-transparent text-gray-500 hover:text-gray-100'}`}>
                  {t}
                </button>
              ))}
            </nav>
            <div className="mt-6 min-h-[24rem]">
              {tab === 'Wallet' && <WalletTab k={k} secret={secret} wallet={wallet} onOpen={open} onLock={lock} review={review} />}
              {tab === 'Swap' && <SwapTab k={k} wallet={wallet} review={review} />}
              {tab === 'Vault' && <VaultTab k={k} wallet={wallet} review={review} />}
              {tab === 'Activity' && <ActivityTab version={review.sheet?.txid} owner={wallet?.xonly} />}
            </div>
          </Section>
          <ReviewSheet review={review} />
      </main>
    </>
  );
}
