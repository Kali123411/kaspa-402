// pages/api/llmsjson.js — the machine-readable catalog as structured JSON, served at /llms.json.
// The programmatic twin of /llms.txt: same content, but a shape a consumer can parse without regex.
import { GATEWAY, MCP_URL, SITE, PAY, DISCOVERY, capInfo, categoryOf, fetchServices, deadEndpoints } from '../../lib/catalog';

export default async function handler(req, res) {
  const all = await fetchServices();
  // drop endpoints the health sweep confirmed dead — agents shouldn't be handed a dead endpoint
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const base = req.headers.host ? `${proto}://${req.headers.host}` : SITE;
  const dead = await deadEndpoints(base);
  const providers = all.filter((p) => !dead.has(p.endpoint));

  const services = providers.map((p) => {
    const info = capInfo(p.capability);
    return {
      capability: p.capability,
      category: categoryOf(p.capability),
      description: (p.description || '').replace(/\s+/g, ' ').trim() || info.what,
      price_usd: p.price_usd,
      endpoint: p.endpoint,
      schemes: p.schemes || [],
      network: p.network || 'mainnet',
      payee_pubkey: p.payee_pubkey,
      reputation_kas: (p.reputation && p.reputation.settled_kas) || 0,
      channel_terms: p.channel_terms || null,
      request_example: info.send || null,
      response_example: info.get || null,
      manifest: `${SITE}/skill/${encodeURIComponent(p.capability)}.md`,
    };
  });

  const body = {
    name: 'k402 service exchange',
    url: SITE,
    description: 'Agent-payable services, settled per call on Kaspa L1. No account, no API key, no signup. The registry never holds funds; reputation is chain-verified settled volume (KAS).',
    settlement: 'Kaspa L1 — covenant payment channels, prepaid sessions, or per-call UTXO',
    protocol: 'https://github.com/Kali123411/k402/blob/main/PROTOCOL.md',
    client: 'pip install k402',
    mcp: { transport: 'http', url: MCP_URL, add: PAY.mcp },
    pay: PAY,
    discovery: DISCOVERY,
    count: services.length,
    excluded_unreachable: all.length - services.length,
    services,
  };

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
  res.status(200).json(body);
}
