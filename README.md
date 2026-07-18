# kaspa-402

The **k402 service exchange** — an open marketplace of agent-payable services (LLM inference, chain
data, zero-knowledge proofs, covenant tooling, embeddings), settled per call over Kaspa L1. No
account, no API key, no signup. The registry never holds funds; reputation is chain-verified settled
volume.

Standalone Next.js site for **[kaspa-402.org](https://kaspa-402.org)**. The marketplace is the
homepage; live listings come from the k402 registry via same-origin API proxies so the browser makes
no cross-origin calls.

## Connect an agent

```bash
npx kaspa-402            # add the hosted MCP server (or print config for any MCP client)
```

Or give an agent the whole marketplace in one fetch — no install:

- **[`/llms.txt`](https://kaspa-402.org/llms.txt)** — machine-readable catalog: how to pay, the
  discovery API, and every live service (capability, price, endpoint, schemes, reputation).
- **[`/llms.json`](https://kaspa-402.org/llms.json)** — the same, structured JSON. Endpoints the
  health sweep found dead are dropped, so an agent is never handed a dead endpoint.
- **`/skill/<capability>.md`** — a per-service manifest (what it does, input/output, how to pay,
  live providers cheapest-first) — the "SKILL.md" an agent ingests. Human page at `/skill/<capability>`.

Three ways to pay, all settled on Kaspa L1: the **MCP** server (the agent pays itself), a **prepaid
session** (fund a Kaspa address once, meter per token), or a trustless **covenant payment channel**
(pay per call with signed vouchers, no custodian).

## List a service

1. **[Validate](https://kaspa-402.org/validate)** — paste your endpoint; a preflight probe checks it
   speaks k402 (returns a proper `402` challenge with a payable scheme and a well-formed pay
   destination) before you list.
2. **List it** from the builder on the homepage — your payee key signs the listing locally; it never
   touches the page or the registry.

An endpoint that later goes offline is dimmed and flagged in the browse UI (and dropped from
`/llms.json`) by a periodic liveness sweep.

## Routes

| Route | What it is |
| --- | --- |
| `/` | Marketplace — browse (grouped by category, or ranked when sorted/searched), free trial, "Use" flow, listing builder |
| `/validate` | Provider preflight — check an endpoint speaks k402 before listing |
| `/skill/<cap>` · `/skill/<cap>.md` | Per-service manifest — human page and machine SKILL.md |
| `/llms.txt` · `/llms.json` | Machine-readable catalog (text / JSON) |
| `/api/exchange` | Same-origin proxy for the registry search (cached ~30s) |
| `/api/health` | Liveness sweep of every listed endpoint (edge-cached ~5m) |
| `/api/validate` | SSRF-guarded preflight probe backing `/validate` |
| `/api/trial/open` · `/api/trial/call` | Free testnet (tKAS) trial rail — try a real metered call, no wallet |

## Architecture

- **Next.js Pages Router.** `next.config.js` rewrites the clean agent URLs (`/llms.txt`,
  `/llms.json`, `/skill/<cap>.md`) onto their API routes.
- **`lib/catalog.js`** — the single source of truth for the capability glossary, categories, and
  pay/discovery metadata, plus `fetchServices()` and `deadEndpoints()`. Imported by both the UI and
  the API routes so they never drift.
- **`lib/probe.js`** — SSRF-guarded endpoint probing (rejects non-HTTP(S) and any host resolving to a
  private/loopback/link-local address; no redirects) shared by `/api/validate` and `/api/health`.
- **No funds in the browser.** Listings are signed locally by the provider; the site only reads the
  registry and formats it.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
```

## Deploy

Any Next.js host. On Vercel: import the repo, framework auto-detected, no env vars needed.

---

Protocol + Python client: **[Kali123411/k402](https://github.com/Kali123411/k402)** · `pip install k402`
· connect CLI: **[Kali123411/kaspa-402-cli](https://github.com/Kali123411/kaspa-402-cli)** · `npx kaspa-402`
