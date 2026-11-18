// Phase 2 P1-5: the Money / Rails / Market cards become a connected visual stack (inline SVG) with the "you are here" marker.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('an accessible inline SVG stack: kUSD flows over k402 into the market, rails marked "you are here"', () => {
  const d = read('components/LayersDiagram.jsx');
  assert.ok(d.includes('<svg') && d.includes('viewBox=') && d.includes('role="img"') && d.includes('aria-label='), 'accessible SVG');
  for (const t of ['money.name', 'k402', 'market.name', 'HTTP 402']) assert.ok(d.includes(t), `label ${t}`);
  assert.ok(/you are here/i.test(d), 'the rails are marked');
  assert.ok(d.includes('<title>'), 'an SVG title for screen readers');
  assert.ok(!d.includes('<animate') && !d.includes('animation'), 'no motion');
  assert.ok(d.includes('LAYERS'), 'labels come from the shared story data');
});

test('the landing renders the diagram above the three layer cards', () => {
  const idx = read('pages/index.js');
  const i = idx.indexOf('<LayersDiagram'); const j = idx.indexOf('{LAYERS.map((l) => (');
  assert.ok(i > 0 && j > i, 'diagram before the cards');
});

test('the flow labels sit above the layer boxes, not across them (owner: they overlapped the cards)', () => {
  const d = read('components/LayersDiagram.jsx');
  const ys = [...d.matchAll(/<text [^>]*y=\{(\d+)\}[^>]*>(priced in kUSD or KAS|HTTP 402 → pay → 200)</g)].map((m) => Number(m[1]));
  assert.equal(ys.length, 2, 'both flow labels found');
  for (const y of ys) assert.ok(y < 40, `label at y=${y} overlaps the boxes (top edge 40)`);
});
