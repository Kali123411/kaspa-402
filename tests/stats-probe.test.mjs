// Phase 2 P0-2 (live proof stat strip) and P0-3 (interactive 402 probe demo): pure helpers + wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeStats, ago } from '../lib/stats.mjs';
import { transcript, decodeOffer } from '../lib/probe-demo.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the stat strip counts listed services, passed probes and settlements from live data', () => {
  const listings = [{ verified: true }, { verified: true }, { verified: false }, {}];
  const activity = { total_cents: 82, settlements: [{ t: 1_000_000, cents: 5 }, { t: 999_000, cents: 10 }] };
  const s = computeStats(listings, activity, 1_000_120_000);
  assert.deepEqual(s, { listed: 4, probesPassed: 2, settlements: 2, settledCents: 82, lastSettlementAgo: '2m ago' });
  const empty = computeStats([], null, 5);
  assert.deepEqual(empty, { listed: 0, probesPassed: 0, settlements: 0, settledCents: 0, lastSettlementAgo: null });
  assert.equal(ago(42_000), '42s ago');
  assert.equal(ago(2 * 3600_000 + 60_000), '2h ago');
  assert.equal(ago(3 * 86400_000), '3d ago');
});

test('a 402 transcript shows the request, the status line, the header and the decoded offer', () => {
  const offer = { accepts: [{ scheme: 'exact', network: 'kaspa:testnet-10', amount: '184278127', payTo: 'kaspatest:qr50gmc7', asset: 'KAS' }] };
  const b64 = Buffer.from(JSON.stringify(offer)).toString('base64');
  assert.deepEqual(decodeOffer(b64), offer);
  assert.equal(decodeOffer('not-base64-json'), null);
  const lines = transcript({ url: 'https://svc.example/exact?text=hi', status: 402, latencyMs: 231, paymentRequired: b64 });
  assert.equal(lines[0], '$ curl -si "https://svc.example/exact?text=hi"');
  assert.equal(lines[1], 'HTTP/2 402 Payment Required   (231 ms)');
  assert.ok(lines.some((l) => l.startsWith('payment-required: ') && l.endsWith('…')), 'header shown, truncated');
  assert.ok(lines.some((l) => l.includes('exact · kaspa:testnet-10 · 1.84278127 KAS → kaspatest:qr50gmc7')), 'decoded offer');
  assert.ok(lines.at(-1).includes('PAYMENT-SIGNATURE'), 'tells what an agent does next');
  const bad = transcript({ url: 'https://svc.example/x', status: 200, latencyMs: 10 });
  assert.ok(bad.some((l) => l.includes('no paywall')), 'a 200 to an unpaid request is called out');
});

test('the probe route only probes listed services, and the demo + strip sit in the hero', () => {
  const api = read('pages/api/probe.js');
  assert.ok(api.includes('getListings') && api.includes('listed'), 'allow-list from the directory');
  assert.ok(api.includes("from '../../lib/probe'"), 'reuses the SSRF-guarded probe');
  const idx = read('pages/index.js');
  const hero = idx.slice(idx.indexOf('<main'), idx.indexOf('id="personas"'));
  assert.ok(hero.includes('<StatStrip') && hero.includes('<ProbeDemo'), 'both in the hero');
  const demo = read('components/ProbeDemo.jsx');
  assert.ok(demo.includes("'/api/probe'") && demo.includes('prefers-reduced-motion') === false, 'client calls the route');
  assert.ok(demo.includes('aria-live'), 'the transcript announces itself');
});
