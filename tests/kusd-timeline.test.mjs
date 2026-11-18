// Phase 3 /kusd (part B): the transaction log groups repetitive events, filters by text, pages, and the retired
// deployments move to /kusd/history.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groupTimeline, filterTimeline, ROUTINE } from '../lib/kusd/timeline.mjs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const e = (step, txid = 'ab'.repeat(32), note = '') => ({ step, txid, note, time: 1 });

test('consecutive routine events collapse into one group; important events stay single; runs of one stay single', () => {
  const g = groupTimeline([e('REFRESH'), e('REFRESH'), e('REFRESH'), e('SET_MINER'), e('REPAY'), e('REFRESH'), e('LIQUIDATE', null)]);
  assert.deepEqual(g.map((x) => (x.kind === 'group' ? `${x.step}×${x.entries.length}` : x.entry.step)), ['REFRESH×3', 'SET_MINER', 'REPAY', 'REFRESH', 'LIQUIDATE']);
  assert.ok(ROUTINE.has('REFRESH') && !ROUTINE.has('ORACLE-GENESIS') && !ROUTINE.has('SET_MINER') && !ROUTINE.has('LIQUIDATE'));
});

test('the filter matches step, label, note or txid, case-insensitively', () => {
  const rows = [e('REFRESH', 'aa'.repeat(32), 'Price refreshed'), e('SET_MINER', 'bb'.repeat(32), 'bound the oracle')];
  assert.equal(filterTimeline(rows, 'MINER').length, 1);
  assert.equal(filterTimeline(rows, 'bbbb').length, 1);
  assert.equal(filterTimeline(rows, 'price refresh', { REFRESH: 'Price refresh' }).length, 1);
  assert.equal(filterTimeline(rows, '').length, 2);
});

test('/kusd uses the grouped, searchable, paged log and points at the history page', () => {
  const s = read('pages/kusd.js');
  assert.ok(s.includes('groupTimeline(') && s.includes('filterTimeline('), 'uses the helpers');
  assert.ok(s.includes('aria-label="Search the transaction log"'), 'search box');
  assert.ok(s.includes('<details') && s.includes('expand'), 'collapsed groups');
  assert.ok(s.includes('Show all') || s.includes('show all'), 'pagination');
  assert.ok(!s.includes('previous.map('), 'retired deployments no longer rendered here');
  assert.ok(s.includes('href="/kusd/history"'), 'pointer to the archive');
  const h = read('pages/kusd/history.js');
  assert.ok(h.includes('<title>kUSD on testnet-10 — history of deployments | k402</title>') && h.includes("family !== 'stage1'"));
});
