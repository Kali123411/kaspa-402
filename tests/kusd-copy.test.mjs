// Review fixes for /kusd: status label honesty and public copy that must (not) appear.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { oracleStatusLabel } from '../lib/kusd/labels.mjs';

const page = readFileSync(new URL('../pages/kusd.js', import.meta.url), 'utf8');
const labels = readFileSync(new URL('../components/kusd/Timeline.jsx', import.meta.url), 'utf8');   // STEP_LABEL, FAMILY_LABEL, TimelineEntry live here since the history page
const pageAndLabels = page + labels;
const home = readFileSync(new URL('../pages/index.js', import.meta.url), 'utf8');

test('a stale live oracle is not labeled plain "Live"', () => {
  assert.equal(oracleStatusLabel(0, true), 'Live · stale, freezable');
  assert.equal(oracleStatusLabel(0, false), 'Live');
  assert.equal(oracleStatusLabel(0, null), 'Live as of snapshot');
  assert.equal(oracleStatusLabel(1, true), 'Frozen');
  assert.equal(oracleStatusLabel(2, null), 'Settled');
});

test('page discloses that the five operators run on one machine, keys copied from the deployer', () => {
  assert.match(page, /five operators run as separate services on one machine/);
  assert.match(page, /independent operators are a pre-mainnet gate \(each on its own machine\)/);
  assert.doesNotMatch(page, /independent operators(?! are a pre-mainnet gate)/);
});

test('page does not claim the relayer signs nothing', () => {
  assert.doesNotMatch(page, /relayer signs nothing/);
});

test('copy does not claim every number is checked against the chain', () => {
  assert.doesNotMatch(home, /Every number on the page is checked/);
  assert.doesNotMatch(page, /every number here can be checked/);
});

const bundled = JSON.parse(readFileSync(new URL('../public/kusd/snapshot.json', import.meta.url), 'utf8'));

test('every retired family in the snapshot has a label on the page', () => {
  const retired = [...new Set(bundled.timeline.map((e) => e.family).filter((f) => f !== 'stage1'))];
  assert.ok(retired.length >= 2, `expected the retired Stage 1 and Phase 5 families, got ${retired}`);
  for (const f of retired) assert.match(pageAndLabels, new RegExp(`'${f}':`), `no FAMILY_LABEL for ${f}`);
  assert.match(page, /Previous deployments/);
});

test('a refusal by the node is not captioned as a refusal by the covenant', () => {
  assert.ok(bundled.timeline.some((e) => e.step === 'NOT_FINAL'), 'snapshot has the NOT_FINAL entry');
  assert.match(pageAndLabels, /NOT_FINAL: 'Future clock refused'/);
  assert.match(pageAndLabels, /refused by the node/);
});

test('page explains the lock-time clock', () => {
  assert.match(page, /lock time/);
});

test('the showcase links to the kUSD app', () => {
  assert.match(page, /href="\/kusd\/app"/);
  assert.match(page, /Open the kUSD app/);
});

test('snapshot pins are the price-receipts family', () => {
  // the 2026-11-22 re-genesis: an oracle with price receipts and operator pay, and everything that pins it (PSM,
  // budget, surplus, factory, authority, the deploy vault); only the MinerMedian box carries over
  const c = bundled.covenants;
  assert.equal(c.oracle.covid, 'bd0115871904591ba3eb662a2c3e22142a7e76092676e7609b6dc396684bf44a');
  assert.equal(c.psm.covid, 'b19fdcc1466cf9204b7fe3c3b6e21f7a4c3ea5996d2410b0f1e67e5a59ab12f6');
  assert.equal(c.budget.covid, '6fc11fbe613ce8a1c0ed6b9492afbcecd9d9ea4c330a3e42f788ea0b665bc66a');
  assert.equal(c.authority.covid, '5aca3c95104b788330399f71068129c1a8d9439395665d09e53719fa5a2e2ce5');
  assert.equal(c.vault.covid, '87e388356d31e0eeb8134f14029509856cf6672791753aafc58c827039cfd5ca');
  assert.equal(c.factory.covid, c.vault.covid, 'the deploy vault is in the factory group');
  assert.equal(c.surplus.covid, 'e8c829452010639c57970f3b4bf161f42f6792ddc03c2fc7009e744d41d0bb0c');
  assert.equal(c.miner.covid, 'deb0b4b9268f76c74d9dbe45bc4d0a2c335799f566ea02d7f75d9a61b8957d35');
  assert.equal(c.oracle.state.miner_id, c.miner.covid);
  assert.equal(c.oracle.state.receipts, 8, 'eight price receipts');
  assert.equal(c.minted.covid, c.authority.covid);
  assert.equal(bundled.stage, 'Stage 2');
});

test('every timeline step has a label on the page', () => {
  for (const step of new Set(bundled.timeline.map((e) => e.step))) {
    assert.match(labels, new RegExp(`['\\s{]'?${step}'?: '`), `no STEP_LABEL for ${step}`);
  }
});
