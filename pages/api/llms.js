// pages/api/llms.js — the machine-readable catalog (text), served at /llms.txt.
// One fetch tells an agent what this layer is (the rails), where the other two layers live (money, market), how to
// pay in KAS or kUSD, how to verify, and every listed service. Names and disclaimers come from lib/story.js.
import { getListings } from '../../lib/registry';
import { capInfo } from '../../lib/catalog';
import { CLAIM, DISCLAIMERS, LAYERS, LINKS, MARKET_NAME, WHY_AGENTS } from '../../lib/story';

const SITE = 'https://kaspa-402.org';
const SOMPI = 1e8;
const kas = (s) => { const n = Number(s) / SOMPI; return isFinite(n) ? parseFloat(n.toFixed(8)) : null; };
const priceLabel = (l) => { const u = Number(l.priceUsd); return u > 0 ? `$${u.toFixed(2)}/call, paid in KAS at the live rate (min ${kas(l.amountSompi)} KAS)` : `${l.amountSompi} sompi (${kas(l.amountSompi)} KAS)`; };

export default async function handler(req, res) {
  const listings = await getListings();
  const L = [];
  L.push('# kaspa-402 — the rails: k402 (Kaspa x402 v2)');
  L.push('');
  L.push(CLAIM);
  L.push('This file describes the RAILS layer. Pay per call over HTTP 402 on Kaspa L1 — no account, no API key, no custodian.');
  L.push('');
  L.push('## The three layers');
  for (const l of LAYERS) L.push(`- ${l.role} — ${l.name}: ${l.what} ${l.url} (code: ${l.repo})`);
  L.push('');
  L.push('## Why agents');
  L.push(WHY_AGENTS);
  L.push('');
  L.push('## How to pay (x402 v2)');
  L.push('- Call the resource unpaid. On HTTP 402 read the PAYMENT-REQUIRED header (base64 JSON; `accepts[]` = the ways to pay: scheme, network, amount, payTo). Pay one, retry with PAYMENT-SIGNATURE.');
  L.push('- KAS: npm i @kaspa-x402/client — schemes `exact` and `batch-settlement`; networks kaspa:mainnet (most listings here) and kaspa:testnet-10.');
  L.push(`- kUSD: pip install k402 (KusdPayer.pay_best) or the k402-mcp tool pay_kusd (${LINKS.k402Mcp}); the requirement is scheme \`exact\`, asset = the kUSD authority covenant id, amount in cents, extra.binding = "kusd-holder-v1", proof = the creating txid. Spec: ${LINKS.kusdScheme}. kUSD runs on kaspa:testnet-10 today.`);
  L.push('- Operator limits: a kUSD agent pays inside a SpendPolicy (per-call ceiling, lifetime and windowed budgets, call caps, unserved-payment stop, allowed capabilities, kill switch) that only its operator can change.');
  L.push('- Standard: https://kaspa-x402.org · k402 protocol: ' + LINKS.k402Protocol);
  L.push('');
  L.push('## How to verify');
  L.push('- KAS: the payment is a transaction to payTo on the named network; check it on any Kaspa node or explorer.');
  L.push('- kUSD: the payment is a covenant box of exactly the quoted cents at the offer\'s derived key, carrying the kUSD family\'s covenant id; a node proves it (kusd_pay verify, or the kusd-client WASM address check).');
  L.push(`- The market publishes node-verified settlements: GET ${LINKS.registry}/registry/activity?limit=50 ; listings: GET ${LINKS.registry}/registry/search?currency=kUSD ; a provider: GET ${LINKS.registry}/registry/provider/{payee_pubkey}`);
  L.push('');
  L.push('## Where the other layers live');
  L.push(`- Money (kUSD): ${LAYERS[0].url} — live state, covenant ids, how to verify; the kUSD app (${LINKS.kusdApp}) to hold, buy and send kUSD on testnet-10.`);
  L.push(`- Market (the ${MARKET_NAME}, KAM): ${LAYERS[2].url} — kUSD-priced services, the settlements feed, settlement-verified reputation, SpendPolicy.`);
  L.push('');
  L.push('## Disclaimers');
  L.push(`- kUSD and the ${MARKET_NAME}: ${DISCLAIMERS.research} ${DISCLAIMERS.advice}`);
  L.push(`- ${DISCLAIMERS.operators}`);
  L.push('- Mainnet listings on this site settle real KAS; nothing on this site is audited.');
  L.push('');
  L.push(`## Services (${listings.length})`);
  L.push('');
  for (const l of listings) {
    const info = capInfo(l.capability);
    L.push(`### ${l.serviceName}${l.verified ? '' : ' (unverified submission)'}`);
    L.push((l.description || info.what || '').replace(/\s+/g, ' ').trim());
    L.push(`- resource: ${l.resource}`);
    L.push(`- pay: ${l.scheme} on ${l.network} — ${priceLabel(l)}${l.payTo ? `, payTo ${l.payTo}` : ''}`);
    if (l.capability) L.push(`- manifest: ${SITE}/skill/${encodeURIComponent(l.capability)}.md`);
    L.push('');
  }
  L.push('## Discovery');
  L.push(`- JSON: ${SITE}/llms.json  ·  Registry: ${SITE}/api/registry/list`);
  L.push(`- Submit a KAS service: POST ${SITE}/api/registry/submit (must pass a live x402 v2 probe)`);
  L.push(`- List a kUSD service: POST ${LINKS.registry}/registry/list (signed by the payee key; 10¢ kUSD fee through k402) — see ${LINKS.k402Protocol}`);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
  res.status(200).send(L.join('\n'));
}
