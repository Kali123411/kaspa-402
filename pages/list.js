import Head from 'next/head';
import { LINKS, MARKET_NAME } from '../lib/story';
import ExternalLink from '../components/ExternalLink';
import SubmitForm from '../components/SubmitForm';

export default function ListService() {
  return (
    <>
      <Head>
        <title>List your service — k402</title>
        <meta name="description" content="List a KAS-paid x402 v2 endpoint in the k402 directory: one unpaid 402 probe is the only gate. kUSD-priced services list on the Kaspa Agent Market." />
      </Head>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-teal-400">k402 · for operators</p>
        <h1 className="mt-4 font-orbitron text-3xl font-bold tracking-tight">List your service</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-gray-300">
          Ship an x402 v2 endpoint with <ExternalLink href="https://www.npmjs.com/package/@kaspa-x402/server">@kaspa-x402/server</ExternalLink> and submit it below.
          It appears only once it has answered a live, unpaid 402 probe: that gate is the anti-spam rule, and any agent can repeat the same check before paying.
          Not sure it will pass? <a href="/validate" className="text-teal-400 hover:underline">Validate it first</a>.
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-gray-400">
          To sell for kUSD, list on the <a href="/market" className="text-teal-400 hover:underline">{MARKET_NAME}</a> instead: a listing there is signed by your payee key and costs 10¢ of kUSD through k402 (<ExternalLink href={LINKS.k402Protocol}>protocol</ExternalLink>).
        </p>
        <div className="mt-8"><SubmitForm /></div>
      </main>
    </>
  );
}
