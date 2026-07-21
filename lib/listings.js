// lib/listings.js — the marketplace's CURATED seed of x402 v2 services (option 1). You own this list;
// edit it to add/curate services you stand behind. Only REAL, verifiable x402 v2 endpoints belong here.
// (Open submissions from anyone are option 2 — see lib/registry.js — and are gated by a live /validate.)

const CHAT = 'https://kaspa-402-chat.kaspadev.workers.dev/exact';
const PAYTO = 'kaspa:qzws2a0lfhs9y8kkvyd4mm96gl733pd0mhzvh6mdejms7970gzrawmvjwpde4';

// One mainnet chat model, selected via ?model= on the shared chat gateway. Each model is priced
// independently (KASPA_X402_PRICE_USD_MAP on the gateway) — small models sit at the 0.5 KAS dust
// floor, larger ones command more; priceUsd here mirrors that map so the catalog matches the live offer.
const chatModel = (alias, name, capability, note, priceUsd) => ({
  id: `kaspa-402-chat-${alias}`,
  resource: `${CHAT}?model=${alias}`,
  serviceName: `Kaspa·402 — ${name}`,
  description: `${note} Append \`?prompt=…\` to the URL; each call settles $${priceUsd.toFixed(2)} (paid in KAS at the current rate, min 0.5 KAS) via x402 \`exact\` (standard-native) on mainnet and returns a reply.`,
  capability,
  scheme: 'exact',
  network: 'kaspa:mainnet',
  priceUsd,
  amountSompi: 50000000,
  payTo: PAYTO,
  tags: ['llm', 'mainnet', alias],
  source: 'seed',
  verified: true,
});

export const SEED = [
  {
    id: 'kaspa-402-summarize',
    resource: 'https://kaspa-402-summarize.kaspadev.workers.dev/exact',
    serviceName: 'Kaspa·402 — summarize',
    description: 'Pay-per-call text summarization on llama3.1:8b, on kaspa:testnet-10 (validation target — settled in valueless TKAS). Append `?text=…` to the URL; each call settles a $0.05-equivalent amount (min 0.5 TKAS) via x402 `exact` (standard-native) and returns a 1–2 sentence summary.',
    capability: 'summarize',
    scheme: 'exact',
    network: 'kaspa:testnet-10',
    priceUsd: 0.05,
    amountSompi: 50000000,
    payTo: 'kaspatest:qr50gmc7t3jp33gg68aj63s9av54yc7w9kyjpwqdjhva9tt8j0a7wz2h6cnll',
    tags: ['llm', 'summarize', 'testnet'],
    source: 'seed',
    verified: true,
  },
  chatModel('chat', 'chat', 'llm:chat', 'General chat on llama3.1:8b.', 0.03),
  chatModel('fast', 'fast chat', 'llm:chat', 'Low-latency chat on qwen2.5:3b.', 0.01),
  chatModel('chat-mini', 'chat-mini', 'llm:chat', 'Balanced chat on qwen2.5:7b.', 0.01),
  chatModel('reason', 'reason', 'llm:reason', 'Deeper reasoning on qwen3.5:35b.', 0.08),
  chatModel('think', 'think', 'llm:reason', 'Reasoning-tuned qwen-think.', 0.10),
  chatModel('uncensored', 'uncensored', 'llm:chat', 'Unfiltered chat on Qwen3.6-35B.', 0.08),
  {
    id: 'kaspa-402-embed',
    resource: 'https://kaspa-402-embed.kaspadev.workers.dev/exact',
    serviceName: 'Kaspa·402 — embed',
    description: 'Text embeddings on nomic-embed-text. Append `?input=…`; each call settles $0.01 (paid in KAS at the current rate, min 0.5 KAS) via x402 `exact` on mainnet and returns a 768-dim vector.',
    capability: 'embed',
    scheme: 'exact',
    network: 'kaspa:mainnet',
    priceUsd: 0.01,
    amountSompi: 50000000,
    payTo: PAYTO,
    tags: ['llm', 'embed', 'mainnet'],
    source: 'seed',
    verified: true,
  },
];
