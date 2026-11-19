// Market board cards: equal heights regardless of description length (the two attest listings have long ones).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s = readFileSync(new URL('../components/kusd/market/MarketBoard.jsx', import.meta.url), 'utf8');

test('listing cards stretch to the row height, clamp the description, and pin the footer to the bottom', () => {
  const card = s.slice(s.indexOf('<ul className="grid'), s.indexOf('</ul>'));
  const btn = card.slice(card.indexOf('<button'), card.indexOf('>', card.indexOf('className={`')) + 1);
  for (const cls of ['h-full', 'w-full', 'flex', 'flex-col']) assert.ok(new RegExp(`\\b${cls}\\b`).test(btn), `the card button has ${cls}`);
  assert.match(card, /<li key=\{key\} className="[^"]*\bh-full\b/, 'the list item stretches too');
  assert.match(card, /line-clamp-3/, 'long descriptions are clamped');
  assert.match(card, /title=\{p\.description\}/, 'the full description stays available on hover');
  assert.match(card, /mt-auto/, 'the settled/live footer sits at the bottom of every card');
});
