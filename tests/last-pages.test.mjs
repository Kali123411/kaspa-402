// Phase 4 identity, PR 5: /validate, /private, /list, the submit form and the small shared components (code block,
// code tabs, term tooltip, external link, footer) on the ledger grammar; the old teal and rounded classes are gone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const FILES = ['pages/validate.js', 'pages/private.js', 'pages/list.js', 'components/SubmitForm.jsx', 'components/CodeBlock.jsx', 'components/CodeTabs.jsx', 'components/Term.jsx', 'components/ExternalLink.jsx', 'components/SiteFooter.jsx'];

test('no template tells on the last pages and the shared components', () => {
  for (const p of FILES) {
    const s = read(p);
    for (const tell of ['rounded-2xl', 'rounded-xl', 'rounded-lg', 'rounded-md', 'rounded-full', 'rounded-t-lg', 'glass', 'card-hover', 'uppercase tracking', 'neon-', 'teal-', 'violet-', 'amber-', 'rose-', 'sky-', 'max-w-5xl', 'max-w-3xl', 'max-w-2xl', 'shadow-glow', 'bg-gray-950/', 'bg-[#']) {
      assert.ok(!s.includes(tell), `${p} still has ${tell}`);
    }
  }
  for (const p of ['pages/validate.js', 'pages/private.js', 'pages/list.js']) {
    assert.ok(read(p).includes("from '../components/Ledger'") && read(p).includes('<Section'), `${p} on the ledger`);
  }
  assert.ok(read('components/SubmitForm.jsx').includes("from './Ledger'"), 'the form uses the shared field style');
});
