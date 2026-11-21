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

test('snapshot pins are the hardened-PSM family', () => {
  // the second 2026-11-21 re-genesis: new PSM (share cap, pro-rata, top-up), budget, authority and vault; the Stage 2c
  // oracle, the surplus and the MinerMedian box carry over
  const c = bundled.covenants;
  assert.equal(c.oracle.covid, '0dac704fe95fa389a429eec46e70a04be2a2685cc4c301c8af8569abb221d242');
  assert.equal(c.psm.covid, '2af0badc857320433d13a204909296af7fec4b6e68c3002c3c3574467a135e0f');
  assert.equal(c.budget.covid, 'ed6618f08b97d2adfb560727de27035ca66495f095021b6a05849f082a59de11');
  assert.equal(c.authority.covid, 'c009a536314da2b3b61d0fb97a9f17559d6cca4a933a62f02d054d8b16a0e250');
  assert.equal(c.vault.covid, 'f9e4224ff0814c82440fca2edb845ab3c2213102838bf36a2c0ba40f1d73dec9');
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
