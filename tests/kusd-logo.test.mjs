// The kUSD logo (owner's set, 2026-11-21): the dollar drawn as a chain path threading three blocks. It marks the
// kUSD pages (favicon, touch icon, beside the page title), kUSD prices on the market, and the /kusd share card.
// The rest of the site keeps the k402 "402" favicon.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const has = (p) => existsSync(new URL(`../${p}`, import.meta.url));

const ASSETS = ['kusd-mark.svg', 'kusd-mark-small-24.svg', 'kusd-mark-favicon-16.svg', 'kusd-mark-mono.svg', 'kusd-mark-inverse.svg',
  'kusd-favicon-32.png', 'kusd-mark-512.png', 'kusd-app-icon-1024.png'];

test('the logo files ship under public/kusd/logo, colours as designed', () => {
  for (const f of ASSETS) assert.ok(has(`public/kusd/logo/${f}`), f);
  const mark = read('public/kusd/logo/kusd-mark.svg');
  assert.match(mark, /#0E3A33/); assert.match(mark, /#3FBFA8/);
});

test('one component picks the right drawing for the size, with alt text', () => {
  const c = read('components/kusd/KusdMark.jsx');
  assert.match(c, /kusd-mark-small-24\.svg/, 'the simplified drawing below 32 px');
  assert.match(c, /kusd-mark\.svg/);
  assert.match(c, /alt=\{/);
  assert.match(c, /size < 32/);
});

test('the kUSD pages carry the kUSD favicon and touch icon; the site default stays the 402', () => {
  assert.match(read('pages/_app.js'), /<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml" key="icon" \/>/);
  for (const p of ['pages/kusd.js', 'pages/kusd/app.js', 'pages/kusd/history.js', 'pages/market.js']) {
    const s = read(p);
    assert.match(s, /<KusdIcons \/>/, `${p} sets the kUSD icons`);
  }
  const icons = read('components/kusd/KusdMark.jsx');
  assert.match(icons, /key="icon"/, 'same key as _app, so Next replaces the 402 favicon instead of adding a second');
  assert.match(icons, /rel="apple-touch-icon"/);
});

test('the mark sits beside the title on /kusd and the app, and before kUSD prices on the market', () => {
  assert.match(read('pages/kusd.js'), /<KusdMark size=\{[^}]+\} [^/]*\/>\s*<h1|<h1[^>]*>\s*<KusdMark/);
  assert.match(read('pages/kusd/app.js'), /<KusdMark /);
  assert.match(read('components/kusd/market/MarketBoard.jsx'), /<KusdMark size=\{14\}/);
  assert.match(read('components/kusd/market/AgentConsole.jsx'), /<KusdMark size=\{14\}/);
});

test('/kusd has its own share card with the mark, and the function ships the logo and font', () => {
  const og = read('pages/api/og-kusd.js');
  assert.match(og, /public\/kusd\/logo\/kusd-mark\.svg/);
  assert.match(og, /data:image\/svg\+xml;base64/);
  assert.match(og, /width: 1200, height: 630/);
  const page = read('pages/kusd.js');
  assert.match(page, /property="og:image" content="https:\/\/www\.kaspa-402\.org\/api\/og-kusd"/);
  assert.match(page, /name="twitter:card" content="summary_large_image"/);
  assert.match(read('next.config.js'), /'\/api\/og-kusd': \['\.\/lib\/fonts\/\*\*', '\.\/public\/kusd\/logo\/\*\*', '\.\/node_modules\/next\/dist\/compiled\/@vercel\/og\/\*\*'\]/);
});
