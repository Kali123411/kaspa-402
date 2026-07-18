// pages/api/llms.js — the machine-readable catalog, served at /llms.txt (via a rewrite).
// One fetch gives an agent/LLM the whole marketplace: how to pay, the discovery API, and every
// live service (capability, description, price, endpoint, schemes, reputation), grouped by category.
const GATEWAY = 'https://x402-compute.68cxgfyr0.workers.dev';
const CATS = [
  ['Inference', (c) => c.startsWith('llm:') || c === 'kaspa-expert'],
  ['Text & data', (c) => ['summarize', 'extract', 'classify', 'rewrite', 'read', 'embed', 'search'].includes(c)],
  ['Kaspa chain data', (c) => c.startsWith('chain:')],
  ['Covenants', (c) => c.startsWith('covenant:')],
  ['Zero-knowledge', (c) => c === 'zk-prove' || c === 'attest'],
];
const catOf = (c) => (CATS.find(([, f]) => f(c)) || ['Other'])[0];

export default async function handler(req, res) {
  let providers = [];
  try {
    const d = await (await fetch(`${GATEWAY}/registry/search?limit=500`)).json();
    providers = d.providers || [];
  } catch (e) { /* still serve the header if the registry is briefly unreachable */ }

  const L = [];
  L.push('# k402 service exchange — kaspa-402.org');
  L.push('');
  L.push('> Agent-payable services, settled per call on Kaspa L1. No account, no API key, no signup.');
  L.push('> The registry never holds funds; reputation is chain-verified settled volume (KAS).');
  L.push('');
  L.push('## How an agent pays');
  L.push('');
  L.push('- MCP (easiest): add the hosted server, then discover and pay from your agent:');
  L.push(`    claude mcp add --transport http k402 ${GATEWAY}/mcp`);
  L.push('    # tools: registry_search(capability=...), generate(...), summarize(...), etc.');
  L.push(`- Prepaid session: POST ${GATEWAY}/onboard/request -> a Kaspa deposit address; fund it once`);
  L.push('    with KAS, then call any endpoint with header  X-Session: <session>  (metered per token).');
  L.push('- Payment channel (trustless): pip install k402; open a covenant channel to a provider and');
  L.push('    pay per call with off-chain vouchers (k402.ChannelPayer). No custodian.');
  L.push('');
  L.push('## Discovery API');
  L.push('');
  L.push(`- All services (JSON): GET ${GATEWAY}/registry/search`);
  L.push(`- Filter: GET ${GATEWAY}/registry/search?capability=<cap>&max_price_usd=<n>&min_reputation_kas=<n>`);
  L.push(`- One provider: GET ${GATEWAY}/registry/provider/<payee_pubkey>`);
  L.push('');
  L.push(`## Services (${providers.length} live)`);
  L.push('');
  for (const cat of [...CATS.map((c) => c[0]), 'Other']) {
    const items = providers.filter((p) => catOf(p.capability) === cat);
    if (!items.length) continue;
    L.push(`### ${cat}`);
    L.push('');
    for (const p of items) {
      const rep = (p.reputation && p.reputation.settled_kas) || 0;
      const desc = (p.description || '').replace(/\s+/g, ' ').trim() || 'agent-payable service';
      L.push(`- **${p.capability}** — ${desc}`);
      L.push(`  price: $${p.price_usd}/call · endpoint: ${p.endpoint} · schemes: ${(p.schemes || []).join(', ')} · reputation: ${rep} KAS settled`);
    }
    L.push('');
  }
  L.push('---');
  L.push('Protocol: https://github.com/Kali123411/k402/blob/main/PROTOCOL.md · client: pip install k402');

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
  res.status(200).send(L.join('\n'));
}
