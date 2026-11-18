// Phase 3 /market: a visible three-step "be the agent" flow, a readiness line instead of a bare "actions are off",
// the freeze switch promoted to the status bar, one display unit with cents on hover, mint/liq explained, roles and
// persistence in one sentence, wallet onboarding, the list-your-service path with its fee, a refresh indicator,
// less KAM repetition.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byId } from '../lib/glossary.mjs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const page = read('pages/market.js');
const console_ = read('components/kusd/market/AgentConsole.jsx');

test('page: readiness + freeze in the status bar, roles sentence, list path with fee, refresh indicator, one KAM', () => {
  assert.ok(page.includes('<MarketReadiness'), 'readiness component beside the status strip');
  assert.ok(page.includes('Roles:') && page.includes('per browser') && page.includes('per wallet key'), 'one plain sentence on roles and persistence');
  assert.ok(page.includes('Listing costs 10¢'), 'the list path names its fee');
  assert.ok(!/KAM<\/span>/.test(page), 'the KAM badge leaves the H1');
  const r = read('components/kusd/market/MarketReadiness.jsx');
  assert.ok(r.includes('FROZEN') && r.includes('onFreeze') && r.includes('role="status"'), 'freeze indicator + button');
  assert.ok(r.includes('unlock once') && r.includes('Reading the chain'), 'says what becomes available when');
  assert.ok(r.includes('every 10 s') && r.includes('checkedAt'), 'refresh indicator from the market poll');
});

test('console: a three-step strip, wallet onboarding card, cents on hover', () => {
  assert.ok(console_.includes('1 · wallet') && console_.includes('2 · pick a listing') && console_.includes('3 · quote & pay'), 'three visible steps');
  assert.ok(console_.includes('Create a wallet in the kUSD app') && console_.includes('href="/get-started"'), 'onboarding card');
  assert.ok(console_.includes('title={`${listing.price_cents}¢`}'), 'cents on hover');
  assert.ok(read('components/kusd/market/MarketBoard.jsx').includes('title={`${p.price_cents}¢`}'));
});

test('mint and liq are explained in the price bar', () => {
  assert.ok(byId['mint-price'] && byId['liq-price'], 'glossary entries');
  const strip = read('components/kusd/app/StatusStrip.jsx');
  assert.ok(strip.includes('<Term id="mint-price">') && strip.includes('<Term id="liq-price">'));
});
