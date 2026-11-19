import Head from 'next/head';
import { MARKET_NAME } from '../lib/story';
import { EXTERNAL } from '../lib/brand.mjs';
import ExternalLink from '../components/ExternalLink';
import SubmitForm from '../components/SubmitForm';
import { H1, LINK, PAGE, Section } from '../components/Ledger';

export default function ListService() {
  return (
    <>
      <Head>
        <title>List your service — k402</title>
        <meta name="description" content="List a KAS-paid x402 v2 endpoint in the k402 directory: one unpaid 402 probe is the only gate. kUSD-priced services list on the Kaspa Agent Market." />
      </Head>
      <main className={`${PAGE} py-12 lg:py-16`}>
        <Section mark="0" top={false} note="For operators. One unpaid 402 probe is the only gate; any agent can repeat the same check before paying.">
          <h1 className={H1}>List your service</h1>
          <p className="mt-5 max-w-[62ch] text-[16px] leading-relaxed text-gray-300">
            Ship an x402 v2 endpoint with <ExternalLink href="https://www.npmjs.com/package/@kaspa-x402/server">@kaspa-x402/server</ExternalLink> and submit it below.
            It appears only once it has answered a live, unpaid 402 probe: that gate is the anti-spam rule.
            Not sure it will pass? <a href="/validate" className={LINK}>Validate it first</a>.
          </p>
          <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-gray-400">
            To sell for kUSD, list on the <a href="/market" className={LINK}>{MARKET_NAME}</a> instead: a listing there is signed by your payee key and costs 10¢ of kUSD through k402 (<ExternalLink href={EXTERNAL.k402Repo}>the k402 client</ExternalLink>).
          </p>
        </Section>
        <Section mark="1" note="The listing form. Every field is what an agent reads in the directory." className="mt-12 mb-4">
          <SubmitForm />
        </Section>
      </main>
    </>
  );
}
