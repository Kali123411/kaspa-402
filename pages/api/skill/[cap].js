// pages/api/skill/[cap].js — a per-capability manifest ("SKILL.md"), served at /skill/<cap>.md.
// The fullest agentic-market-style interpretation: one fetch tells an agent exactly what a service
// does, what to send/get, how to pay it, and which live providers offer it (cheapest first).
import { GATEWAY, MCP_URL, SITE, PAY, DISCOVERY, capInfo, categoryOf, fetchServices } from '../../../lib/catalog';

export default async function handler(req, res) {
  const cap = String(req.query.cap || '').replace(/\.md$/, '');
  const all = await fetchServices();
  const providers = all
    .filter((p) => p.capability === cap)
    .sort((a, b) => (a.price_usd || 0) - (b.price_usd || 0));
  const info = capInfo(cap);
  const cheapest = providers.length ? Math.min(...providers.map((p) => p.price_usd)) : null;

  const L = [];
  L.push(`# k402 skill: ${cap}`);
  L.push('');
  L.push(`> ${info.what}`);
  L.push('');
  L.push(`- Category: ${categoryOf(cap)}`);
  L.push(`- Settlement: Kaspa L1 (per call, no account or API key)`);
  L.push(providers.length
    ? `- Live providers: ${providers.length}${cheapest != null ? ` — from $${cheapest}/call` : ''}`
    : `- Live providers: none right now — check ${DISCOVERY.services}?capability=${encodeURIComponent(cap)}`);
  L.push('');

  if (info.send) {
    L.push('## Input');
    L.push('');
    L.push('```json');
    L.push(info.send);
    L.push('```');
    L.push('');
    L.push('## Output');
    L.push('');
    L.push('```json');
    L.push(info.get);
    L.push('```');
    L.push('');
  }

  L.push('## How to call');
  L.push('');
  L.push('### 1. MCP (easiest — the agent pays itself)');
  L.push('```');
  L.push(PAY.mcp);
  L.push(`# then: use the k402 "${cap}" service to ...`);
  L.push('```');
  L.push('');
  L.push('### 2. Prepaid session');
  L.push('```');
  L.push(`curl -X POST ${GATEWAY}/onboard/request        # -> a Kaspa deposit address`);
  L.push(`# fund it once with KAS, then call the endpoint with header  X-Session: <session>`);
  L.push('```');
  L.push('');
  L.push('### 3. Payment channel (trustless, high volume)');
  L.push('```python');
  L.push('pip install k402');
  L.push('from k402 import ChannelPayer');
  L.push(`providers = await payer.discover(${JSON.stringify(cap)})   # this + similar providers`);
  L.push('r = await payer.pay(providers[0], "", { ... })    # opens a covenant channel, pays per call');
  L.push('```');
  L.push('');

  if (providers.length) {
    L.push(`## Providers (${providers.length}, cheapest first)`);
    L.push('');
    L.push('| price/call | endpoint | schemes | reputation (KAS) | payee |');
    L.push('| --- | --- | --- | --- | --- |');
    for (const p of providers) {
      const rep = (p.reputation && p.reputation.settled_kas) || 0;
      const payee = String(p.payee_pubkey || '').slice(0, 12);
      L.push(`| $${p.price_usd} | ${p.endpoint} | ${(p.schemes || []).join(', ')} | ${rep} | ${payee}… |`);
    }
    L.push('');
  }

  L.push('## Discovery API');
  L.push('');
  L.push(`- This capability (JSON): GET ${DISCOVERY.services}?capability=${encodeURIComponent(cap)}`);
  L.push(`- Full catalog: ${SITE}/llms.txt  ·  ${SITE}/llms.json`);
  L.push('');
  L.push('---');
  L.push(`Human page: ${SITE}/skill/${encodeURIComponent(cap)}  ·  Protocol: https://github.com/Kali123411/k402/blob/main/PROTOCOL.md`);

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
  res.status(200).send(L.join('\n'));
}
