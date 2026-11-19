// Phase 4 identity, PR 6: what the Lighthouse pass found (mobile + desktop, 11 pages) and the fix each one got.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const require = createRequire(import.meta.url);

const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };

test('every text gray reads at 4.5:1 on the ground and on the panel (color-contrast, 17 runs)', () => {
  const g = require('../tailwind.config.js').theme.extend.colors.gray;
  for (const step of [50, 100, 200, 300, 400, 500, 600]) {
    assert.ok(contrast(g[step], g[950]) >= 4.5, `gray-${step} on ground: ${contrast(g[step], g[950]).toFixed(2)}`);
    assert.ok(contrast(g[step], g[900]) >= 4.5, `gray-${step} on panel: ${contrast(g[step], g[900]).toFixed(2)}`);
  }
});

test('every select has a name (select-name: home, /list, /validate)', () => {
  assert.match(read('pages/index.js'), /<select value=\{net\}.*aria-label="network"/);
  const form = read('components/SubmitForm.jsx');
  assert.equal((form.match(/<select /g) || []).length, (form.match(/<select [^>]*\bid="sf-/g) || []).length, 'each form select carries an id its label points at');
  assert.match(form, /htmlFor=\{id\}/);
  assert.match(read('pages/validate.js'), /<select [^>]*id="v-net"/); assert.match(read('pages/validate.js'), /htmlFor="v-net"/);
});

test('the live dot is an image, so its aria-label is allowed (aria-prohibited-attr)', () => {
  assert.match(read('components/kusd/LiveBadge.jsx'), /<span role="img" title=\{label\} aria-label=\{label\}/);
});

test('panel titles are h2 under the page h1 (heading-order on /market and /kusd/app)', () => {
  assert.match(read('components/kusd/app/ui.jsx'), /<h2 className=\{H3\}>\{title\}<\/h2>/);
  assert.doesNotMatch(read('components/kusd/app/ui.jsx'), /<h3/);
});

test('the glossary dl has dt and dd as direct children of each entry (definition-list, dlitem)', () => {
  const s = read('pages/glossary.js');
  assert.doesNotMatch(s, /<div className="min-w-0">\s*<dd/);
  assert.match(s, /<dd className="min-w-0 text-\[15px\]/); assert.match(s, /<dd className="min-w-0 lg:col-start-2/);
});

test('the kUSD state table names every column (td-has-header)', () => {
  const ths = [...read('pages/kusd.js').matchAll(/<th scope="col"[^>]*>([^<]*)<\/th>/g)].map((m) => m[1]);
  assert.deepEqual(ths, ['covenant', 'item', 'value', 'on chain']);
});

test('links inside running text are underlined, not colour-only (link-in-text-block on /market)', () => {
  assert.doesNotMatch(read('components/kusd/market/OperatorDrawer.jsx'), /className="text-accent hover:underline"/);
});

test('the recording has intrinsic dimensions (unsized-images on /private)', () => {
  assert.match(read('pages/private.js'), /<img src="\/private-loop\.gif"[^>]*width=\{1056\} height=\{770\}/);
});

test('/skill/<cap> renders on the server with a description, and reserves the list height (meta-description, CLS 0.17)', () => {
  const s = read('pages/skill/[cap].js');
  assert.match(s, /export async function getServerSideProps/); assert.doesNotMatch(s, /useRouter/);
  assert.match(s, /<meta name="description"/);
  assert.match(s, /<ul className="m-0 mt-4 min-h-\[/);
});

test('/kusd/app reserves the status strip and tab panel heights before the wallet loads (CLS 0.19)', () => {
  const s = read('pages/kusd/app.js');
  assert.match(s, /<div className="mt-6 min-h-\[[^"]*"><StatusStrip/); assert.match(s, /<div className="mt-6 min-h-\[[^"]*">\s*\{tab === 'Wallet'/);
});

test('no glossary term wraps a link: nested anchors broke hydration on the landing (React #418, errors-in-console)', () => {
  for (const p of ['pages/index.js', 'pages/kusd.js', 'pages/market.js', 'pages/validate.js', 'pages/private.js', 'pages/list.js', 'pages/get-started.js']) {
    assert.doesNotMatch(read(p), /<Term[^>]*>\s*<(a|ExternalLink|Link)\b/, `${p}: a Term wrapping a link`);
  }
});
