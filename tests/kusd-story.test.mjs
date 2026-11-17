// The one story (RESCOPE.md §4): the three layers are named the same way everywhere, the disclaimer set is verbatim
// and lives in code on every kUSD surface, and the machine copy exists.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CLAIM, DISCLAIMERS, LAYERS, MARKET_NAME } from '../lib/kusd/story.mjs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('the disclaimer set is verbatim', () => {
  assert.equal(DISCLAIMERS.research, 'TN10 testnet research software. Not audited. Not a product. Not for real value.');
  assert.equal(DISCLAIMERS.advice, 'Not financial advice.');
  assert.match(DISCLAIMERS.operators, /all five oracle operator keys are held by the deployer; independent operators are a pre-mainnet gate/);
  assert.doesNotMatch(CLAIM, /first ever|first AI agent marketplace/i, 'the unqualified "first" claim is never used');
});

test('every kUSD surface renders the disclaimer set from code, and the three layers once', () => {
  for (const f of ['pages/kusd.js', 'pages/market.js']) {
    const src = read(f);
    assert.match(src, /DISCLAIMERS\.research|StatusStrip/, `${f} carries the research-software sentence`);
    assert.match(src, /ProductMap/, `${f} shows the product map`);
  }
  const strip = read('components/kusd/app/StatusStrip.jsx');
  assert.match(strip, /DISCLAIMERS\.research\} \{DISCLAIMERS\.advice\}/);
  assert.match(strip, /all five operator keys are\s+held by the deployer/);
  assert.match(read('pages/kusd/app.js'), /href="\/market"/, 'the app links to the market');
});

test('the machine copy names the layers, the market placeholder and the disclaimers', () => {
  const txt = read('public/kusd/llms.txt');
  for (const l of LAYERS) assert.ok(txt.includes(l.url), `llms.txt names ${l.url}`);
  assert.ok(txt.includes(MARKET_NAME));
  assert.ok(txt.includes(DISCLAIMERS.research) && txt.includes(DISCLAIMERS.advice));
  assert.ok(txt.includes('https://kaspa-402.org/llms.txt'), 'points at the rails layer\'s own machine copy');
  assert.ok(txt.includes('kusd-holder-v1'));
});
