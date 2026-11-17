// pages/api/llmsjson.js — the machine-readable catalog (structured), served at /llms.json.
// The x402 v2 marketplace: every listed service as an x402 resource + how an agent pays it.
import { getListings } from '../../lib/registry';
import { capInfo } from '../../lib/catalog';
import { CLAIM, DISCLAIMERS, LAYERS, LINKS, MARKET_NAME, WHY_AGENTS } from '../../lib/story';

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
      price_model: Number(l.priceUsd) > 0 ? 'usd-pegged' : 'fixed',
      price_usd: Number(l.priceUsd) > 0 ? Number(l.priceUsd) : null,
      // For usd-pegged services amount_sompi/price_kas are the current dust FLOOR; the exact amount is
      // set by the live 402 offer at the spot KAS/USD rate. Always pay what the PAYMENT-REQUIRED header states.
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
    name: 'kaspa-402 — the rails: k402 (Kaspa x402 v2)',
    url: SITE,
    description: `${CLAIM} This is the rails layer: HTTP 402 pay-per-call on Kaspa L1 — no account, no API key, no custodian.`,
    layer: 'rails',
    layers: LAYERS.map((l) => ({ role: l.role.toLowerCase(), name: l.name, url: l.url, repo: l.repo, what: l.what })),
    why_agents: WHY_AGENTS,
    standard: 'https://kaspa-x402.org',
    protocol: 'x402 v2',
    networks: ['kaspa:testnet-10', 'kaspa:mainnet'],
    pay: {
      kas: {
        client: 'npm i kx402 (wraps @kaspa-x402/client) · npx kx402 fetch-sdk',
        how: 'openWallet(resolveWalletConfig({ network })) then payExact(wallet, url, { maxAmountSompi }): on HTTP 402 it reads PAYMENT-REQUIRED, pays on Kaspa L1 (exact or batch-settlement) inside your cap, retries with PAYMENT-SIGNATURE and returns the result with the settlement txid.',
        example: 'https://github.com/Kali123411/kaspa-402/blob/main/examples/agent-quickstart.mjs',
        docs: 'https://www.npmjs.com/package/kx402',
      },
      kusd: {
        client: 'pip install k402 (KusdPayer) · MCP: k402-mcp pay_kusd',
        how: 'The kUSD requirement is x402 `exact` with asset = the kUSD authority covenant id, amount in cents, extra.binding = "kusd-holder-v1"; the proof is the creating txid. Paid inside an operator SpendPolicy. kaspa:testnet-10 today.',
        spec: LINKS.kusdScheme,
        mcp: LINKS.k402Mcp,
        registry: LINKS.registry,
      },
    },
    verify: {
      kas: 'the payment is a transaction to payTo on the named network',
      kusd: `a covenant box of exactly the quoted cents at the offer's derived key carrying the family's covenant id; node-verified settlements: ${LINKS.registry}/registry/activity`,
    },
    market: { name: MARKET_NAME, short: 'KAM', url: LAYERS[2].url, listings: `${LINKS.registry}/registry/search?currency=kUSD`, activity: `${LINKS.registry}/registry/activity`, list: `${LINKS.registry}/registry/list` },
    money: { name: 'kUSD', url: LAYERS[0].url, app: LINKS.kusdApp, repo: LAYERS[0].repo },
    disclaimers: [`kUSD and the ${MARKET_NAME}: ${DISCLAIMERS.research} ${DISCLAIMERS.advice}`, DISCLAIMERS.operators, 'Mainnet listings on this site settle real KAS; nothing on this site is audited.'],
    submit: `${SITE}/api/registry/submit`,
    count: services.length,
    services,
  });
}
