# k402 visual identity — design (Phase 4 of the UI/UX brief)

**Decision (owner, 2026-11-18):** not Kaspa's teal; the Graphite palette (direction C) on the Ledger structure (direction A),
executed as **E2 "the live wire"** — the data moving is the hero. Mockups: the "k402 identity directions" canvas (rows D3 and E2).
Goal: a site that stops the scroll in a feed of look-alike crypto landing pages, and that reads as made by people who know what
they are doing — no template tells.

## Palette (the only colours)

| token | hex | use |
|---|---|---|
| `--ground` | `#16181D` | page background |
| `--panel` | `#1F2229` | the one raised surface (figures, code) |
| `--rule` | `#2B2F37` | soft hairlines, table rows |
| `--text` | `#F2F3F5` | text, strong hairlines (section rules) |
| `--muted` | `#8B9099` | secondary text, captions, labels |
| `--accent` | `#D1FF4A` | acid: one accent — the primary button, the 402/200 status, live markers, the ticker |
| `--accent-ink` | `#16181D` | text on the accent |

Contrast: text on ground 15.2:1, muted on ground 5.3:1, accent on ground 14.6:1, ground on accent 14.6:1. No other hue.
Tailwind's `gray` and `teal` scales and the `neon`/`kaspa` names are REMAPPED to these tokens so the whole site re-skins at
once (the repo already uses that trick); later passes remove the names.

## Type

- **Display:** Fraunces (variable, optical sizes) — weights 500 for headings, 700 for the wordmark. Replaces `font-orbitron`.
- **Body:** Source Serif 4 at 16–19 px, line-height 1.5. Replaces `font-sans` (Geist/Inter).
- **Data and commands:** JetBrains Mono 12–14 px, tabular numerals. Replaces `font-mono`.
- Small mono labels stay allowed only as section marks (§ 1), figure captions and table heads — never as a decorative chip.

## Structure (the ledger)

Hairline rules in `--text` separate sections; soft rules in `--rule` separate rows. Square corners (radii 0) except status dots.
No cards with borders and backgrounds: panels only for code and figures. Tables with tabular numerals instead of stat cards.
One filled accent button per view; every other action is an underlined text link. A margin column (180 px) for section marks
and side notes on the document-like pages (/kusd, /glossary, /get-started).

## Motion

Only the data moves: the settlements ticker, the round-trip replay's timestamps, the live probe's cursor. No fade-ins,
hover lifts, glows, shimmer, scanlines or parallax. `prefers-reduced-motion` stops the ticker and shows the replay complete.

## Forbidden (the template tells)

Gradients, glass/backdrop blur, glow shadows, neon text shadows, scanline/vignette overlays, `rounded-xl/2xl` bordered cards,
pill badges, icon-in-circle feature grids, Lucide icons as decoration (functional icons: inline stroke SVG, few), framer-motion,
"·" separator chains, uppercase-tracking micro-labels as ornament, stock phrases ("seamless", "built for", "unlock").

## E2's signature components (landing page)

- **Ticker** (`components/LiveTicker.jsx`): one acid band under the header, scrolling real events from `/api/stats` and the
  registry activity (settlements, probes passed, miner medians posted). Pauses on hover and under reduced motion.
- **Round-trip replay** (`components/RoundTrip.jsx`): a timed four-row replay (0.00 s GET → 402 · 0.21 s pay · 0.98 s accepted ·
  1.04 s 200) from a real recorded testnet-10 round trip, timestamps advancing on load; the live probe demo stays beside it.
- **Share card:** E1's 520 px acid "402" on ground, 1200×630; favicon: the same numeral.

## Scope by PR

1. Tokens + shell: Tailwind theme remap, fonts, globals.css purge, `_app` header/banner/footer, diagram colours.
2. Landing page: hero copy, ticker, round-trip replay, ledger structure, share card + favicon.
3. /kusd + /kusd/history + /glossary + /get-started (document pages: margin column, tables).
4. /market + /kusd/app (remove cards/icons/pills; keep the working controls).
5. /validate + /private + /list.
6. Accessibility + Lighthouse pass (≥ 90), mobile.
