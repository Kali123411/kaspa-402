# Re-scope Brief: Agent-Native Marketplace on Kaspa L1

Nov 16, 2026 · @Gordon Murray

## How to use this brief

You are a Claude Code agent re-scoping three existing properties into one product. Read this whole brief before touching anything, then work the phases in §10 in order. This document is deliberately text-first so it can be dropped into each repo as `RESCOPE.md` and referenced from `CLAUDE.md`.

Rules of engagement:

- Work one phase at a time; do not start a later phase before the earlier phase's gate is met.
- Copy and docs changes are yours to draft freely. Behavior changes get a small, reviewable PR each. Covenant code changes are out of scope entirely (§9).
- When this brief and the live code disagree, trust the code, note the discrepancy in your Phase 0 gap report, and ask before proceeding on anything load-bearing.
- Preserve every testnet/research disclaimer verbatim unless explicitly told otherwise (§9).

## Mission and target end state

Re-scope [kaspa-402.org](https://www.kaspa-402.org), [kaspa-app.vercel.app/kusd](https://kaspa-app.vercel.app/kusd) (+ [/kusd/market](https://kaspa-app.vercel.app/kusd/market)), and [github.com/Kali123411/kUSD](https://github.com/Kali123411/kUSD) so they present and function as **one product: an AI-agent-centered marketplace, settled in its own agent-centered stablecoin, running natively on Kaspa L1 covenants**.

The product has three layers; every surface must name them consistently:

1. **Money — kUSD.** Covenant-native USD stablecoin. The pricing and settlement unit for agents: no bank account, no custodian, no API key, state machine-verifiable on chain.
2. **Rails — k402 (Kaspa x402 v2).** HTTP 402 pay-per-call: agent hits a resource, gets a 402, pays on Kaspa L1, retries. KCC-0402 covenant payment channels are the roadmap for streaming micro-settlement.
3. **Market — the marketplace.** Discovery, settlement-verified reputation, and SpendPolicy operator controls — the layer where agents find, buy from, and sell to each other.

**Done looks like:** every capability a human can reach in the UI is reachable by an agent through documented machine interfaces; a fresh agent given only the machine-readable docs can discover a service, pay for a call in kUSD on TN10, and verify settlement against a node, unassisted; and all three properties tell the same story with the same names.

## Current state (as reviewed 2026-11-16)

Verify this table yourself in Phase 0 — it comes from a review of the live pages and public repo, and the live state wins.

| Property | Role today | Key facts | Gaps found |
| --- | --- | --- | --- |
| [kaspa-402.org](https://www.kaspa-402.org/#browse) | Directory of pay-per-call services under Kaspa x402 v2 | HTTP 402 flow; TN10 now, mainnet later; KAS payment plus a Base router; live 402-probe before a listing shows; validator; `llms.txt`/`llms.json`; `@kaspa-x402/client` and `@kaspa-x402/server` packages | Positioned as a generic pay-per-call directory, not agent commerce; covenants never mentioned; agent quickstart imports `DirectModeClient` but never instantiates it — sample is incomplete |
| [/kusd](https://kaspa-app.vercel.app/kusd) | kUSD status + verification dashboard | CDP vaults (borrow to 175%, liquidate below 150%); PSM with ramping fee; 5-operator median oracle with rate limits; $50k/day issuance budget; 2% stability fee; 2-of-3 governance; covenant IDs published for verification | Positioned as a general stablecoin, no agent story; vault panel shows `$NaN` debt and `NaN%` ratio in the current export |
| [/kusd/market](https://kaspa-app.vercel.app/kusd/market) | Agent-to-agent marketplace on TN10 | Listings priced in kUSD (one live: "summarize", llama3.1 8B, 0.05 kUSD/call); 10¢ listing fee via k402; settlements feed verified against a node; settlement-based reputation; SpendPolicy operator controls incl. kill switch and budgets; per-wallet ledger | Only one listing; buy flow is browser-wallet / human-centric; settled totals disagree (feed shows 0.40 kUSD, listing shows 0.45) |
| [github.com/Kali123411/kUSD](https://github.com/Kali123411/kUSD) | The covenant implementation | Argent (`.ag`) contracts: `kusd`, `vault`, `psm`, `oracle`, `budget`, `surplus`; Rust harness with 182 tests; CI; deploy runbook with live TN10 covenant/tx IDs; whitepaper + one-pager in `docs/pitch/`; MIT | README frames a general-purpose stablecoin; no agent-facing integration docs; no `llms.txt` |

## Positioning and naming

Apply these decisions consistently across all three properties. Do not invent new brand names without approval.

- **Canonical names:** `kUSD` for the money, `k402` for the rails (long form "Kaspa x402 v2" on first mention), and the marketplace needs a decided name — propose 3–5 options to Murr in Phase 1 before rebranding anything; until then call it "the kUSD agent market".
- **The claim, phrased safely:** lead with *"an agent-native marketplace on Kaspa L1, settled in a covenant-native stablecoin built for agents."* The "first" claim is usable as *"the first agent-native marketplace on Kaspa"* — scoped to Kaspa, verifiable. Avoid unqualified "first ever AI agent marketplace" anywhere; it is not verifiable and invites debunking.
- **Why agents, in one paragraph (reuse everywhere):** autonomous software can't open a bank account, pass KYC, or hold a card. kUSD gives an agent stable-denominated money whose rules are covenant-enforced and whose state it can verify against a node; k402 gives it a way to pay per call with no account or API key; the market gives it discovery, settlement-proven reputation, and operator-set spend limits. Humans supervise; agents transact.
- **Covenants are the differentiator — say so.** Every property must explain, at least once, that the stablecoin, settlement, and (roadmap) payment channels are enforced by Kaspa L1 covenants — no bridge, no L2, no trusted issuer. kaspa-402.org currently never says the word.
- **Tone:** engineering-forward, verifiable, testnet-honest. Every metric shown must link to the chain or a node check. No hype adjectives where a number or a covenant ID will do.

## Workstream A — kaspa-402.org: the rails

Reframe the site from "directory of pay-per-call services" to **the payment rail for AI agent commerce on Kaspa L1**. Agents are the primary audience; humans are the operators who supervise them.

- [ ] Rewrite hero and browse copy agent-first: a service listing is something an agent discovers and pays, not something a person clicks. Keep "no account, no API key, no custodian" — it is the agent pitch already.
- [ ] Fix the quickstart: the sample imports `DirectModeClient` but never instantiates it. Ship a complete, copy-paste-runnable example covering wallet setup → `paidFetch` → verified settlement, and test it against the live demo endpoint on TN10.
- [ ] Add an **"Agents start here"** path: one page (and matching `llms.txt` section) that takes an agent from nothing to a paid call — get TN10 funds, handle a 402, pay in KAS or kUSD, verify on a node, then list a service of its own with `@kaspa-x402/server`.
- [ ] Make kUSD a first-class payment option in the docs and schema, positioned as the stable pricing unit for agents (KAS stays supported). Document the kUSD scheme in x402 v2 terms.
- [ ] Add a "How covenants back this" section: kUSD settlement today, KCC-0402 payment channels as the streaming/micro-settlement roadmap. The site currently never mentions covenants.
- [ ] Keep and re-describe in agent terms: the validator, the unpaid live-probe listing flow (it is anti-spam and agent-verifiable), and the Base router (reach non-Kaspa services while settling the Kaspa leg).
- [ ] Cross-link the three layers: money → /kusd, market → /kusd/market, spec → the kUSD repo and the KCC-0402 PR.

## Workstream B — kUSD repo: agent-native money

Re-scope the repo's story, not its covenants. The contracts, parameters, and safety rails are frozen for this effort (§9); this workstream is docs, packaging, and agent-facing integration material.

- [ ] Rewrite the README lead: kUSD is **a stablecoin built for AI agents** — covenant-enforced rules, machine-verifiable state, no custodian or KYC gate between an agent and its money. Keep the existing "TN10 testnet research software. Not audited. Not a product. Not for real value." framing verbatim and prominent.
- [ ] Keep the full mechanism documentation (CDP, PSM, oracle, budget, surplus, governance) but add a short "Why this design serves agents" note per mechanism — e.g. the PSM is the peg floor an agent can price against; oracle rate limits bound how fast an agent's collateral math can move; the issuance budget bounds systemic blast radius.
- [ ] Add `docs/agents/`: an integration guide for agent developers — holding kUSD, paying through k402, verifying settlement and covenant state against a TN10 node, and reading the deploy runbook's covenant IDs. Every step runnable.
- [ ] Add `llms.txt` at the repo root, consistent with the site's.
- [ ] Update `docs/pitch/` (whitepaper + one-pager) with an agent-economy section: the three-layer story from §2 and the market as the live proof.
- [ ] Update the repo description and topics (e.g. `kaspa`, `covenants`, `stablecoin`, `ai-agents`, `x402`).
- [ ] Any change in this repo — even docs — goes through CI; the 182-test harness must stay green.

## Workstream C — kusd app + /market: the flagship

Make `/kusd/market` the flagship surface of the whole product — the place where "agents buying from agents, settled in agent money" is visibly live. `/kusd` becomes the transparency page behind it.

- [ ] Fix known bugs first: the `$NaN` vault debt and `NaN%` ratio on `/kusd`, and the settled-total mismatch on the market (feed 0.40 kUSD vs listing 0.45 — find the source of truth, make both read it).
- [ ] Re-hierarchy the pages: market leads with the agent story and live settlements; `/kusd` leads with "verify the money" (oracle, covenant IDs, system state) and links back to the market.
- [ ] Add a programmatic buy path beside the browser-wallet flow: documented HTTP/JSON endpoints (or the k402 flow itself) for browse → quote → pay → verify, so an agent needs no browser. The current flow signs in the browser and is human-centric.
- [ ] Expose the settlements feed, listings, reputation, and per-wallet ledger as JSON endpoints with stable schemas, not just UI panels.
- [ ] Present **settlement-verified reputation** and **SpendPolicy** as the trust layer, with their own docs: reputation from node-checked settlements (not enterable ratings); operator controls — kill switch, per-call max, lifetime and windowed budgets, call caps, unserved-paid-call limit, allowed capabilities — as how a human governs an autonomous buyer.
- [ ] Seed listings: propose 3–5 additional real services beyond "summarize" (candidates to pitch Murr: embedding, OCR, code review, GPU time quotes from the rental infra). Each must pass the live 402 probe; no fake listings, ever.
- [ ] Show the three-layer product map (money / rails / market) somewhere once, linked to §4 phrasing.

## Cross-cutting — agent-first interfaces

One principle governs all three properties: **anything a human can do in the UI, an agent can do through a documented machine interface without a browser.** "Agent-centered" is proven by interfaces, not copy.

- [ ] **MCP server** (e.g. `@kaspa-x402/mcp`): tools for `browse_services`, `get_quote`, `pay_call`, `verify_settlement`, `check_reputation`, `list_service`, plus wallet/SpendPolicy status. This is the strongest proof of the positioning — Claude and other MCP clients can use the marketplace natively. Prioritize it in Phase 3.
- [ ] **`llms.txt` / `llms.json` on all three properties**, consistent in names and flow, each covering: what this layer is, how to pay, how to verify, where the other two layers live.
- [ ] **OpenAPI spec** for the registry and market endpoints (listings, settlements, reputation, ledger, probe).
- [ ] **Versioned listing schema**: name, URL, description, capability, scheme, network, price (sompi or kUSD), reputation fields — published and referenced by the site, the market, and the SDK.
- [ ] **SDK**: `@kaspa-x402/client` gains first-class kUSD scheme support if it lacks it; README examples show an agent loop (discover → pay → verify) end to end.
- [ ] **Verifiability as a feature**: every number an agent might act on (price, settlement, reputation) must be checkable against a TN10 node, and the docs must show how.

## Guardrails — non-negotiable

- **Covenant code is frozen.** Do not modify the `.ag` contracts, protocol parameters, or deployed covenants as part of this re-scope. A contract change is a separate, explicitly assigned task, and would require the full 182-test harness green plus Murr's review before merge.
- **Honesty survives the rebrand.** Keep "TN10 testnet research software. Not audited. Not a product. Not for real value." and the not-financial-advice line on every surface, verbatim, while on testnet. Never claim audited, never claim mainnet, never fabricate usage or settlement numbers — show only chain-verifiable figures.
- **Keep the mainnet caveat about keys.** All five oracle operator keys are currently deployer-held; the stated requirement of independent operators before mainnet stays visible wherever operators are described.
- **Scope limits.** No mainnet deployment, no token launch mechanics, no yield or return claims, no removing the live-probe gate on listings, no listings that don't pass it.
- **Secrets.** Never commit keys, seeds, or node credentials; check diffs before every commit.
- **PR hygiene.** One small PR per checklist item or tight group; copy-only PRs separate from behavior PRs; each PR description names its workstream and phase.

## Sequencing and acceptance

Work the phases in order; each gate is Murr's sign-off plus the stated check.

| Phase | Work | Gate |
| --- | --- | --- |
| 0 — Audit | Read all three codebases; verify §3's table; produce a gap report (discrepancies, dead code, undocumented endpoints) | Gap report reviewed |
| 1 — Story | READMEs, site copy, `llms.txt` on all properties; marketplace name proposals; no behavior changes | Copy approved; names chosen |
| 2 — Fixes | `$NaN` vault panel; settled-total mismatch; complete the `DirectModeClient` quickstart | Each fix verified against live TN10 |
| 3 — Interfaces | JSON endpoints + OpenAPI; MCP server; SDK kUSD scheme; listing schema | North-star demo passes (below) |
| 4 — Growth | Seed listings; reputation and SpendPolicy docs; cross-links and product map | 3+ live probed listings; docs complete |

**North-star demo (the acceptance test for the whole re-scope):** a fresh Claude agent, given only the MCP server (or `llms.txt` + the HTTP docs), can — unassisted — discover the "summarize" service, pay 0.05 kUSD for a call on TN10 under a SpendPolicy budget, receive the result, and verify the settlement against a node. Record it (terminal capture is fine); that recording *is* the marketing.

**Report back per phase:** what shipped (PR links), what the gate check showed, open questions — then stop for sign-off.

Sources: [kaspa-402.org](https://www.kaspa-402.org/#browse) · [kUSD dashboard](https://kaspa-app.vercel.app/kusd) · [kUSD market](https://kaspa-app.vercel.app/kusd/market) · [kUSD repo](https://github.com/Kali123411/kUSD)
