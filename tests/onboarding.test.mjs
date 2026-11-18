// Phase 1 D: one "Get set up on testnet-10" guide — faucet → wallet → first 402 payment — reachable from every page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the guide walks faucet → wallet → first 402 payment with runnable commands', () => {
  const s = read('pages/get-started.js');
  assert.ok(s.includes('LINKS.faucet') && read('lib/story.js').includes('https://faucet-tn10.kaspanet.io/'), 'faucet link (the shared LINKS.faucet)');
  assert.ok(s.includes('/kusd/app'), 'the browser wallet');
  for (const cmd of ['npm i kx402', 'npx kx402 fetch-sdk', 'pip install k402', 'payExact(', 'pay_best(']) assert.ok(s.includes(cmd), `command ${cmd}`);
  assert.ok(s.includes('<title>Get set up on testnet-10 — k402</title>'));
  assert.ok(/curl -si .*402/.test(s) || s.includes('402 Payment Required'), 'shows what a 402 looks like');
});

test('the guide is linked from the chrome every page renders', () => {
  assert.ok(read('pages/_app.js').includes('href="/get-started"'), 'banner / header link');
  assert.ok(read('components/SiteFooter.jsx').includes('href="/get-started"'), 'footer link');
});
