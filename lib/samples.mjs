// Runnable copy for the landing page (UI/UX brief, Phase 2 P1-8/9/10): the same commands /llms.txt publishes.
export const SAMPLES = {
  curl: `# see the paywall: one unpaid request to a listed service
curl -si "https://kaspa-402-ask.kaspadev.workers.dev/exact" | head -3
# HTTP/2 402 Payment Required
# payment-required: eyJhY2NlcHRzIjpb...   (base64 JSON: accepts[] = scheme, network, amount, payTo)
# paying needs a client that signs a Kaspa transaction: see the Python and TypeScript tabs`,
  python: `# kUSD · the k402 client, under an operator policy (testnet-10)
pip install k402

from k402 import KusdPayer, KusdWallet, SpendLedger, SpendPolicy
payer = KusdPayer(wallet, registry_url="https://market.kaspa-402.org", network="testnet-10",
                  policy=SpendPolicy.load("policy.json"), ledger=SpendLedger("spend.db"))
route = await payer.pay_best("summarize", json_body={"text": "..."})
# or, from any MCP client: k402-mcp -> pay_kusd("summarize", {...})`,
  typescript: `// KAS · kx402, the k402 agent payer on npm (wraps @kaspa-x402/client); testnet-10
// npm i kx402 && npx kx402 fetch-sdk
// env: KASPA_X402_KASPA_WASM_MODULE=.../nodejs/kaspa/kaspa.js  KASPA_X402_FUNDING_WALLET=wallet-key:.../agent.key
import { openWallet, payExact, resolveWalletConfig, applyInput } from 'kx402';
const wallet = await openWallet(resolveWalletConfig({ network: 'kaspa:testnet-10' }));
const url = applyInput('https://kaspa-402-summarize.kaspadev.workers.dev/exact', { text });
const r = await payExact(wallet, url, { maxAmountSompi: 300_000_000n });   // 402 -> pay -> retry; never over 3 KAS
r.status, r.body, r.settlement.transaction                                 // the result and the txid to verify`,
};

// One command per "Agents start here" step; every step ends in something executable.
export const STEP_COMMANDS = [
  `# testnet-10 coins for a kaspatest: address (make one in /kusd/app or with your agent's wallet)
open https://faucet-tn10.kaspanet.io/`,
  `curl -si "https://kaspa-402-ask.kaspadev.workers.dev/exact" | grep -i -E "^HTTP|^payment-required" | cut -c1-80`,
  `npm i kx402 && npx kx402 fetch-sdk      # KAS, Node
pip install k402                            # kUSD, Python`,
  `# KAS: the txid the client returned, on the network it paid on
curl -s "https://api-tn10.kaspa.org/transactions/<txid>" | head -c 400
# kUSD: the registry's node-verified settlements
curl -s "https://market.kaspa-402.org/registry/activity?limit=5"`,
  `npm i @kaspa-x402/server                 # answer 402 for KAS, then list it at /list
pip install k402                            # K402(kusd=...) for kUSD, then list on the market`,
];

export const LLMS_CURL = `curl -s https://www.kaspa-402.org/llms.txt | head -40`;
