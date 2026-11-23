// Phase 1 B: one glossary file, a keyboard-reachable tooltip component, a /glossary page, and the first use of each
// jargon term on a page wrapped in <Term>.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLOSSARY, byId } from '../lib/glossary.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('every glossary entry has a unique id and a one-sentence short definition', () => {
  const ids = GLOSSARY.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate ids');
  for (const g of GLOSSARY) {
    assert.match(g.id, /^[a-z0-9-]+$/, g.id);
    assert.ok(g.term && g.short, `${g.id}: term and short are required`);
    assert.ok(g.short.length <= 200, `${g.id}: short is ${g.short.length} chars; one sentence please`);
    assert.ok(!/\s{2,}/.test(g.short));
  }
  for (const must of ['covenant', 'psm', 'origination-fee', 'lock-time', 'script-hash', 'token-authority', 'surplus-pot', 'compute-mass', 'box', 'spendpolicy', 'sliding-window', 'unserved', 'x402-v2', 'payment-required', 'payto', 'scheme', 'sompi', 'groth16', 'proof-of-innocence', 'anonymity-set', 'trusted-setup', 'shielded-pool', 'stage', 'miner-median']) {
    assert.ok(byId[must], `the brief's term "${must}" is missing`);
  }
});

test('the tooltip is keyboard reachable and links to the glossary page', () => {
  const t = read('components/Term.jsx');
  assert.ok(t.includes('role="tooltip"') && t.includes('aria-describedby'), 'ARIA tooltip wiring');
  assert.ok(t.includes('group-focus-within:block') && t.includes('group-hover:block'), 'shown on focus as well as hover');
  assert.ok(t.includes('/glossary#'), 'links to the entry');
  const page = read('pages/glossary.js');
  assert.ok(page.includes('GLOSSARY.map') && page.includes('<title>Glossary — k402</title>'));
});

test('each page wraps the first use of the terms it leans on', () => {
  const expect = {
    'pages/index.js': ['x402-v2', 'payment-required', 'payto', 'covenant', 'box', 'spendpolicy'],
    'pages/kusd.js': ['lock-time', 'compute-mass', 'script-hash', 'covenant', 'miner-median'],
    'pages/validate.js': ['x402-v2', 'payment-required', 'scheme', 'payto'],
    'pages/private.js': ['shielded-pool', 'groth16', 'trusted-setup'],
  };
  for (const [p, ids] of Object.entries(expect)) {
    const s = read(p);
    for (const id of ids) assert.ok(s.includes(`<Term id="${id}"`), `${p}: no <Term id="${id}">`);
  }
});

test('the glossary is reachable from the shared footer', () => {
  assert.ok(read('components/SiteFooter.jsx').includes('href="/glossary"'));
});
