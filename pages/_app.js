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
      </Head>
      <div className="min-h-screen font-sans bg-gray-950 text-white transition-colors">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-4 px-6 h-14 border-b border-teal-400/20 bg-gray-950/75 backdrop-blur-md dark:shadow-[0_1px_24px_rgba(255,255,255,0.10)]">
          <a href="/" className="flex items-center gap-2.5 font-orbitron font-bold tracking-[0.12em] text-teal-400 neon-text">
            <span className="w-2 h-2 rounded-full bg-teal-400 shadow-glow-cyan animate-pulse" />
            {BRAND}
          </a>
          <nav className="flex items-center gap-5 font-mono text-[13px] text-gray-400">
            <a href="/kusd" className="hover:text-teal-400">kUSD</a>
            <a href="/market" className="hover:text-teal-400">market</a>
            <a href="/validate" className="hover:text-teal-400">validate</a>
            <a href="/private" className="hidden hover:text-teal-400 sm:inline">private</a>
            <ExternalLink href={EXTERNAL.standard} className="hidden hover:text-teal-400 md:inline" domainClassName="text-gray-600">standard</ExternalLink>
            <ExternalLink href={EXTERNAL.sdk} className="hidden hover:text-teal-400 md:inline" domainClassName="text-gray-600">SDK</ExternalLink>
          </nav>
        </header>
        <div role="note" className="border-b border-amber-400/15 bg-amber-400/5 px-6 py-1.5 text-center font-mono text-[11.5px] text-amber-200/80">
          {DISCLAIMER_BANNER}
        </div>
        <Component {...pageProps} />
        <SiteFooter />
      </div>
    </>
  );
}
