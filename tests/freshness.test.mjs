// Phase 1 C: one freshness/trust badge — timestamp, data source, verified state, and what "verified" means — replacing
// the three home-grown status lines (/kusd live badge, the app/market status strip, the settlements snapshot note).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { freshnessText, FRESHNESS_MEANING } from '../lib/kusd/freshness.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the badge text names the state, the source and the age', () => {
  assert.equal(freshnessText({ state: 'verified', source: 'TN10 node', ageSeconds: 12 }), 'verified against TN10 node · 12s ago');
  assert.equal(freshnessText({ state: 'unverified', source: 'feed snapshot', at: '2026-11-18T16:47:05Z' }), 'not verified · feed snapshot from 2026-11-18 16:47 UTC');
  assert.equal(freshnessText({ state: 'checking', source: 'TN10 node' }), 'checking TN10 node…');
  assert.equal(freshnessText({ state: 'moved', source: 'TN10 API', at: '2026-11-18T16:47:05Z' }), 'chain has moved past this snapshot · exported 2026-11-18 16:47 UTC');
  assert.equal(freshnessText({ state: 'unreachable', source: 'TN10 API' }), 'TN10 API unreachable · showing the archived snapshot');
  assert.equal(freshnessText({ state: 'partial', source: 'TN10 API', ageSeconds: 3 }), 'some boxes could not be checked · 3s ago');
});

test('every state explains what verified means, in one sentence', () => {
  for (const s of ['verified', 'unverified', 'checking', 'moved', 'unreachable', 'partial']) {
    assert.ok(FRESHNESS_MEANING[s] && FRESHNESS_MEANING[s].length <= 220, `${s}: meaning`);
  }
  assert.match(FRESHNESS_MEANING.verified, /address|unspent|node/i);
});

test('the badge is one component, keyboard reachable, used by the three status displays', () => {
  const f = read('components/Freshness.jsx');
  assert.ok(f.includes('role="status"') && f.includes('role="tooltip"') && f.includes('group-focus-within:block'));
  for (const p of ['components/kusd/LiveBadge.jsx', 'components/kusd/app/StatusStrip.jsx', 'components/kusd/market/SettlementsFeed.jsx']) {
    assert.ok(read(p).includes('<Freshness'), `${p} uses <Freshness>`);
  }
  assert.ok(!read('components/kusd/app/StatusStrip.jsx').includes('not verified`'), 'the hand-written "not verified" line is gone');
  assert.ok(!read('components/kusd/market/SettlementsFeed.jsx').includes('Not live: this is a snapshot'), 'the hand-written snapshot note is gone');
});

test('displayed totals say their scope', () => {
  assert.ok(read('components/kusd/market/SettlementsFeed.jsx').includes('all providers, all time'));
  assert.ok(read('components/kusd/market/MarketBoard.jsx').includes('settled to this provider'));
});
