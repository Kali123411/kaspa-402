// Phase 4 identity, PR 6: the old template names are gone from every page and component, and the shims that kept them
// rendering (the teal/neon/kaspa colour aliases, the .glass/.card-hover/.search-input/.skeleton utilities) are retired.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), 'utf8');
function walk(dir, out = []) {
  for (const f of readdirSync(join(root, dir))) {
    const p = join(dir, f);
    if (statSync(join(root, p)).isDirectory()) walk(p, out); else if (/\.(js|jsx|mjs)$/.test(f)) out.push(p);
  }
  return out;
}
const TELLS = /\bglass(-light)?\b|card-hover|search-input|\bskeleton\b|neon-[a-z]+|kaspa-teal|gradient-text|shadow-glow|teal-[0-9]+|rounded-(2xl|xl|lg|md|t-lg)|violet-|amber-|rose-|emerald-/;

test('no old template class names anywhere in pages, components or lib', () => {
  const files = [...walk('pages'), ...walk('components'), ...walk('lib')].filter((p) => !p.startsWith('pages/api/'));
  const hits = files.filter((p) => TELLS.test(read(p)));
  assert.deepEqual(hits, [], `old names in: ${hits.join(', ')}`);
});

test('the colour aliases and utility shims that backed the old names are retired', () => {
  const tw = read('tailwind.config.js');
  for (const alias of ['teal:', 'neon:', "'kaspa-teal'", 'kaspa:']) assert.ok(!tw.includes(alias), `tailwind still defines ${alias}`);
  const css = read('styles/globals.css');
  for (const shim of ['.glass', '.card-hover', '.search-input', '.skeleton', '.neon-text', '.gradient-text-kaspa']) assert.ok(!css.includes(shim), `globals still ships ${shim}`);
  assert.ok(css.includes('.btn-kaspa'), 'the one filled button stays');
});
