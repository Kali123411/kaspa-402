// Phase 4 identity, PR 3: the document pages (/kusd, /kusd/history, /glossary, /get-started) on the fluid ledger grid,
// sharing one Ledger component with the landing; no template tells left on them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const PAGES = ['pages/kusd.js', 'pages/kusd/history.js', 'pages/glossary.js', 'pages/get-started.js', 'components/kusd/Timeline.jsx', 'components/kusd/ProductMap.jsx', 'components/Freshness.jsx'];

test('one Ledger component carries the section grammar for the landing and the document pages', () => {
  const l = read('components/Ledger.jsx');
  for (const name of ['export function Section', 'export const MARK', 'export const H2', 'export const H3', 'export const LINK', 'export const PAGE']) assert.ok(l.includes(name), name);
  assert.match(l, /max-w-\[1600px\]/, 'the page grid');
  assert.match(l, /lg:grid-cols-\[180px_minmax\(0,1fr\)\]/, 'the margin column');
  for (const p of ['pages/index.js', 'pages/kusd.js', 'pages/glossary.js', 'pages/get-started.js', 'pages/kusd/history.js']) assert.ok(read(p).includes("from '../components/Ledger'") || read(p).includes("from '../../components/Ledger'"), `${p} uses Ledger`);
});

test('no template tells on the document pages', () => {
  for (const p of PAGES) {
    const s = read(p);
    for (const tell of ['rounded-2xl', 'rounded-xl', 'rounded-lg', 'rounded-full border', 'glass', 'card-hover', 'uppercase tracking', 'neon-', 'framer-motion', 'lucide-react', 'max-w-5xl', 'max-w-3xl', 'bg-kaspa-card', 'animate-pulse', 'shadow-[']) {
      assert.ok(!s.includes(tell), `${p} still has ${tell}`);
    }
  }
  assert.ok(read('pages/kusd.js').includes('<Section'), '/kusd is numbered sections');
  assert.ok(read('pages/kusd.js').includes('<table'), 'system state is a table, not six cards');
});
