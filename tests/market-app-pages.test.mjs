// Phase 4 identity, PR 4: /market and /kusd/app (and their components) on the ledger grammar: no template tells,
// the shared primitives, the working controls untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const FILES = ['pages/market.js', 'pages/kusd/app.js', 'components/kusd/app/ui.jsx',
  ...readdirSync(new URL('../components/kusd/market', import.meta.url)).filter((f) => f.endsWith('.jsx')).map((f) => `components/kusd/market/${f}`),
  ...readdirSync(new URL('../components/kusd/app', import.meta.url)).filter((f) => f.endsWith('.jsx')).map((f) => `components/kusd/app/${f}`)];

test('no template tells on the market and app surfaces', () => {
  for (const p of FILES) {
    const s = read(p);
    for (const tell of ['rounded-2xl', 'rounded-xl', 'rounded-lg', 'rounded-full', 'rounded-t-2xl', 'glass', 'card-hover', 'uppercase tracking', 'neon-', 'framer-motion', 'lucide-react',
                        'max-w-5xl', 'max-w-3xl', 'max-w-6xl', 'animate-spin', 'animate-pulse', 'shadow-[', 'emerald-', 'amber-', 'rose-', 'cyan-', 'sky-', 'bg-red-950', 'bg-black/']) {
      assert.ok(!s.includes(tell), `${p} still has ${tell}`);
    }
  }
});

test('both pages sit on the ledger grid and use the shared primitives', () => {
  for (const p of ['pages/market.js', 'pages/kusd/app.js']) {
    const s = read(p);
    assert.ok(s.includes("from '../components/Ledger'") || s.includes("from '../../components/Ledger'"), `${p} imports Ledger`);
    assert.ok(s.includes('<Section'), `${p} uses numbered sections`);
  }
  const ui = read('components/kusd/app/ui.jsx');
  assert.ok(ui.includes("from '../../Ledger'"), 'the app primitives derive from Ledger');
  assert.match(ui, /export const primary = /); assert.match(ui, /export const secondary = /); assert.match(ui, /export function Panel/);
  const app = read('pages/kusd/app.js');
  assert.match(app, /role="tablist"/, 'the tabs are a real tablist');
});
