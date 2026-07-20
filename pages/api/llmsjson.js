// pages/api/llmsjson.js — the machine-readable catalog (structured), served at /llms.json.
// The x402 v2 marketplace: every listed service as an x402 resource + how an agent pays it.
import { getListings } from '../../lib/registry';
import { capInfo } from '../../lib/catalog';

const SITE = 'https://kaspa-402.org';
const SOMPI = 1e8;
const kas = (s) => { const n = Number(s) / SOMPI; return isFinite(n) ? parseFloat(n.toFixed(8)) : null; };

export default async function handler(req, res) {
  const listings = await getListings();
  const services = listings.map((l) => {
    const info = capInfo(l.capability);
    return {
      serviceName: l.serviceName,
      capability: l.capability || null,
      description: (l.description || '').replace(/\s+/g, ' ').trim() || info.what,
      resource: l.resource,
      scheme: l.scheme,
      network: l.network,
      amount_sompi: String(l.amountSompi),
      price_kas: kas(l.amountSompi),
      asset: 'KAS',
      payTo: l.payTo || null,
      tags: l.tags || [],
      verified: !!l.verified,
      source: l.source || 'seed',
      request_example: info.send || null,
      response_example: info.get || null,
      manifest: l.capability ? `${SITE}/skill/${encodeURIComponent(l.capability)}.md` : null,
    };
  });

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
  res.status(200).json({
    name: 'Kaspa x402 marketplace',
    url: SITE,
    description: 'A directory of x402-payable services settled on Kaspa L1. Built on the Kaspa x402 v2 standard — pay per call, no account, no API key.',
    standard: 'https://kaspa-x402.org',
    protocol: 'x402 v2',
    networks: ['kaspa:testnet-10', 'kaspa:mainnet'],
    pay: {
      client: 'npm i @kaspa-x402/client',
      how: 'Call the resource; on HTTP 402 the client reads the PAYMENT-REQUIRED header, pays on Kaspa (exact or batch-settlement), and retries with PAYMENT-SIGNATURE. Use DirectModeClient.paidFetch(url).',
      docs: 'https://www.npmjs.com/package/@kaspa-x402/client',
    },
    submit: `${SITE}/api/registry/submit`,
    count: services.length,
    services,
  });
}
