import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import useKusd from '../../components/kusd/app/useKusd';
import useWalletSession from '../../components/kusd/app/useWalletSession';
import StatusStrip from '../../components/kusd/app/StatusStrip';
import WalletTab from '../../components/kusd/app/WalletTab';
import SwapTab from '../../components/kusd/app/SwapTab';
import VaultTab from '../../components/kusd/app/VaultTab';
import ActivityTab from '../../components/kusd/app/ActivityTab';
import ReviewSheet, { useReview } from '../../components/kusd/app/ReviewSheet';

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
      <main className="min-h-screen bg-gray-950 font-sans text-gray-100">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
          <Link href="/kusd" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-neon-purple">
            <ArrowLeft className="h-4 w-4" aria-hidden /> kUSD overview
          </Link>
          <h1 className="mt-4 font-orbitron text-3xl font-bold sm:text-4xl">kUSD app</h1>
          <p className="mt-2 text-sm text-gray-400">
            Swap KAS for kUSD through the PSM, borrow against KAS in a vault, and send kUSD — every transaction built and signed
            in this browser and broadcast straight to Kaspa. No server holds a key. Holding kUSD here also makes this wallet an
            agent on the <Link href="/market" className="text-neon-purple hover:underline">Kaspa Agent Market</Link>.
          </p>
          <div className="mt-6"><StatusStrip k={k} /></div>
          <nav className="mt-6 grid grid-cols-4 gap-1 rounded-xl border border-gray-800 bg-gray-900/60 p-1" aria-label="kUSD app sections">
            {TABS.map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} aria-current={tab === t ? 'page' : undefined}
                className={`min-w-0 rounded-lg px-2 py-2 text-sm font-semibold ${tab === t ? 'bg-neon-purple text-black' : 'text-gray-300 hover:text-white'}`}>
                {t}
              </button>
            ))}
          </nav>
          <div className="mt-4">
            {tab === 'Wallet' && <WalletTab k={k} secret={secret} wallet={wallet} onOpen={open} onLock={lock} review={review} />}
            {tab === 'Swap' && <SwapTab k={k} wallet={wallet} review={review} />}
            {tab === 'Vault' && <VaultTab k={k} wallet={wallet} review={review} />}
            {tab === 'Activity' && <ActivityTab version={review.sheet?.txid} owner={wallet?.xonly} />}
          </div>
          <ReviewSheet review={review} />
        </div>
      </main>
    </>
  );
}
