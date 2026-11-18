# Examples

## `agent-quickstart.mjs` — one paid call on Kaspa testnet-10, end to end

Wallet → the 402 → an `exact` payment on Kaspa L1 → `PAYMENT-SIGNATURE` → the result and the settlement txid.
It uses [`kx402`](https://www.npmjs.com/package/kx402), the Kaspa x402 agent payer, which wraps
`@kaspa-x402/client`'s `DirectModeClient` with a funding provider and signer built on the rusty-kaspa WASM SDK;
nothing is hidden, the raw client is one import away (`kx402/src/wallet.mjs`, `payExact`).

```bash
npm i kx402
npx kx402 fetch-sdk                                   # the rusty-kaspa v2 nodejs WASM SDK; prints the kaspa.js path
export KASPA_X402_KASPA_WASM_MODULE=/abs/path/nodejs/kaspa/kaspa.js
export KASPA_X402_FUNDING_WALLET=wallet-key:/abs/path/agent.key   # 32-byte private key in hex, mode 600
node examples/agent-quickstart.mjs "text to summarize"
```

The script prints the wallet's address (fund it from https://faucet-tn10.kaspanet.io/), then pays the live demo
service `https://kaspa-402-summarize.kaspadev.workers.dev/exact` ($0.05 a call, quoted in KAS at the live rate,
about 2 TKAS) under its own ceiling of 3 KAS, and prints the status, the result, the settlement
(`transaction`, `amount`, `finality`) and a link to verify the transaction on a TN10 indexer.

Paying in **kUSD** instead (the agent-native unit) is the Python path: `pip install k402`, `KusdPayer.pay_best`
under a `SpendPolicy`, or the `k402-mcp` tool `pay_kusd` — see https://www.kaspa-402.org/market and
https://github.com/kaspa-402/k402.

### Proven on testnet-10 (2026-11-17)

Run against the live demo endpoint with a funded TN10 key: `status 200`, the summary returned, settlement
`ec5b328965d513a1c6d84a45f30f895b968f5abbd7098daa47b8505d5504e75a` (184,654,611 sompi = $0.05 at the live rate,
finality `accepted`), verifiable at https://api-tn10.kaspa.org/transactions/ec5b328965d513a1c6d84a45f30f895b968f5abbd7098daa47b8505d5504e75a.
Two earlier runs the same day paid and got `502 backend_unavailable` (`b3caa6c2…`, `6cfaf50b…`): the demo
provider behind the worker pointed at a decommissioned model host; fixed on the provider, not in this code.
