// pages/api/skill/[cap].js — a per-capability manifest ("SKILL.md"), served at /skill/<cap>.md.
// One fetch tells an agent what the capability does, how to pay via x402 v2, and which services offer it.
import { getListings } from '../../../lib/registry';
import { capInfo, categoryOf } from '../../../lib/catalog';

const SITE = 'https://kaspa-402.org';
const SOMPI = 1e8;
const kas = (s) => { const n = Number(s) / SOMPI; return isFinite(n) ? parseFloat(n.toFixed(8)) : null; };

export default async function handler(req, res) {
  const cap = String(req.query.cap || '').replace(/\.md$/, '');
  const listings = (await getListings())
    .filter((l) => (l.capability || '') === cap)
    .sort((a, b) => Number(a.amountSompi) - Number(b.amountSompi));
  const info = capInfo(cap);

  const L = [];
  L.push(`# Kaspa x402 skill: ${cap}`);
  L.push('');
  L.push(`> ${info.what}`);
  L.push('');
  L.push(`- Category: ${categoryOf(cap)}`);
  L.push('- Settlement: Kaspa L1 via x402 v2 (pay per call, no account or API key)');
  L.push(listings.length ? `- Live services: ${listings.length}` : '- Live services: none listed yet');
  L.push('');
  if (info.send) {
    L.push('## Input'); L.push(''); L.push('```json'); L.push(info.send); L.push('```'); L.push('');
    L.push('## Output'); L.push(''); L.push('```json'); L.push(info.get); L.push('```'); L.push('');
  }
  L.push('## How to call (x402 v2)');
  L.push('```bash');
  L.push('npm i @kaspa-x402/client');
  L.push('```');
  L.push('```js');
  L.push("import { DirectModeClient } from '@kaspa-x402/client';");
  L.push('// configure with your Kaspa funding provider + signer (see @kaspa-x402/client docs), then:');
  L.push(`const r = await client.paidFetch(${listings[0] ? JSON.stringify(listings[0].resource) : '"<service resource url>"'});`);
  L.push('// on HTTP 402 the client reads PAYMENT-REQUIRED, pays on Kaspa, and retries automatically.');
  L.push('```');
  L.push('');
  if (listings.length) {
    L.push(`## Services (${listings.length}, cheapest first)`);
    L.push('');
    L.push('| service | resource | scheme | network | price |');
    L.push('| --- | --- | --- | --- | --- |');
    for (const l of listings) L.push(`| ${l.serviceName} | ${l.resource} | ${l.scheme} | ${l.network} | ${l.amountSompi} sompi (${kas(l.amountSompi)} KAS) |`);
    L.push('');
  }
  L.push('## Discovery');
  L.push(`- Full catalog: ${SITE}/llms.txt · ${SITE}/llms.json`);
  L.push('- Standard: https://kaspa-x402.org');

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
  res.status(200).send(L.join('\n'));
}
