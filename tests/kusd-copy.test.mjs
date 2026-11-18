// Review fixes for /kusd: status label honesty and public copy that must (not) appear.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { oracleStatusLabel } from '../lib/kusd/labels.mjs';

const page = readFileSync(new URL('../pages/kusd.js', import.meta.url), 'utf8');
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
  for (const f of retired) assert.match(page, new RegExp(`'${f}':`), `no FAMILY_LABEL for ${f}`);
  assert.match(page, /Previous deployments/);
});

test('a refusal by the node is not captioned as a refusal by the covenant', () => {
  assert.ok(bundled.timeline.some((e) => e.step === 'NOT_FINAL'), 'snapshot has the NOT_FINAL entry');
  assert.match(page, /NOT_FINAL: 'Future clock refused'/);
  assert.match(page, /refused by the node/);
});

test('page explains the lock-time clock', () => {
  assert.match(page, /lock time/);
});

test('the showcase links to the kUSD app', () => {
  assert.match(page, /href="\/kusd\/app"/);
  assert.match(page, /Open the kUSD app/);
});

test('snapshot pins are the new family', () => {
  // the stability-fee re-genesis: new oracle, PSM, budget, authority and vault; only the surplus carries over
  const c = bundled.covenants;
  assert.equal(c.authority.covid, '06b7532009b87f516475923a2b4dc6edb471b220391ca7c33c6fd88ff9f5ab32');
  assert.equal(c.psm.covid, '3ef81a787bbe2f762b9fc983634c50fd77aa41c5c2f0cd6aa6e3790114a390f3');
  assert.equal(c.budget.covid, 'ace2bb2c9ba4f0c9ca7d80de7023aaa9640a2055fe1d631c2b3559662bba5c91');
  assert.equal(c.oracle.covid, '57241302b9686574237377e780e31f38214558ff421c7066ab84489c1053e2ec');
  assert.equal(c.surplus.covid, 'c76efdcbe2edfe162af0730ece57f739f57888b9e55993a021aaf34271297913');
  assert.equal(c.minted.covid, c.authority.covid);
});

test('every timeline step has a label on the page', () => {
  for (const step of new Set(bundled.timeline.map((e) => e.step))) {
    assert.match(page, new RegExp(`['\\s{]'?${step}'?: '`), `no STEP_LABEL for ${step}`);
  }
});
