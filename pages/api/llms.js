// pages/api/llms.js — the machine-readable catalog, served at /llms.txt (via a rewrite).
// One fetch gives an agent/LLM the whole marketplace: how to pay, the discovery API, and every
// live service (capability, description, price, endpoint, schemes, reputation), grouped by category.
import { GATEWAY, MCP_URL, SITE, PAY, DISCOVERY, CAT_ORDER, categoryOf, fetchServices } from '../../lib/catalog';

export default async function handler(req, res) {
  const providers = await fetchServices();

  const L = [];
  L.push('# k402 service exchange — kaspa-402.org');
  L.push('');
  L.push('> Agent-payable services, settled per call on Kaspa L1. No account, no API key, no signup.');
  L.push('> The registry never holds funds; reputation is chain-verified settled volume (KAS).');
  L.push('');
  L.push('## How an agent pays');
  L.push('');
  L.push('- MCP (easiest): add the hosted server, then discover and pay from your agent:');
  L.push(`    ${PAY.mcp}`);
  L.push('    # tools: registry_search(capability=...), generate(...), summarize(...), etc.');
  L.push(`- Prepaid session: ${PAY.session}`);
  L.push(`- Payment channel (trustless): ${PAY.channel}`);
  L.push('');
  L.push('## Discovery API');
  L.push('');
  L.push(`- All services (JSON): GET ${DISCOVERY.services}`);
  L.push(`- Filter: GET ${DISCOVERY.filter}`);
  L.push(`- One provider: GET ${DISCOVERY.provider}`);
  L.push(`- This catalog as JSON: GET ${SITE}/llms.json`);
  L.push('');
  L.push(`## Services (${providers.length} live)`);
  L.push('');
  for (const cat of CAT_ORDER) {
    const items = providers.filter((p) => categoryOf(p.capability) === cat);
    if (!items.length) continue;
    L.push(`### ${cat}`);
    L.push('');
    for (const p of items) {
      const rep = (p.reputation && p.reputation.settled_kas) || 0;
      const desc = (p.description || '').replace(/\s+/g, ' ').trim() || 'agent-payable service';
      L.push(`- **${p.capability}** — ${desc}`);
      L.push(`  price: $${p.price_usd}/call · endpoint: ${p.endpoint} · schemes: ${(p.schemes || []).join(', ')} · reputation: ${rep} KAS settled`);
      L.push(`  manifest: ${SITE}/skill/${encodeURIComponent(p.capability)}.md`);
    }
    L.push('');
  }
  L.push('---');
  L.push('Protocol: https://github.com/Kali123411/k402/blob/main/PROTOCOL.md · client: pip install k402');

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
  res.status(200).send(L.join('\n'));
}
