// Phase 2 P0 (1, 4): the hero has ONE primary call to action and a persona split right after it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const s = readFileSync(new URL('../pages/index.js', import.meta.url), 'utf8');
const hero = s.slice(s.indexOf('<main'), s.indexOf('id="personas"'));

test('one primary CTA in the hero, Browse services as the ghost button, the rest moved out', () => {
  assert.equal((hero.match(/btn-kaspa/g) || []).length, 1, 'exactly one primary button in the hero');
  assert.ok(hero.includes('Agents start here'), 'the primary CTA');
  assert.ok(hero.includes('Browse services'), 'the secondary CTA');
  assert.ok(!hero.includes('Validate your service') && !hero.includes('Pay privately'), 'no competing CTAs in the hero');
});

test('persona split follows the hero: agent builder vs API seller, each with its next step', () => {
  const i = s.indexOf('id="personas"');
  assert.ok(i > 0, 'a personas section');
  const block = s.slice(i, i + 4000);
  assert.ok(block.includes('I&apos;m building an agent') && block.includes('I&apos;m selling an API'));
  assert.ok(block.includes('href="#agents"') && block.includes('href="/get-started"'), 'builder path → steps + setup guide');
  assert.ok(block.includes('href="/validate"') && block.includes('href="/list"'), 'seller path → validate + list');
  const how = s.indexOf('1 · the agent calls');
  assert.ok(i < how, 'the split comes before the how-it-works strip');
});
