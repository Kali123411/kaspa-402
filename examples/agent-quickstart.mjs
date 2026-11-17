#!/usr/bin/env node
// Pay one x402 call on Kaspa testnet-10 from an agent, end to end: wallet → paidFetch (exact) → verified settlement.
//
//   npm i kx402            # the Kaspa x402 agent payer (wraps @kaspa-x402/client's DirectModeClient)
//   npx kx402 fetch-sdk    # the rusty-kaspa v2 nodejs WASM SDK; prints the kaspa.js path to use below
//   export KASPA_X402_KASPA_WASM_MODULE=/abs/path/nodejs/kaspa/kaspa.js
//   export KASPA_X402_FUNDING_WALLET=wallet-key:/abs/path/agent.key   # a file with a 32-byte private key in hex, mode 600
//   node agent-quickstart.mjs "text to summarize"
//
// Funds: TKAS from https://faucet-tn10.kaspanet.io/ to the address this prints. The call costs what the 402 asks
// ($0.05 for summarize, quoted in KAS at the live rate — about 2 TKAS); the cap below refuses anything above 3 KAS.
import { applyInput, openWallet, payExact, resolveWalletConfig } from 'kx402';

const RESOURCE = process.env.RESOURCE || 'https://kaspa-402-summarize.kaspadev.workers.dev/exact';
const text = process.argv[2] || 'Kaspa is a proof-of-work blockDAG with one-second blocks and fast confirmation for everyday payments.';

// 1. the wallet: a Kaspa key is the only account
const wallet = await openWallet(resolveWalletConfig({ network: 'kaspa:testnet-10' }));
console.log(`wallet ${wallet.fundingAddress} · balance ${(Number(await wallet.balanceSompi()) / 1e8).toFixed(4)} TKAS`);

// 2. the paid call: fetch the 402, build and sign the exact payment, retry with PAYMENT-SIGNATURE
const url = applyInput(RESOURCE, { text });
const MAX_SOMPI = 300_000_000n;   // the agent's own ceiling: never more than 3 KAS for one call, whatever the 402 asks
const r = await payExact(wallet, url, { maxAmountSompi: MAX_SOMPI });
console.log(JSON.stringify({
  status: r.status,
  offer: { amount_sompi: r.offer.amount, payTo: r.offer.payTo, network: r.offer.network, profile: r.offer.profile },
  result: r.body,
  settlement: r.settlement,          // transaction = the txid the provider settled; amount, finality
}, null, 1));

// 3. verify the settlement yourself: the transaction on a TN10 node / indexer
if (r.settlement?.transaction) console.log(`verify: https://api-tn10.kaspa.org/transactions/${r.settlement.transaction}`);
await wallet.close();
process.exit(r.status >= 200 && r.status < 300 ? 0 : 1);
