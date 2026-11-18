// Phase 4 identity (design doc docs/uiux/2026-11-18-identity-design.md): the graphite + acid palette and the serif/mono type
// are the Tailwind theme, the template tells are gone from the global stylesheet and the shell, and nothing hardcodes the old teal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
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

test('the theme is the identity: graphite neutrals, one acid accent, serif display and body, JetBrains Mono data', () => {
  const t = require('../tailwind.config.js').theme.extend;
  assert.equal(t.colors.gray[950].toUpperCase(), '#16181D', 'ground');
  assert.equal(t.colors.gray[900].toUpperCase(), '#1F2229', 'panel');
  assert.equal(t.colors.gray[800].toUpperCase(), '#2B2F37', 'rule');
  assert.equal(t.colors.gray[500].toUpperCase(), '#8B9099', 'muted');
  assert.equal(t.colors.teal[400].toUpperCase(), '#D1FF4A', 'the accent (every text-teal-400 in the site)');
  assert.equal(t.colors.neon.purple.toUpperCase(), '#D1FF4A', 'neon-purple is the same accent');
  assert.ok(t.fontFamily.orbitron[0].includes('Fraunces') && t.fontFamily.sans[0].includes('Source Serif') && t.fontFamily.mono[0].includes('JetBrains'));
  assert.deepEqual(Object.values(t.boxShadow || {}).filter((v) => /rgba/.test(v)), [], 'no glow shadows');
  assert.equal(t.borderRadius?.xl, '0px'); assert.equal(t.borderRadius?.['2xl'], '0px');
});

test('the global stylesheet carries no template tells', () => {
  const css = read('styles/globals.css');
  for (const tell of ['backdrop-filter', 'text-shadow', 'repeating-linear-gradient', 'shimmer', 'translateY(-8px)', 'Geist']) assert.ok(!css.includes(tell), `globals.css still has ${tell}`);
  assert.ok(css.includes('Fraunces') && css.includes('Source+Serif+4') && css.includes('JetBrains+Mono'), 'the three fonts');
  assert.ok(css.includes('prefers-reduced-motion'), 'reduced motion still honoured');
});

test('the shell and components hardcode none of the old colours', () => {
  const app = read('pages/_app.js');
  for (const tell of ['neon-text', 'animate-pulse', 'shadow-glow', 'backdrop-blur']) assert.ok(!app.includes(tell), `_app still has ${tell}`);
  for (const p of [...walk('pages'), ...walk('components')]) {
    const s = read(p);
    for (const hex of ['#2dd4bf', '#5eead4', '#374151', '#9ca3af', '#6b7280', '#1f2937', '#f3f4f6']) assert.ok(!s.toLowerCase().includes(hex), `${p} hardcodes ${hex}`);
  }
});
