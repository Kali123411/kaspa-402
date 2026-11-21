// Phase 3 /kusd (part A): plain-English intro, a risk-parameter card up top, labelled figures, refused events that
// do not rely on colour, text next to every status dot, covenant ids that open the explorer, a 3-step verify walkthrough.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s = readFileSync(new URL('../pages/kusd.js', import.meta.url), 'utf8') + readFileSync(new URL('../components/kusd/Timeline.jsx', import.meta.url), 'utf8');   // the log rows moved to the shared Timeline component

test('intro says what kUSD is, how to use it and where test funds come from', () => {
  assert.ok(s.includes('In plain terms') && s.includes('href="/get-started"'), 'plain-English intro with the setup guide');
});

test('risk parameters sit at the top: 175% borrowing line, 150% liquidation line, the Stage 2 bound', () => {
  const i = s.indexOf('Risk parameters'); const j = s.indexOf('<ProductMap');
  assert.ok(i > 0 && i < j, 'risk card before the product map');
  const card = s.slice(i, i + 3000);
  for (const t of ['175%', '150%', '±5%', '45 min', '3%']) assert.ok(card.includes(t), t);
});

test('ambiguous figures are labelled and the identical mint/liq prices are explained', () => {
  assert.ok(s.includes('kUSD in circulation</span>: every kUSD held by anyone') && s.includes('deployer&apos;s test box</span>') && s.includes('unissued supply') && s.includes('What these figures mean'));
  assert.ok(s.includes('identical') && s.includes('rate limits'), 'why mint and liquidation prices can be identical');
});

test('refused events and status dots do not rely on colour alone', () => {
  assert.ok(s.includes("'no transaction'") || s.includes('no transaction —'), 'refused rows say there is no transaction');
  assert.ok(s.includes('border-dashed'), 'refused rows are dashed');
  assert.ok(s.includes("current: 'matches chain'") && s.includes("moved: 'chain moved'"), 'text beside each dot');
});

test('covenant ids open the explorer and the verify section is a numbered walkthrough', () => {
  assert.ok(s.includes('txUrl(c[n].txid)'), 'each covenant id links to its on-chain transaction');
  const i = s.indexOf('Verify it.'); const block = s.slice(i, i + 6000);
  assert.ok(block.includes('<ol') && block.includes('Step 1') && block.includes('Step 2') && block.includes('Step 3'));
});
