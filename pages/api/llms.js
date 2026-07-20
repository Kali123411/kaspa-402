// pages/api/llms.js — the machine-readable catalog (text), served at /llms.txt.
// One fetch tells an agent the whole marketplace: how to pay via x402 v2, and every listed service.
import { getListings } from '../../lib/registry';
import { capInfo } from '../../lib/catalog';

const SITE = 'https://kaspa-402.org';
const SOMPI = 1e8;
const kas = (s) => { const n = Number(s) / SOMPI; return isFinite(n) ? parseFloat(n.toFixed(8)) : null; };

export default async function handler(req, res) {
  const listings = await getListings();
  const L = [];
  L.push('# Kaspa x402 marketplace');
  L.push('');
  L.push('A directory of x402-payable services settled on Kaspa L1, built on the Kaspa x402 v2 standard.');
  L.push('Pay per call — no account, no API key.');
  L.push('');
  L.push('## How to pay (x402 v2)');
  L.push('- Client: npm i @kaspa-x402/client');
  L.push('- Call the resource; on HTTP 402 the client reads the PAYMENT-REQUIRED header, pays on Kaspa (exact or batch-settlement), and retries with PAYMENT-SIGNATURE.');
  L.push('- Networks: kaspa:testnet-10 (validation target) · kaspa:mainnet');
  L.push('- Standard: https://kaspa-x402.org');
  L.push('');
  L.push(`## Services (${listings.length})`);
  L.push('');
  for (const l of listings) {
    const info = capInfo(l.capability);
    L.push(`### ${l.serviceName}${l.verified ? '' : ' (unverified submission)'}`);
    L.push((l.description || info.what || '').replace(/\s+/g, ' ').trim());
    L.push(`- resource: ${l.resource}`);
    L.push(`- pay: ${l.scheme} on ${l.network} — ${l.amountSompi} sompi (${kas(l.amountSompi)} KAS)${l.payTo ? `, payTo ${l.payTo}` : ''}`);
    if (l.capability) L.push(`- manifest: ${SITE}/skill/${encodeURIComponent(l.capability)}.md`);
    L.push('');
  }
  L.push('## Discovery');
  L.push(`- JSON: ${SITE}/llms.json  ·  Registry: ${SITE}/api/registry/list`);
  L.push(`- Submit a service: POST ${SITE}/api/registry/submit (must pass a live x402 v2 probe)`);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
  res.status(200).send(L.join('\n'));
}
