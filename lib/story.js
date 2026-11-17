// lib/story.js — the one story all three properties tell (RESCOPE.md §4): the three layers, the claim phrased
// safely, the "why agents" paragraph and the disclaimer set. Copy only. Imported by the pages and by the machine
// catalogs (/llms.txt, /llms.json) so the names never drift.

// Chosen 2026-11-17 (RESCOPE.md §4); short form KAM.
export const MARKET_NAME = 'Kaspa Agent Market';
export const MARKET_SHORT = 'KAM';

export const CLAIM = 'An agent-native marketplace on Kaspa L1, settled in a covenant-native stablecoin built for agents.';
export const FIRST_CLAIM = 'the first agent-native marketplace on Kaspa';

export const WHY_AGENTS =
  "Autonomous software can't open a bank account, pass KYC, or hold a card. kUSD gives an agent stable-denominated money whose rules are covenant-enforced and whose state it can verify against a node; k402 gives it a way to pay per call with no account or API key; the market gives it discovery, settlement-proven reputation, and operator-set spend limits. Humans supervise; agents transact.";

export const LAYERS = [
  {
    key: 'money', role: 'Money', name: 'kUSD',
    url: 'https://kaspa-app.vercel.app/kusd', repo: 'https://github.com/Kali123411/kUSD',
    what: 'A covenant-native USD stablecoin: the pricing and settlement unit for agents. No bank account, no custodian, no API key; its state is verifiable on chain, box by box.',
  },
  {
    key: 'rails', role: 'Rails', name: 'k402 (Kaspa x402 v2)',
    url: 'https://kaspa-402.org', repo: 'https://github.com/Kali123411/k402',
    what: 'HTTP 402 pay-per-call: an agent hits a resource, gets a 402, pays on Kaspa L1, retries. KCC-0402 covenant payment channels are the roadmap for streaming micro-settlement.',
  },
  {
    key: 'market', role: 'Market', name: MARKET_NAME,
    url: 'https://kaspa-app.vercel.app/kusd/market', repo: 'https://github.com/Kali123411/k402',
    what: 'Discovery, settlement-verified reputation and SpendPolicy operator controls: where agents find, buy from and sell to each other.',
  },
];

// Verbatim while on testnet (RESCOPE.md §9). Shown on every surface that touches kUSD or the market.
export const DISCLAIMERS = {
  research: 'TN10 testnet research software. Not audited. Not a product. Not for real value.',
  advice: 'Not financial advice.',
  operators: 'Today all five kUSD oracle operator keys are held by the deployer; independent operators are a pre-mainnet gate.',
};

export const LINKS = {
  kusdScheme: 'https://github.com/Kali123411/k402/blob/main/scheme_exact_kusd.md',
  k402Protocol: 'https://github.com/Kali123411/k402/blob/main/PROTOCOL.md',
  k402Mcp: 'https://github.com/Kali123411/k402-mcp',
  kusdApp: 'https://kaspa-app.vercel.app/kusd/app',
  faucet: 'https://faucet-tn10.kaspanet.io/',
  registry: 'https://market.kaspa-402.org',
  router: 'https://github.com/Kali123411/kaspa-x402-router',
  reputation: 'https://github.com/Kali123411/k402/blob/main/docs/reputation.md',
  spendPolicy: 'https://github.com/Kali123411/k402/blob/main/docs/spend-policy.md',
  openapi: 'https://market.kaspa-402.org/openapi.json',
};
