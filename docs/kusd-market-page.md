# `/market` — live proof record

What the page does and the evidence it does it, on Kaspa testnet-10. Design: `docs/superpowers/specs/2026-11-17-kusd-market-page-design.md`;
protocol: k402 `DESIGN-kusd-market.md`; operator bounds: k402 `DESIGN-kusd-spend-controls.md`.

## Run 1 — 2026-11-17, dev page against the LAN registry and provider

Setup: `next dev -p 3999` with `NEXT_PUBLIC_KUSD_MARKET_REGISTRY=http://192.168.4.25:8791`; the k402 demo registry (:8791) and
provider (:8792) on murr7800 running k402 `feat/registry-activity-cors` with `CORS_ORIGINS` naming the dev origin; headless
Chrome 156 driven over CDP by `scripts/kusd-market-e2e.mjs`; the TN10 agent key (`ea592a3f…`, ≈11¢ kUSD) sealed into the
page's keystore by the script (never printed). Every step is the page's own code: the script only clicks.

| step | what the page did | evidence |
|---|---|---|
| over budget | policy `{maxTotalCents: 1}`; *Quote* → the provider's 402 read off `PAYMENT-REQUIRED`, every check green; *Pay* → **refused `total`: "5¢ would take the lifetime total to 5¢, over the budget of 1¢"**; no review sheet opened, nothing built | `shots/1-refused-total.png` |
| the payment | policy per-call 10¢, lifetime 50¢, 5 calls/h, stop after 1 unserved, `summarize` only; *Pay* → the ledger reserved 5¢ → the app's review sheet: "Pay 0.05 kUSD to summarize (4e368c50…) · creates kUSD box for **995ad32d…** (0.05 kUSD) + 1.5 KAS · fee 0.1 KAS" → *Sign & broadcast* → accepted by the node | tx **`7ce0b672d6f399cfeb3840069be251886127150b00fb35450156b54afba6d8a9`** |
| the proof | the page presented `PAYMENT-SIGNATURE` with that txid; the provider verified the box on its node, claimed it with the offer's tweak and served the call: **HTTP 200 after 1 attempt**; the console showed the summary, the paid amount and the box link | `shots/3-served.png`; ledger row `{cents: 5, state: sent, http: 200}` |
| the feed | the provider reported the box to the registry; the registry verified it and the **settlements feed showed `7ce0b672…`** within the wait (10 s polling) | `shots/4-feed.png` |
| kill switch | *Freeze* in the operator drawer → *Quote* → *Pay* → **refused `frozen`**; *Unfreeze* | `shots/5-refused-frozen.png` |
| hygiene | no console exceptions; the ledger holds exactly one row (the refusals left none) | script log |

The payee check is live, not decorative: the quote's `payTo` (`995ad32d…`) is `derive_payee(4e368c50…, payment_id)` recomputed in the
browser with `@noble/curves`; a quote paying anywhere else is refused before the wallet is asked (unit-tested with a hijacked key).

## Run 2 — same day, after the review fix pass

The fresh review found no critical issue, six important and twelve minor; all were fixed (see the PR). The sheet-following
logic moved into `lib/market/flow.mjs` (a reservation is voided only before the wallet started sending; an error
after that is kept and counted as "outcome unknown"), "Remove from this browser" now removes the keystore here too,
relative times are computed after mount (no hydration mismatch on the static page), and the registry records the
capability each settlement paid for. The script now also tests the kill switch before the payment and fails on any
console error. Three further runs, each one real 5¢ payment served with HTTP 200 and shown in the feed:
`03f6a26a…`, `da04d27a…`, `e4fa6678…` (the agent wallet was topped up 50¢ through the PSM, `53f11a8c…`, in between);
refusals `total` and `frozen` before each; zero console errors; the browser profile holding the sealed key is removed
when the run ends.

## What had to be true for this to work

- The registry and the provider answer CORS for the page's origin and expose the x402 headers (k402 `allow_cors`, `CORS_ORIGINS`).
- The site's CSP `connect-src` allows the registry and provider. Production allows any `https:` origin already; development adds
  `http:` (the scheme-source: Chrome never matches an IP address against the `http://*` host wildcard).
- Reading the stored wallet happens after mount (`AgentConsole`), or the server-rendered "no wallet" branch mismatches the client.

## Run 3 — production, 2026-11-17

The owner added the two public hostnames to the Cloudflare tunnel (`market.kaspa-402.org → :8791`,
`summarize.kaspa-402.org → :8792`). The provider was re-listed at `https://summarize.kaspa-402.org/summarize` (10¢ fee on the
x402 wire; this surfaced a k402 bug, a registry with no KAS price of its own crashed on `demand`, fixed in k402 PR #5),
`CORS_ORIGINS=https://kaspa-app.vercel.app` went onto both units, and the same script ran against
**https://www.kaspa-402.org/market** with the production CSP (https only) and the public hostnames:

| step | result |
|---|---|
| over budget (`maxTotalCents: 1`) | refused `total`, nothing built |
| kill switch | refused `frozen`, nothing built |
| the payment | review sheet → tx **`27a21b4806c201aab0d359e80095d54e8fba08d4680a09df80658fc3e230f948`** → `PAYMENT-SIGNATURE` presented → **served, HTTP 200 after 1 attempt** |
| the feed | `27a21b48…` shown within the poll |
| hygiene | ledger: one `sent` row, http 200; zero console errors; browser profile removed |

The bundled snapshot in this commit was regenerated from the public registry (one listing, the public endpoint; the
settlements to date). Regenerate it after notable market changes:

```
node scripts/kusd-market-snapshot.mjs https://market.kaspa-402.org > public/market-snapshot.json
```
