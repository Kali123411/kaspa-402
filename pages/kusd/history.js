import Head from 'next/head';
import Link from 'next/link';
import snapshot from '../../public/kusd/snapshot.json';
import { TimelineEntry, FAMILY_LABEL } from '../../components/kusd/Timeline';

// The retired covenant families (UI/UX brief, Phase 3 /kusd): kept as evidence, off the live page's main scroll.
export default function KusdHistory() {
  const previous = snapshot.timeline.filter((e) => e.family !== 'stage1').slice().reverse();
  const families = [...new Set(previous.map((e) => e.family))];
  return (
    <>
      <Head>
        <title>kUSD on testnet-10 — history of deployments | k402</title>
        <meta name="description" content="The retired kUSD covenant families on Kaspa testnet-10: every captioned transaction of the first Stage 1 deployment and of Phase 5, kept as evidence." />
      </Head>
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
        <Link href="/kusd" className="font-mono text-sm text-gray-400 hover:text-neon-purple">← kUSD, the live family</Link>
        <h1 className="mt-4 font-orbitron text-3xl font-bold text-white">History of deployments</h1>
        <p className="mt-3 max-w-2xl text-sm text-gray-400">
          Changing a covenant&apos;s code means re-creating the whole family, so every re-genesis leaves the old one on chain. These are the retired
          families ({families.map((f) => FAMILY_LABEL[f] || f).join(' · ')}): {previous.length} captioned transactions, newest first, each linking to the TN10 API.
          The live family and its risk parameters are on <Link href="/kusd" className="text-neon-purple hover:underline">/kusd</Link>.
        </p>
        <ol className="mt-8 space-y-3">{previous.map((e, i) => <TimelineEntry key={`${e.family}-${e.step}-${i}`} e={e} />)}</ol>
      </main>
    </>
  );
}
