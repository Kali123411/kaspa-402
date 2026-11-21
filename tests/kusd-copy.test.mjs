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

test('snapshot pins are the vault-debt-ceiling family', () => {
  // the 2026-11-21 re-genesis: new PSM, budget (with the vault-debt ceiling), authority and vault; the Stage 2c
  // oracle, the surplus and the MinerMedian box carry over
  const c = bundled.covenants;
  assert.equal(c.oracle.covid, '0dac704fe95fa389a429eec46e70a04be2a2685cc4c301c8af8569abb221d242');
  assert.equal(c.psm.covid, '3ac8decaf3e4f18937810da7529859d34c0a13d2a3592c1a89ef6105ffe340ed');
  assert.equal(c.budget.covid, '5ffec54cb5e782aac194180d6567aa472c08cad3254dac3eb3c9481ad9c707b3');
  assert.equal(c.authority.covid, 'bd49c4afca5a57653efdf69c8b51e729d5f4fbc24727aaf8cf412f6b68760567');
  assert.equal(c.vault.covid, 'c08400c030f03043375972e98be83a038c94cf995b252605c03f7b88f00cf627');
  assert.equal(c.surplus.covid, 'c76efdcbe2edfe162af0730ece57f739f57888b9e55993a021aaf34271297913');
  assert.equal(c.miner.covid, 'deb0b4b9268f76c74d9dbe45bc4d0a2c335799f566ea02d7f75d9a61b8957d35');
  assert.equal(c.oracle.state.miner_id, c.miner.covid);
  assert.equal(c.minted.covid, c.authority.covid);
  assert.equal(bundled.stage, 'Stage 2');
});

test('every timeline step has a label on the page', () => {
  for (const step of new Set(bundled.timeline.map((e) => e.step))) {
    assert.match(labels, new RegExp(`['\\s{]'?${step}'?: '`), `no STEP_LABEL for ${step}`);
  }
});
