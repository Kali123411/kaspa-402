import Head from 'next/head';
import Link from 'next/link';
import snapshot from '../../public/kusd/snapshot.json';
import { TimelineEntry, FAMILY_LABEL } from '../../components/kusd/Timeline';
import { H1, LINK, PAGE, Section } from '../../components/Ledger';

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
      <main className={`${PAGE} py-12 lg:py-16`}>
        <Section mark="0" note={<Link href="/kusd" className={LINK}>← kUSD, the live family</Link>} top={false}>
          <h1 className={H1}>History of deployments</h1>
          <p className="mt-4 max-w-[70ch] text-[16px] leading-relaxed text-gray-300">
            Changing a covenant&apos;s code means re-creating the whole family, so every re-genesis leaves the old one on chain. These are the retired
            families ({families.map((f) => FAMILY_LABEL[f] || f).join(' · ')}): {previous.length} captioned transactions, newest first, each linking to the TN10 API.
            The live family and its risk parameters are on <Link href="/kusd" className={LINK}>/kusd</Link>.
          </p>
        </Section>
        <Section mark="1" note="Every transaction of the retired families." className="mt-10">
          <ol className="m-0 list-none p-0">{previous.map((e, i) => <TimelineEntry key={`${e.family}-${e.step}-${i}`} e={e} />)}</ol>
        </Section>
      </main>
    </>
  );
}
