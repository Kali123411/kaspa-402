import Head from 'next/head';
import { GLOSSARY } from '../lib/glossary.mjs';

export default function Glossary() {
  return (
    <>
      <Head>
        <title>Glossary — k402</title>
        <meta name="description" content="Every term the k402, kUSD and market pages use, defined in one sentence each: covenant, box, PSM, rate index, lock time, x402 v2, PAYMENT-REQUIRED, payTo, scheme, sompi, Groth16, shielded pool and more." />
      </Head>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-teal-400">k402 · glossary</p>
        <h1 className="mt-4 font-orbitron text-3xl font-bold tracking-tight">The words on this site</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-gray-300">
          One sentence each. On the other pages a dotted underline marks a term&apos;s first use; hover or focus it for the same line, or follow it here for the detail.
        </p>
        <dl className="mt-10 divide-y divide-gray-800">
          {GLOSSARY.map((g) => (
            <div key={g.id} id={g.id} className="scroll-mt-20 py-4">
              <dt className="font-mono text-[14px] text-teal-400"><a href={`#${g.id}`} className="hover:underline">{g.term}</a></dt>
              <dd className="mt-1 text-[14.5px] leading-relaxed text-gray-200">{g.short}</dd>
              {g.long && <dd className="mt-1 text-[13.5px] leading-relaxed text-gray-400">{g.long}</dd>}
            </div>
          ))}
        </dl>
      </main>
    </>
  );
}
