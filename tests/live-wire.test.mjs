// Phase 4 identity, PR 2 — the landing as "the live wire" (docs/uiux/2026-11-18-identity-design.md): a fluid ledger layout
// that uses a desktop's width, a ticker of real registry events, a round-trip replay from a real recording, a 402 share card.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { tickerEvents } from '../lib/ticker.mjs';
import { RECORDING, replayRows, REPLAY_SPEED } from '../lib/roundtrip.mjs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const listings = [
  { serviceName: 'Kaspa expert', network: 'kaspa:mainnet', amountSompi: '110566876', verified: true, probedAt: 1_000_000 - 240 },
  { serviceName: 'Pending', network: 'kaspa:testnet-10', amountSompi: '1000', verified: false, probedAt: 1_000_000 - 10 },
  { serviceName: 'Old', network: 'kaspa:testnet-10', amountSompi: '1000', verified: true, probedAt: 1_000_000 - 90_000 },
  { serviceName: 'Deepgram', network: 'kaspa:mainnet', amountSompi: '6000000000', priceUsd: '0.5', verified: true, probedAt: 1_000_000 - 3000 },
];
const activity = { settlements: [
  { t: 1_000_000 - 60, txid: 'd01fc924fd48e3fb', cents: 5, capability: 'summarize' },
  { t: 1_000_000 - 7200, txid: '1f9df0a150f465ad', cents: 10, capability: 'extract' },
], total_cents: 15 };

test('ticker events: settlements and passed probes, newest first, pending probes excluded, text an agent would recognise', () => {
  const ev = tickerEvents(listings, activity, 1_000_000 * 1000);
  assert.deepEqual(ev.map((e) => e.kind), ['settled', 'probe', 'probe', 'settled', 'probe']);
  assert.equal(ev[2].text, '402 PROBE PASSED · Deepgram · $0.50/call in KAS · 50m ago', 'USD-pegged listings quote the dollar price, not the dust floor');
  assert.equal(ev[0].text, 'SETTLED 0.05 kUSD → summarize · d01fc924 · 1m ago');
  assert.equal(ev[1].text, '402 PROBE PASSED · Kaspa expert · 1.10566876 KAS · 4m ago');
  assert.equal(ev[3].text, 'SETTLED 0.10 kUSD → extract · 1f9df0a1 · 2h ago');
  assert.ok(!ev.some((e) => e.text.includes('Pending')), 'a pending probe is not an event');
});

test('ticker events: empty inputs give an honest placeholder, never fabricated events; capped at 12', () => {
  const none = tickerEvents([], null, 0);
  assert.equal(none.length, 1);
  assert.match(none[0].text, /no settlements recorded yet/);
  const many = tickerEvents([], { settlements: Array.from({ length: 30 }, (_, i) => ({ t: 1000 - i, txid: 'ab'.repeat(8), cents: 1, capability: 'x' })) }, 1000 * 1000);
  assert.equal(many.length, 12);
});

test('the replay is the real recording: kUSD summarize on testnet-10, 402 → pay → 200 with the measured stamps', () => {
  assert.equal(RECORDING.network, 'testnet-10');
  assert.equal(RECORDING.txid, 'd01fc924fd48e3fb8d6bc6f0eb2f60389613307bcb2d8d3af796a2e7146610c8');
  const rows = replayRows(RECORDING);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((r) => r.at), ['0.00 s', '0.35 s', '7.36 s', '15.14 s']);
  assert.match(rows[1].text, /402 Payment Required/);
  assert.match(rows[1].sub, /0\.05 kUSD/);
  assert.match(rows[2].text, /payment broadcast/);
  assert.match(rows[2].sub, /d01fc924…6610c8/);
  assert.match(rows[3].text, /200 OK/);
  assert.match(rows[3].sub, /284 bytes/);
  assert.ok(REPLAY_SPEED >= 3 && REPLAY_SPEED <= 6, 'compressed, and the page says by how much');
});

test('the landing is the live wire: ticker, replay beside the headline, honest copy about the second', () => {
  const idx = read('pages/index.js');
  const hero = idx.slice(idx.indexOf('<main'), idx.indexOf('id="personas"'));
  assert.ok(hero.includes('<LiveTicker') && hero.includes('<RoundTrip'), 'ticker and replay in the hero');
  assert.ok(!idx.includes('about a second, and gets the result'), 'no one-second claim for the whole trip');
  assert.ok(idx.includes('accepted on Kaspa in about a second'), 'the second is L1 acceptance');
  const ticker = read('components/LiveTicker.jsx');
  assert.ok(ticker.includes("'/api/stats'") && ticker.includes('aria-label=') && ticker.includes('hover:[animation-play-state:paused]'), 'live data, labelled, pauses on hover');
  const rt = read('components/RoundTrip.jsx');
  assert.ok(rt.includes('aria-live') && rt.includes('REPLAY_SPEED') && rt.includes('replay'), 'announced, labelled as a replay at a stated speed');
  const api = read('pages/api/stats.js');
  assert.ok(api.includes('tickerEvents') && api.includes('events:'), '/api/stats carries the events');
});

test('the layout uses the width: no 1024 px cap, viewport-scaled headline, two columns on desktop, one on phones', () => {
  const idx = read('pages/index.js');
  for (const cap of ['max-w-5xl', 'max-w-3xl']) assert.ok(!idx.includes(cap), `landing still capped at ${cap}`);
  assert.ok(!read('components/SiteFooter.jsx').includes('max-w-5xl'), 'footer follows the same grid');
  assert.match(idx, /text-\[clamp\(/, 'the headline scales with the viewport');
  assert.match(idx, /lg:grid-cols-\[/, 'an asymmetric two-column hero on desktop');
  assert.ok(!idx.includes('rounded-2xl') && !idx.includes('glass') && !idx.includes('card-hover') && !idx.includes('uppercase tracking'), 'no cards, glass or ornament labels');
});

test('share card and favicon: the 402 numeral', () => {
  assert.ok(existsSync(new URL('../public/favicon.svg', import.meta.url)), 'public/favicon.svg');
  assert.ok(read('public/favicon.svg').includes('402') && read('public/favicon.svg').includes('#D1FF4A'));
  const og = read('pages/api/og.js');
  assert.ok(og.includes('ImageResponse') && og.includes('402') && og.includes('width: 1200') && og.includes('height: 630'));
  assert.ok(og.includes('lib/fonts/Fraunces-Light.woff') && existsSync(new URL('../lib/fonts/OFL.txt', import.meta.url)), 'the bundled font and its licence');
  const idx = read('pages/index.js');
  assert.ok(idx.includes('property="og:image"') && idx.includes('/api/og') && idx.includes('summary_large_image'));
  assert.ok(read('pages/_app.js').includes('href="/favicon.svg"'));
});
