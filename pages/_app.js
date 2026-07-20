import Head from 'next/head';
import '../styles/globals.css';

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
            KASPA<span className="text-gray-600">·</span>X402
          </a>
          <nav className="flex items-center gap-5 font-mono text-[13px] text-gray-400">
            <a href="https://kaspa-x402.org" target="_blank" rel="noopener noreferrer" className="hover:text-teal-400">standard</a>
            <a href="https://github.com/elldeeone/kaspa-x402" target="_blank" rel="noopener noreferrer" className="hover:text-teal-400">SDK</a>
            <a href="/validate" className="hover:text-teal-400">validate</a>
          </nav>
        </header>
        <Component {...pageProps} />
      </div>
    </>
  );
}
