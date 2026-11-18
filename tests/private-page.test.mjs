// Phase 3 /private: the risk line beside the hero claim, a primary CTA, full copyable hashes with a named explorer,
// a text transcript of the recording (and no GIF under reduced motion), the mainnet-path status, what the demo service is.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s = readFileSync(new URL('../pages/private.js', import.meta.url), 'utf8');

test('the caveat stands beside the claim, and the hero has a primary CTA', () => {
  const hero = s.slice(s.indexOf('<h1'), s.indexOf('</section>'));
  assert.ok(/unaudited/i.test(hero) && /trusted setup/i.test(hero) && /testnet-10/.test(hero), 'one-line risk summary in the hero');
  assert.ok(hero.includes('btn-kaspa') || hero.includes('Try it'), 'a primary CTA');
  assert.ok(hero.includes('href="/get-started"') || hero.includes('href="#proof"'), 'the CTA goes somewhere runnable');
});

test('hashes are full and copyable, the explorer is named, instructions are step by step', () => {
  assert.ok(s.includes('break-all') && s.includes('navigator.clipboard.writeText(tx)'), 'full hash + copy');
  assert.ok(s.includes('api-tn10.kaspa.org') && s.includes('TN10 API'), 'the explorer is named');
  assert.ok(s.includes('Check it yourself') && s.includes('Step 1'), 'step-by-step check');
});

test('the recording has a text transcript and hides under prefers-reduced-motion; mainnet path is stated', () => {
  assert.ok(s.includes('motion-reduce:hidden'), 'GIF hidden when motion is reduced');
  assert.ok(s.includes('Transcript') && s.includes('motion-reduce:block'), 'transcript, shown by default for reduced motion');
  assert.ok(s.includes('Mainnet path') && /MPC/.test(s) && /audit/.test(s) && /not scheduled|not started/i.test(s), 'honest status');
});

test('the demo service and the integration shape are explained', () => {
  assert.ok(s.includes('What the demo pays for') && s.includes('summarize') && s.includes('payExact'), 'service + integration');
});
