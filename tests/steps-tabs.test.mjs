// Phase 2 P1-8/9/10: code samples in tabs with a copy button, every agent step ends in a runnable command, and
// llms.txt is surfaced as a feature with a copyable curl.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SAMPLES, STEP_COMMANDS, LLMS_CURL } from '../lib/samples.mjs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('three code samples, curl first, each a plain copyable string', () => {
  assert.deepEqual(Object.keys(SAMPLES), ['curl', 'python', 'typescript']);
  assert.ok(SAMPLES.curl.includes('curl -si') && SAMPLES.curl.includes('402'));
  assert.ok(SAMPLES.python.includes('pip install k402') && SAMPLES.python.includes('pay_best('));
  assert.ok(SAMPLES.typescript.includes('npm i kx402') && SAMPLES.typescript.includes('payExact('));
  for (const s of Object.values(SAMPLES)) assert.ok(!s.includes('<span'), 'plain text, no markup');
});

test('every agent step ends in something executable, step 1 names the faucet', () => {
  assert.equal(STEP_COMMANDS.length, 5);
  for (const c of STEP_COMMANDS) assert.ok(c.trim().length > 0 && !c.includes('<span'), c);   // plain text; <txid> placeholders are fine
  assert.ok(STEP_COMMANDS[0].includes('faucet-tn10.kaspanet.io'));
  assert.ok(LLMS_CURL.includes('curl') && LLMS_CURL.includes('/llms.txt'));
});

test('CodeBlock copies, CodeTabs is a tablist, the landing uses both and surfaces llms.txt', () => {
  const block = read('components/CodeBlock.jsx');
  assert.ok(block.includes('navigator.clipboard.writeText') && block.includes('aria-label="Copy"') && block.includes('overflow-x-auto'));
  const tabs = read('components/CodeTabs.jsx');
  assert.ok(tabs.includes('role="tablist"') && tabs.includes('role="tab"') && tabs.includes('aria-selected'));
  const idx = read('pages/index.js');
  assert.ok(idx.includes('<CodeTabs'), 'the samples section uses CodeTabs');
  assert.equal((idx.match(/STEP_COMMANDS\[/g) || []).length, 5, 'each of the five steps shows its command');
  assert.ok(idx.includes('machine-readable') && idx.includes('LLMS_CURL'), 'the llms.txt callout');
});
