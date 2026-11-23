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

test('snapshot pins are the option (e) family', () => {
  // the 2026-11-22 option (e) re-genesis (origination fee at mint, SIGHASH_ALL): every covenant re-created, the
  // MinerMedian box included; the oracle carries the origination fee and is bound to the new MinerMedian box
  const c = bundled.covenants;
  assert.equal(c.oracle.covid, 'a9595462a506950b2985b053fc3a8653575e86d986f9730b1b85c60bbc89d6cc');
  assert.equal(c.psm.covid, '43eee4cc5a49a9a3dc28c2a37986d551e2788fc9d23668326e3834cb84758fdf');
  assert.equal(c.budget.covid, '51ebe9cbb94b19129e45936359621231b3afd8a7e10c81f6ab89c0d0abda2eaf');
  assert.equal(c.authority.covid, 'c869ea9f325660764f25835ad2305405720e27668a75807574d8bd05cd26f40f');
  assert.equal(c.vault.covid, '84fd64ee18c2e789389af00227ad6b6d438ea7c543a146afb6f1719dbbd748af');
  assert.equal(c.factory.covid, c.vault.covid, 'the deploy vault is in the factory group');
  assert.equal(c.surplus.covid, '8d377f75581501314d49334c35dde4ce3c695535b54da03dbce4ca2dc650342b');
  assert.equal(c.miner.covid, '27f8b2dd7c571cae5a122c5bd665e58fc109c8c4c0d656ba083700543dd01d7a');
  assert.equal(c.oracle.state.miner_id, c.miner.covid);
  assert.equal(c.oracle.state.fee, 50, 'origination fee 50 bps');
  assert.equal(c.oracle.state.receipts, 8, 'eight price receipts');
  assert.equal(c.minted.covid, c.authority.covid);
  assert.equal(bundled.stage, 'Stage 2');
});

test('every timeline step has a label on the page', () => {
  for (const step of new Set(bundled.timeline.map((e) => e.step))) {
    assert.match(labels, new RegExp(`['\\s{]'?${step}'?: '`), `no STEP_LABEL for ${step}`);
  }
});
