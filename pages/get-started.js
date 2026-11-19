import Head from 'next/head';
import { LINKS } from '../lib/story';
import ExternalLink from '../components/ExternalLink';
import { H1, H2, LINK, MARK, PAGE, Section } from '../components/Ledger';

// UI/UX brief, Phase 1 D: the one testnet-10 onboarding guide — faucet → wallet → first 402 payment. Every command here
// is the same one the landing page and /llms.txt publish; nothing on this page is charged for real.
const STEPS = [
  { n: '1', title: 'Get test funds', body: 'A Kaspa key is the only account. Get TKAS for it from the testnet-10 faucet; a few hundred TKAS covers many paid calls at today\'s prices.' },
  { n: '2', title: 'Pick your wallet', body: 'In the browser: the kUSD app creates or imports a key, sealed with a passphrase, and never sends it anywhere — it buys kUSD from the PSM and pays on the market. For an agent: a key file the kx402 (Node) or k402 (Python) client opens.' },
  { n: '3', title: 'Make your first 402 payment', body: 'Call a listed resource unpaid and read the 402, then let the client pay and retry. The result carries the txid; a node, not a receipt, proves the payment.' },
];

export default function GetStarted() {
  return (
    <>
      <Head>
        <title>Get set up on testnet-10 — k402</title>
        <meta name="description" content="From nothing to a paid call on Kaspa testnet-10 in three steps: faucet, wallet, first HTTP 402 payment — in the browser, from Node (kx402) or from Python (k402)." />
      </Head>
      <main className={`${PAGE} py-12 lg:py-16`}>
        <Section mark="0" note="Everything here is testnet-10: the coins are free, the services are real, nothing is for real value." top={false}>
          <h1 className={H1}>Get set up on testnet-10</h1>
          <p className="mt-4 max-w-[62ch] text-[17px] leading-relaxed text-gray-300">Three steps, each ending in something you can run.</p>
        </Section>

        <ol className="m-0 mt-10 list-none p-0">
          {STEPS.map((s) => (
            <li key={s.n} className="grid gap-4 border-t border-gray-100 py-8 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-10">
              <div className={MARK}>§ {s.n}</div>
              <div className="min-w-0">
              <h2 className={H2}>{s.title}</h2>
              <p className="mt-2 max-w-[70ch] text-[15px] leading-relaxed text-gray-300">{s.body}</p>
              {s.n === '1' && (
                <p className="mt-3 text-[14px]"><ExternalLink href={LINKS.faucet}>Open the testnet-10 faucet</ExternalLink> and paste a <span className="font-mono">kaspatest:</span> address from step 2.</p>
              )}
              {s.n === '2' && (
                <ul className="mt-3 space-y-1.5 text-[15px] text-gray-300">
                  <li>· Browser: <a href="/kusd/app" className={LINK}>open the kUSD app</a>, choose <span className="font-mono">Create new</span> in the Wallet tab, copy the <span className="font-mono">kaspatest:</span> address for the faucet.</li>
                  <li>· Agent (Node): <span className="font-mono">npm i kx402 &amp;&amp; npx kx402 fetch-sdk</span>, then point <span className="font-mono">KASPA_X402_FUNDING_WALLET=wallet-key:&lt;path&gt;</span> at a key file.</li>
                  <li>· Agent (Python): <span className="font-mono">pip install k402</span>; a <span className="font-mono">KusdWallet</span> over a key file and the <span className="font-mono">kusd_pay</span> binary.</li>
                </ul>
              )}
              {s.n === '3' && (
                <div className="mt-3 space-y-3">
                  <pre className="overflow-x-auto border border-gray-800 bg-panel p-4 font-mono text-[12.5px] leading-relaxed text-gray-300">{`# see the paywall first: one unpaid request
curl -si https://kaspa-402-summarize.kaspadev.workers.dev/exact | head -5
# HTTP/2 402 Payment Required
# payment-required: eyJ4NDAyVmVyc2lvbiI6Mi...   (base64 JSON: accepts[] = scheme, network, amount, payTo)`}</pre>
                  <pre className="overflow-x-auto border border-gray-800 bg-panel p-4 font-mono text-[12.5px] leading-relaxed text-gray-300">{`// Node · KAS · kx402 (the k402 agent payer)
import { openWallet, payExact, resolveWalletConfig, applyInput } from 'kx402';
const wallet = await openWallet(resolveWalletConfig({ network: 'kaspa:testnet-10' }));
const url = applyInput('https://kaspa-402-summarize.kaspadev.workers.dev/exact', { text });
const r = await payExact(wallet, url, { maxAmountSompi: 300_000_000n });   // 402 → pay → retry; never over 3 KAS
r.status, r.body, r.settlement.transaction                                 // the result and the txid to verify`}</pre>
                  <pre className="overflow-x-auto border border-gray-800 bg-panel p-4 font-mono text-[12.5px] leading-relaxed text-gray-300">{`# Python · kUSD · k402, under an operator policy
from k402 import KusdPayer, KusdWallet, SpendLedger, SpendPolicy
payer = KusdPayer(wallet, registry_url="https://market.kaspa-402.org", network="testnet-10",
                  policy=SpendPolicy.load("policy.json"), ledger=SpendLedger("spend.db"))
route = await payer.pay_best("summarize", json_body={"text": "..."})`}</pre>
                  <p className="text-[13.5px] text-gray-400">
                    Browser instead of code: on <a href="/market" className={LINK}>the market</a>, unlock the wallet from step 2, buy a few cents of kUSD, and pay a listed service from the page.
                  </p>
                </div>
              )}
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-10 border-t border-gray-100 pt-5 text-[15px] text-gray-400">
          Then: <a href="/" className={LINK}>the five agent steps on the landing page</a>, <a href="/validate" className={LINK}>validate your own paywall</a> before listing it, or <a href="/glossary" className={LINK}>the glossary</a> for any word here.
        </p>
      </main>
    </>
  );
}
