import Head from 'next/head';
import { GLOSSARY } from '../lib/glossary.mjs';
import { H1, LINK, PAGE, Section } from '../components/Ledger';

export default function Glossary() {
  return (
    <>
      <Head>
        <title>Glossary — k402</title>
        <meta name="description" content="Every term the k402, kUSD and market pages use, defined in one sentence each: covenant, box, PSM, rate index, lock time, x402 v2, PAYMENT-REQUIRED, payTo, scheme, sompi and more." />
      </Head>
      <main className={`${PAGE} py-12 lg:py-16`}>
        <Section mark="0" note="One sentence each. On the other pages a dotted underline marks a term's first use; hover or focus it for the same line." top={false}>
          <h1 className={H1}>The words on this site</h1>
        </Section>
        <Section mark="1" note={`${GLOSSARY.length} terms, in the order the pages meet them.`} className="mt-10">
          <dl>
            {GLOSSARY.map((g) => (
              <div key={g.id} id={g.id} className="grid scroll-mt-20 gap-1 border-b border-gray-800 py-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
                <dt className="font-mono text-[14px] text-gray-100"><a href={`#${g.id}`} className={LINK}>{g.term}</a></dt>
                <dd className="min-w-0 text-[15px] leading-relaxed text-gray-200">{g.short}</dd>
                {g.long && <dd className="min-w-0 lg:col-start-2 text-[14px] leading-relaxed text-gray-400">{g.long}</dd>}
              </div>
            ))}
          </dl>
        </Section>
      </main>
    </>
  );
}
