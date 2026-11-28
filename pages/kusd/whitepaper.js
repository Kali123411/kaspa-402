// pages/kusd/whitepaper.js — the kUSD whitepaper, published as written. The text lives verbatim in
// content/kusd/WHITEPAPER.md (from kaspa-402/kusd-framework, docs/WHITEPAPER.md) and is parsed at build time; this page
// only lays it out on the ledger. Its own "Important notice" closes the page, unfolded.
import Head from 'next/head';
import Link from 'next/link';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseWhitepaper } from '../../lib/kusd/whitepaper.mjs';
import { H1, H2, LINK, MARK, PAGE, Section, notice } from '../../components/Ledger';
import { KusdIcons } from '../../components/kusd/KusdMark';

export async function getStaticProps() {
  return { props: { doc: parseWhitepaper(readFileSync(path.join(process.cwd(), 'content/kusd/WHITEPAPER.md'), 'utf8')) } };
}

const BODY = 'max-w-[70ch] text-[16px] leading-relaxed text-gray-300';

function Runs({ runs }) {
  return runs.map((r, i) => (r.strong ? <strong key={i} className="font-medium text-gray-100">{r.text}</strong> : <span key={i}>{r.text}</span>));
}

function Table({ head, rows }) {
  return (
    <div className="mt-5 max-w-[900px] overflow-x-auto">
      <table className="w-full border-collapse text-[14.5px]">
        <thead>
          <tr className="font-mono text-[11.5px] text-gray-500">
            {head.map((c, i) => <th key={i} scope="col" className="border-b border-gray-100 pb-2 pr-4 text-left align-bottom font-normal">{c}</th>)}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-gray-800 align-baseline">
              {r.map((c, j) => (j === 0
                ? <th key={j} scope="row" className="py-2.5 pr-4 text-left font-normal text-gray-100">{c}</th>
                : <td key={j} className="py-2.5 pr-4 text-gray-300">{c}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Block({ b }) {
  if (b.type === 'ul') {
    return (
      <ul className={`mt-4 list-disc space-y-2 pl-5 marker:text-gray-600 ${BODY}`}>
        {b.items.map((runs, i) => <li key={i}><Runs runs={runs} /></li>)}
      </ul>
    );
  }
  if (b.type === 'table') return <Table head={b.head} rows={b.rows} />;
  if (b.type === 'img') {
    return (
      <figure className="mt-6 max-w-[760px]">
        {/* the figure as drawn in the paper: a light diagram, 760 × 412 */}
        <img src={`/kusd/${b.src}`} alt={b.alt} width={760} height={412} className="h-auto w-full border border-gray-800" />
      </figure>
    );
  }
  return <p className={`mt-4 ${BODY}`}><Runs runs={b.inline} /></p>;
}

export default function KusdWhitepaper({ doc }) {
  const summary = doc.sections[0]?.blocks.find((b) => b.type === 'p');
  const description = summary ? summary.inline.map((r) => r.text).join('') : doc.title;
  return (
    <>
      <Head>
        <title>{`${doc.title} | k402`}</title>
        <meta name="description" content={description} />
      </Head>
      <KusdIcons />
      <main className={`${PAGE} py-12 lg:py-16`}>
        <Section mark="0" note={<Link href="/kusd" className={LINK}>← kUSD</Link>} top={false}>
          <h1 className={H1}>{doc.title}</h1>
          <p className={`mt-4 ${MARK}`}>{doc.byline}</p>
        </Section>
        {doc.sections.map((s, i) => (
          <Section key={s.heading} id={s.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')} mark={String(i + 1)} className="mt-12">
            <h2 className={H2}>{s.heading}</h2>
            {s.heading === 'Important notice'
              ? <div className={`mt-4 max-w-[70ch] ${notice} leading-relaxed`}>{s.blocks.map((b, j) => (b.type === 'p' ? <p key={j} className="m-0"><Runs runs={b.inline} /></p> : <Block key={j} b={b} />))}</div>
              : s.blocks.map((b, j) => <Block key={j} b={b} />)}
          </Section>
        ))}
      </main>
    </>
  );
}
