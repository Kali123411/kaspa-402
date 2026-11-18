// Phase 1 A + E of the UI/UX brief: one brand (k402), one chrome (shared header, banner, footer), external links
// marked with ↗ and their destination domain. Source-level checks, like the other copy tests here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { BRAND, BRAND_LINE, DISCLAIMER_BANNER, EXTERNAL, externalLabel } from '../lib/brand.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
function walk(dir) {
  const out = [];
  for (const f of readdirSync(new URL(`../${dir}`, import.meta.url))) {
    const p = `${dir}/${f}`;
    if (statSync(new URL(`../${p}`, import.meta.url)).isDirectory()) out.push(...walk(p));
    else if (/\.(js|jsx|mjs)$/.test(f)) out.push(p);
  }
  return out;
}
const sources = [...walk('pages'), ...walk('components'), ...walk('lib')].filter((p) => p !== 'lib/brand.mjs');

test('the brand is k402, spelled out once as Kaspa x402 v2', () => {
  assert.equal(BRAND, 'k402');
  assert.equal(BRAND_LINE, 'k402 (Kaspa x402 v2)');
  assert.match(read('pages/_app.js'), />\s*\{BRAND\}\s*</, 'the header wordmark renders BRAND');
});

test('no page, component or lib carries a stray brand name', () => {
  for (const p of sources) {
    const s = read(p);
    for (const stray of ['KASPA·X402', 'Kaspa Lab', 'KASPA·X402', 'kaspa-x402 marketplace']) {
      assert.ok(!s.includes(stray), `${p} still says "${stray}"`);
    }
  }
});

test('every page title names k402, not another brand', () => {
  for (const p of walk('pages').filter((f) => !f.startsWith('pages/api/') && !f.startsWith('pages/_'))) {
    const s = read(p);
    const titles = [...s.matchAll(/<title>([^<]*)<\/title>/g)].map((m) => m[1]);
    for (const t of titles) assert.ok(/k402|kUSD/.test(t), `${p}: title "${t}" does not name k402 or kUSD`);
    assert.ok(!/Kaspa Lab|Kaspa x402 marketplace/.test(titles.join(' ')), `${p}: title carries a stray brand`);
  }
});

test('links that leave the site go through ExternalLink (↗ + destination domain)', () => {
  assert.equal(externalLabel('https://kaspa-x402.org/spec'), 'kaspa-x402.org');
  assert.equal(externalLabel('https://www.npmjs.com/package/kx402'), 'npmjs.com');
  const ext = read('components/ExternalLink.jsx');
  assert.ok(ext.includes('↗') && ext.includes('externalLabel'), 'ExternalLink renders the arrow and the domain');
  for (const p of ['pages/_app.js', 'pages/index.js', 'pages/validate.js', 'pages/private.js', 'pages/skill/[cap].js']) {
    const s = read(p);
    assert.ok(!/<a [^>]*href=["']https:\/\/kaspa-x402\.org/.test(s), `${p}: raw anchor to the standard; use <ExternalLink>`);
  }
  assert.equal(EXTERNAL.standard, 'https://kaspa-x402.org');
});

test('one chrome: the shared footer and the single testnet banner live in _app, nowhere else', () => {
  const app = read('pages/_app.js');
  assert.ok(app.includes('<SiteFooter') && app.includes('DISCLAIMER_BANNER'), '_app renders SiteFooter and the banner');
  for (const p of walk('pages').filter((f) => f !== 'pages/_app.js')) {
    assert.ok(!read(p).includes('<footer'), `${p} renders its own footer`);
  }
  assert.equal(DISCLAIMER_BANNER, 'Testnet research software — unaudited, not for real value.');
  const dupes = sources.filter((p) => p !== 'pages/_app.js' && read(p).includes('unaudited · testnet-only · not for real value'));
  assert.deepEqual(dupes, [], 'the footer disclaimer line is duplicated');
});
