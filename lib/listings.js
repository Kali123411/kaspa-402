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
];
