import Head from 'next/head';
import '../styles/globals.css';
import { BRAND, DISCLAIMER_BANNER, EXTERNAL } from '../lib/brand.mjs';
import ExternalLink from '../components/ExternalLink';
import SiteFooter from '../components/SiteFooter';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" key="icon" />
      </Head>
      <div className="min-h-screen font-sans bg-gray-950 text-white transition-colors">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-4 px-6 h-14 border-b border-gray-100 bg-gray-950 lg:px-14">
          <a href="/" className="font-orbitron text-[26px] font-bold tracking-[-0.03em] text-gray-100">
            {BRAND}
          </a>
          <nav className="flex items-center gap-5 font-mono text-[13px] text-gray-400">
            <a href="/kusd" className="hover:text-accent">kUSD</a>
            <a href="/market" className="hover:text-accent">market</a>
            <a href="/validate" className="hover:text-accent">validate</a>
            <a href="/private" className="hidden hover:text-accent sm:inline">private</a>
            <ExternalLink href={EXTERNAL.standard} className="hidden hover:text-accent md:inline" domainClassName="text-gray-600">standard</ExternalLink>
            <ExternalLink href={EXTERNAL.sdk} className="hidden hover:text-accent md:inline" domainClassName="text-gray-600">SDK</ExternalLink>
          </nav>
        </header>
        <div role="note" className="border-b border-gray-800 px-6 py-1.5 font-mono text-[11.5px] text-gray-500 lg:px-14">
          {DISCLAIMER_BANNER} <a href="/get-started" className="ml-2 text-accent underline decoration-gray-700 underline-offset-4 hover:decoration-accent">Get set up on testnet-10 →</a>
        </div>
        <Component {...pageProps} />
        <SiteFooter />
      </div>
    </>
  );
}
