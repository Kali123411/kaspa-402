// The one story all three properties tell (RESCOPE.md §4): the three layers, the claim phrased safely, the
// "why agents" paragraph and the disclaimer set. Copy only; the same text as kaspa-402.org's lib/story.js.
// Imported by /kusd, /kusd/app and /kusd/market and by the tests that pin the wording.

export const MARKET_NAME = 'Kaspa Agent Market';   // chosen 2026-11-17 (RESCOPE.md §4); short form KAM
export const MARKET_SHORT = 'KAM';

export const CLAIM = 'An agent-native marketplace on Kaspa L1, settled in a covenant-native stablecoin built for agents.';
export const FIRST_CLAIM = 'the first agent-native marketplace on Kaspa';

export const WHY_AGENTS =
  "Autonomous software can't open a bank account, pass KYC, or hold a card. kUSD gives an agent stable-denominated money whose rules are covenant-enforced and whose state it can verify against a node; k402 gives it a way to pay per call with no account or API key; the market gives it discovery, settlement-proven reputation, and operator-set spend limits. Humans supervise; agents transact.";

export const LAYERS = [
  {
    key: 'money', role: 'Money', name: 'kUSD', href: '/kusd', url: 'https://www.kaspa-402.org/kusd', repo: 'https://github.com/Kali123411/kUSD',
    what: 'A covenant-native USD stablecoin: the pricing and settlement unit for agents. No bank account, no custodian, no API key; its state is verifiable on chain, box by box.',
  },
  {
    key: 'rails', role: 'Rails', name: 'k402 (Kaspa x402 v2)', href: 'https://kaspa-402.org', url: 'https://kaspa-402.org', repo: 'https://github.com/Kali123411/k402',
    what: 'HTTP 402 pay-per-call: an agent hits a resource, gets a 402, pays on Kaspa L1, retries. KCC-0402 covenant payment channels are the roadmap for streaming micro-settlement.',
  },
  {
    key: 'market', role: 'Market', name: MARKET_NAME, href: '/market', url: 'https://www.kaspa-402.org/market', repo: 'https://github.com/Kali123411/k402',
    what: 'Discovery, settlement-verified reputation and SpendPolicy operator controls: where agents find, buy from and sell to each other.',
  },
];

// Verbatim while on testnet (RESCOPE.md §9); in code, never only in data.
export const DISCLAIMERS = {
  research: 'TN10 testnet research software. Not audited. Not a product. Not for real value.',
  advice: 'Not financial advice.',
  operators: 'Today all five oracle operator keys are held by the deployer; independent operators are a pre-mainnet gate.',
};
