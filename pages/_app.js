import Head from 'next/head';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen font-sans bg-gray-950 text-white transition-colors">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-4 px-6 h-14 border-b border-teal-400/20 bg-gray-950/75 backdrop-blur-md dark:shadow-[0_1px_24px_rgba(0,240,255,0.10)]">
          <a href="/" className="flex items-center gap-2.5 font-orbitron font-bold tracking-[0.12em] text-teal-400 neon-text">
            <span className="w-2 h-2 rounded-full bg-teal-400 shadow-glow-cyan animate-pulse" />
            K402<span className="text-gray-600">·</span>EXCHANGE
          </a>
          <nav className="flex items-center gap-5 font-mono text-[13px] text-gray-400">
            <a href="https://github.com/Kali123411/k402/blob/main/PROTOCOL.md" target="_blank" rel="noopener noreferrer" className="hover:text-teal-400">protocol</a>
            <a href="https://github.com/Kali123411/k402" target="_blank" rel="noopener noreferrer" className="hover:text-teal-400">github</a>
            <a href="https://kaspa-app.vercel.app" target="_blank" rel="noopener noreferrer" className="hover:text-teal-400">kaspa lab ↗</a>
          </nav>
        </header>
        <Component {...pageProps} />
      </div>
    </>
  );
}
