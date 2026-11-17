# kaspa-402.org — the rails

The payment rail for AI agent commerce on Kaspa L1: **k402 (Kaspa x402 v2)**, HTTP 402 pay-per-call. An agent calls
a resource, gets a `402`, pays on Kaspa L1 and retries — no account, no API key, no custodian. This site is one of
three layers of one product (see [`RESCOPE.md`](RESCOPE.md)):

| Layer | Name | Where |
| --- | --- | --- |
| Money | kUSD — covenant-native USD stablecoin built for agents | [kaspa-app.vercel.app/kusd](https://kaspa-app.vercel.app/kusd) · [repo](https://github.com/Kali123411/kUSD) |
| Rails | k402 (Kaspa x402 v2) — this site | [kaspa-402.org](https://kaspa-402.org) · [repo](https://github.com/Kali123411/k402) |
| Market | Kaspa Agent Market (KAM) — discovery, settlement-verified reputation, SpendPolicy | [kaspa-app.vercel.app/kusd/market](https://kaspa-app.vercel.app/kusd/market) |

Standalone Next.js site (Pages Router) for **[kaspa-402.org](https://kaspa-402.org)**, deployed on Vercel.

## For agents

- **[`/llms.txt`](https://kaspa-402.org/llms.txt)** / **[`/llms.json`](https://kaspa-402.org/llms.json)** — what this
  layer is, the other two layers, how to pay in KAS or kUSD, how to verify, every listed service.
- **`/skill/<capability>.md`** — a per-capability manifest an agent ingests; human page at `/skill/<capability>`.
- The homepage's **Agents start here** section: funds → 402 → pay (KAS or kUSD) → verify on a node → sell.

Paying in KAS uses `kx402`, the Kaspa x402 agent payer (it wraps the standard client `@kaspa-x402/client` from
`elldeeone/kaspa-x402`); the complete, tested example is [`examples/agent-quickstart.mjs`](examples/agent-quickstart.mjs).
Paying in kUSD uses the k402 Python client (`pip install k402`, `KusdPayer`) or the `k402-mcp` tool `pay_kusd`, under
an operator `SpendPolicy`; the kUSD requirement is x402 `exact` with the binding `kusd-holder-v1`
([spec](https://github.com/Kali123411/k402/blob/main/scheme_exact_kusd.md)).

## List a service

1. **[Validate](https://kaspa-402.org/validate)** — paste your endpoint; a preflight probe checks it answers a proper
   `402` with a well-formed x402 v2 `PAYMENT-REQUIRED` header.
2. **Submit** it from the homepage. It appears only after a live, unpaid probe succeeds — the anti-spam gate, and a
   check any agent can repeat. Mainnet listings settle real KAS.
3. To sell for **kUSD**, list on the market instead: a signed listing to the k402 registry
   (`POST https://market.kaspa-402.org/registry/list`, 10¢ kUSD fee through k402).

## Routes

| Route | What it is |
| --- | --- |
| `/` | The rails: browse, list, agents start here, how covenants back this |
| `/validate` | Provider preflight — check an endpoint speaks x402 v2 before listing |
| `/private` | Private payments demo (testnet-10, proof of concept) |
| `/skill/<cap>` · `/skill/<cap>.md` | Per-capability manifest — human page and machine SKILL.md |
| `/llms.txt` · `/llms.json` | Machine-readable catalog (text / JSON) |
| `/bridge` | The ETH↔Kaspa bridge UI (static) |
| `GET /api/registry/list` | The merged directory as JSON `{count, listings}` |
| `POST /api/registry/submit` | Open submission: validation, SSRF guard, live unpaid probe, offer reconciliation, 0.5 KAS floor |
| `GET /api/registry/health` | Which storage backend the directory uses and whether it connects (not service liveness) |
| `POST /api/validate` | SSRF-guarded preflight probe backing `/validate` |
| `GET /api/llms`, `/api/llmsjson`, `/api/skill/<cap>` | The catalogs behind the clean URLs above |

## Architecture

- **Registry data**: the k402 registry (`https://market.kaspa-402.org`, env `K402_REGISTRY_URL`) is the one directory
  for the whole product. `lib/registry.js` reads `GET /registry/catalog` (signed kUSD/KAS listings and probe-attested
  x402 listings in one shape) and shows the KAS-priced ones here; kUSD-priced ones live on the Kaspa Agent Market page.
  Submissions are forwarded to `POST /registry/submit`, where the registry probes the endpoint and lists what it
  actually offered; the registry re-probes every attested listing (6 h) and retires one after three misses. When the
  registry cannot be reached the site serves `lib/catalog-snapshot.js` (`node scripts/catalog-snapshot.mjs > lib/catalog-snapshot.js`),
  marked `fromSnapshot`. The site keeps no store of its own (the former `SEED` and Upstash submissions were migrated
  with k402's `examples/catalog_migrate.py`).
- **`lib/story.js`**: the shared story — the three layers, the claim, the "why agents" paragraph, the disclaimer set —
  used by the pages and the catalogs so names never drift.
- **`lib/x402catalog.js`**: the directory's listing schema and the live-offer checks; **`lib/probe.js`**: SSRF-guarded
  probing shared by submit and validate; **`lib/catalog.js`**: the capability glossary.
- **No funds in the browser.** The site reads the registry and formats it; payments happen between the agent and the
  service.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
```

## Deploy

Vercel: import the repo; no storage credentials are needed (the directory is the k402 registry; `K402_REGISTRY_URL`
overrides its address). Tests: `node --test tests/*.test.mjs`.

## Disclaimers

kUSD and the Kaspa Agent Market: **TN10 testnet research software. Not audited. Not a product. Not for real value.**
Not financial advice. Today all five kUSD oracle operator keys are held by the deployer; independent operators are
a pre-mainnet gate. Mainnet listings on this site settle real KAS; nothing on this site is audited.

---

Rails protocol + Python client: **[Kali123411/k402](https://github.com/Kali123411/k402)** · `pip install k402` ·
MCP: **[Kali123411/k402-mcp](https://github.com/Kali123411/k402-mcp)** · connect CLI: **[Kali123411/kaspa-402-cli](https://github.com/Kali123411/kaspa-402-cli)**
