// /kusd/whitepaper: the kUSD whitepaper (kaspa-402/kusd-framework, branch docs/yellow-paper, commit e7fbf9a,
// docs/WHITEPAPER.md + docs/whitepaper-k402-flow.svg), published as written. The text is kept verbatim in
// content/kusd/WHITEPAPER.md and parsed at build time, so these tests pin the copy and check that the parser drops no word.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { parseWhitepaper, textOf } from '../lib/kusd/whitepaper.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const sha = (p) => createHash('sha256').update(readFileSync(new URL(`../${p}`, import.meta.url))).digest('hex');
const MD = read('content/kusd/WHITEPAPER.md');

test('the paper and its figure are byte-identical to the source commit', () => {
  assert.equal(sha('content/kusd/WHITEPAPER.md'), 'bd2b5f6f6dc64178efde0ba0a29e9697021fa94eacbd257d583752f8c26452c6');
  assert.equal(sha('public/kusd/whitepaper-k402-flow.svg'), 'f2f2c72c4355fd1f4c51aedcb5d409ca3eb10c7b2aa4d0deaa958f1abb038703');
});

test('every section is parsed, in order, with the Important notice last', () => {
  const doc = parseWhitepaper(MD);
  assert.equal(doc.title, 'kUSD Whitepaper');
  assert.equal(doc.byline, 'Nov 27, 2026 · Mervin');
  assert.deepEqual(doc.sections.map((s) => s.heading), [
    'Summary', 'The problem', 'What kUSD is', 'How an agent uses kUSD', 'What holds it near $1', 'Why you can check it',
    'Who controls it', 'Launch plan', 'Risks', 'Status and next steps', 'Important notice',
  ]);
  const notice = doc.sections.at(-1);
  assert.equal(notice.blocks.length, 1);
  assert.match(textOf({ sections: [notice] }), /^Important notice\nThis paper describes software under development\..*the specification governs\.$/s);
});

test('lists, tables, bold leads and the figure keep their structure', () => {
  const doc = parseWhitepaper(MD);
  const blocks = doc.sections.flatMap((s) => s.blocks);
  assert.equal(blocks.filter((b) => b.type === 'table').length, 3);
  assert.equal(blocks.filter((b) => b.type === 'ul').length, 5);
  const img = blocks.find((b) => b.type === 'img');
  assert.deepEqual(img, { type: 'img', alt: 'An agent pays for a result in one round trip, with no human approving it', src: 'whitepaper-k402-flow.svg' });
  const status = doc.sections.find((s) => s.heading === 'Status and next steps').blocks.find((b) => b.type === 'table');
  assert.deepEqual(status.head, ['', 'status']);
  assert.equal(status.rows.length, 8);
  assert.deepEqual(status.rows.at(-1), ['Mainnet', 'no date; after all of the above']);
  const prices = doc.sections.find((s) => s.heading === 'What holds it near $1').blocks[2];
  assert.deepEqual(prices.inline[0], { text: 'Prices.', strong: true });
  assert.equal(prices.inline[1].strong, false);
});

test('no word of the source is lost or reordered', () => {
  // the source with its markdown syntax removed, by a different route than the parser takes
  const words = (s) => s.split(/\s+/).filter(Boolean);
  const source = MD.split('\n')
    .filter((l) => !/^\|( ?-+ ?\|)+$/.test(l))
    .map((l) => l.replace(/^#+ /, '').replace(/^- /, '').replace(/^!\[(.*)\]\(.*\)$/, '$1').replaceAll('**', '').replaceAll('|', ' '))
    .join(' ');
  assert.deepEqual(words(textOf(parseWhitepaper(MD))), words(source));
});

test('the page renders the parsed paper on the ledger and keeps the notice visible', () => {
  const p = read('pages/kusd/whitepaper.js');
  assert.ok(p.includes("from '../../lib/kusd/whitepaper.mjs'"), 'uses the parser');
  assert.ok(p.includes('content/kusd/WHITEPAPER.md'), 'reads the verbatim copy');
  assert.ok(p.includes('getStaticProps'), 'parsed at build time, served static');
  assert.ok(p.includes("from '../../components/Ledger'"), 'on the ledger grid');
  assert.ok(!p.includes('<details'), 'nothing folded away, the notice included');
  assert.ok(p.includes("'Important notice'"), 'the notice gets its own treatment');
  for (const tell of ['rounded-2xl', 'rounded-xl', 'rounded-lg', 'glass', 'uppercase tracking', 'framer-motion', 'lucide-react']) assert.ok(!p.includes(tell), tell);
});

test('/kusd links to the whitepaper', () => {
  assert.ok(read('pages/kusd.js').includes('href="/kusd/whitepaper"'));
});

test('the yellow paper is not published', () => {
  const walk = (d) => readdirSync(new URL(`../${d}`, import.meta.url)).flatMap((f) => (statSync(new URL(`../${d}/${f}`, import.meta.url)).isDirectory() ? walk(`${d}/${f}`) : [`${d}/${f}`]));
  for (const f of [...walk('content'), ...walk('public'), ...walk('pages')]) {
    assert.ok(!/yellow/i.test(f), f);
    if (/\.(md|js|jsx|mjs|html|txt|json)$/.test(f)) assert.ok(!read(f).includes('YELLOW-PAPER'), f);
  }
});
