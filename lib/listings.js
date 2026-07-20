// lib/listings.js — the marketplace's CURATED seed of x402 v2 services (option 1). You own this list;
// edit it to add/curate services you stand behind. Only REAL, verifiable x402 v2 endpoints belong here.
// (Open submissions from anyone are option 2 — see lib/registry.js — and are gated by a live /validate.)
export const SEED = [
  {
    id: 'kaspa-x402-demo',
    resource: 'https://demo.kaspa-x402.org/exact',
    serviceName: 'Kaspa x402 demo gateway',
    description: "Reference x402 v2 `exact` endpoint — the SDK's live testnet gateway.",
    capability: 'demo',
    scheme: 'exact',
    network: 'kaspa:testnet-10',
    amountSompi: 20000000,
    payTo: 'kaspatest:qzlws9lm7uyt0tftzffshnyeu2zcqk4kf7hw5ghk6v0zh093vnkljcy2fl0fh',
    tags: ['reference', 'testnet'],
    source: 'seed',
    verified: true,
  },
  {
    id: 'kaspa-402-summarize',
    resource: 'https://kaspa-402-summarize.kaspadev.workers.dev/exact',
    serviceName: 'Kaspa·402 — summarize',
    description: 'Pay-per-call text summarization on llama3.1:8b. Append `?text=…` to the URL; each call settles 0.5 KAS via x402 `exact` (standard-native) and returns a 1–2 sentence summary.',
    capability: 'summarize',
    scheme: 'exact',
    network: 'kaspa:testnet-10',
    amountSompi: 50000000,
    payTo: 'kaspatest:qr50gmc7t3jp33gg68aj63s9av54yc7w9kyjpwqdjhva9tt8j0a7wz2h6cnll',
    tags: ['llm', 'summarize', 'testnet'],
    source: 'seed',
    verified: true,
  },
];
