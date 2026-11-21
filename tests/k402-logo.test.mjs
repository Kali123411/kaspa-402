// The k402 logo (owner's set, export of 2026-07-16): a rounded "K" with "402" in mono, black #0a0a0a / white.
// It is the site's default favicon and touch icon (kUSD pages keep the kUSD mark), sits beside the header wordmark,
// and marks the share card.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const has = (p) => existsSync(new URL(`../${p}`, import.meta.url));

const ASSETS = ['k402-favicon.svg', 'k402-icon.svg', 'k402-symbol.svg', 'k402-symbol-white.svg', 'k402-avatar.svg', 'k402-badge.svg',
  'k402-badge-white.svg', 'favicon-16.png', 'favicon-32.png', 'favicon-64.png', 'k402-icon-1024.png', 'k402-icon-512.png', 'k402-avatar-512.png'];

test('the k402 logo files ship under public/k402/logo', () => {
  for (const f of ASSETS) assert.ok(has(`public/k402/logo/${f}`), f);
});

test('the site default favicon and touch icon are the k402 ones, keyed so kUSD pages can replace them', () => {
  const app = read('pages/_app.js');
  assert.match(app, /<link rel="icon" href="\/k402\/logo\/k402-favicon\.svg" type="image\/svg\+xml" key="icon" \/>/);
  assert.match(app, /<link rel="alternate icon" href="\/k402\/logo\/favicon-32\.png" type="image\/png" key="icon-png" \/>/);
  assert.match(app, /<link rel="apple-touch-icon" href="\/k402\/logo\/k402-icon-1024\.png" key="apple-touch-icon" \/>/);
  const kusd = read('components/kusd/KusdMark.jsx');
  for (const k of ['key="icon"', 'key="icon-png"', 'key="apple-touch-icon"']) assert.ok(kusd.includes(k), `kUSD icons use ${k}`);
});

test('the header wordmark carries the white K symbol', () => {
  assert.match(read('pages/_app.js'), /<img src="\/k402\/logo\/k402-symbol-white\.svg" width=\{2[0-9]\} height=\{2[0-9]\} alt="" /);
});

test('the share card carries the symbol, and the function ships it', () => {
  const og = read('pages/api/og.js');
  assert.match(og, /public\/k402\/logo\/k402-symbol-white\.svg/);
  assert.match(og, /data:image\/svg\+xml;base64/);
  assert.match(read('next.config.js'), /'\/api\/og': \['\.\/lib\/fonts\/\*\*', '\.\/public\/k402\/logo\/\*\*', '\.\/node_modules\/next\/dist\/compiled\/@vercel\/og\/\*\*'\]/);
});
