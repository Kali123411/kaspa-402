// /kusd crash replay: the 10 Oct 2025 crash through kUSD's oracle rate limits and vault liquidation rules, in the
// browser. lib/kusd/stress.mjs ports kusd-framework tools/stress/oct10_replay.py; these figures are that script's
// output (docs/STRESS-2025-10-10.md, kusd-framework #56), so the page and the report can't drift apart.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { series, scenario, oraclePath, vaults, replay, START_TS, PAIRS } from '../lib/kusd/stress.mjs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const data = JSON.parse(read('public/kusd/oct10.json'));
const hhmm = (ts) => new Date(ts * 1000).toISOString().slice(11, 16);

function run(kind, depth, [minRatio, liqRatio], which) {
  const s = scenario(series(data), { kind, depth });
  const path = oraclePath(s, { refreshMin: 5 });
  const v = vaults(path[0].close, { minRatio, liqRatio })[which];
  return replay(path, { ...v, liqRatio, keeperLag: 1 });
}
const close = (a, b) => assert.ok(Math.abs(a - b) < 0.006, `${a} vs ${b}`);

test('the window starts at the last close before the cascade, $0.07107 at 20:09 UTC', () => {
  const path = oraclePath(series(data), { refreshMin: 5 });
  assert.equal(hhmm(path[0].ts), '20:09');
  assert.equal(path[0].ts, START_TS);
  assert.equal(path[0].close, 0.07107);
  assert.equal(Math.min(...path.map((p) => p.low)), 0.0091);
});

test('the real night: the liquidation price bottomed 35.3% down while the market fell 87%', () => {
  const path = oraclePath(series(data), { refreshMin: 5 });
  const minLiq = Math.min(...path.map((p) => p.liq));
  assert.equal((100 * (1 - minLiq / path[0].close)).toFixed(1), '35.3');
});

test('the real night: every vault is liquidated with the keeper in profit and nothing short', () => {
  for (const pair of PAIRS) for (const which of ['max', 'line']) {
    const r = run('real', 0, pair, which);
    assert.ok(r.liquidated, `${pair} ${which}`);
    assert.ok(r.liquidated.keeperPnl >= 0);
    assert.equal(r.shortUsd, 0);
  }
  const r = run('real', 0, [200, 170], 'max');
  assert.equal(hhmm(r.liquidated.ts), '21:43');
  close(r.liquidated.keeperPnl, 4.73);
  close(r.worstUnderwaterUsd, 264.35);
  const l = run('real', 0, [200, 170], 'line');
  assert.equal(hhmm(l.liquidated.ts), '20:55');
  close(l.liquidated.keeperPnl, 36.82);
});

test('if a 43% fall had stuck: 175/150 max borrow is never closed and $1.02 short; 200/170 closes at 22:44', () => {
  const old = run('hold', 0.43, [175, 150], 'max');
  assert.equal(old.liquidated, null);
  close(old.shortUsd, 1.02);
  const neu = run('hold', 0.43, [200, 170], 'max');
  assert.equal(hhmm(neu.liquidated.ts), '22:44');
  close(neu.liquidated.keeperPnl, 4.48);
});

test('if a 50% fall had stuck: 175/150 is $50.76 short; 200/170 is exactly solvent and nobody closes it', () => {
  close(run('hold', 0.5, [175, 150], 'max').shortUsd, 50.76);
  const neu = run('hold', 0.5, [200, 170], 'max');
  assert.equal(neu.liquidated, null);
  close(neu.shortUsd, 0);
});

test('a gap faster than one refresh, against vaults at the line', () => {
  close(run('gap', 0.35, [175, 150], 'line').shortUsd, 9.49);
  close(run('gap', 0.35, [200, 170], 'line').liquidated.keeperPnl, 0.58);
  close(run('gap', 0.40, [175, 150], 'line').shortUsd, 45.02);
  close(run('gap', 0.40, [200, 170], 'line').liquidated.keeperPnl, 2.32);
  close(run('gap', 0.42, [200, 170], 'line').shortUsd, 3.77);
});

test('every minute has a frame the slider can show', () => {
  const r = run('real', 0, [175, 150], 'max');
  assert.equal(r.frames.length, oraclePath(series(data), { refreshMin: 5 }).length);
  const f = r.frames[0];
  for (const k of ['ts', 'market', 'liq', 'ratioMarket', 'ratioOracle', 'state']) assert.ok(k in f, k);
  assert.equal(f.state, 'healthy');
  assert.ok(r.frames.some((x) => x.state === 'liquidated'));
});

test('the /kusd page shows the replay with sliders, the live lines and the proposed ones', () => {
  const page = read('pages/kusd.js');
  assert.match(page, /import CrashReplay from '\.\.\/components\/kusd\/CrashReplay'/);
  assert.match(page, /<CrashReplay \/>/);
  const c = read('components/kusd/CrashReplay.jsx');
  assert.match(c, /type="range"/);
  assert.match(c, /aria-label="Time, UTC"/);
  assert.match(c, /aria-label="Borrowing line"/);
  assert.match(c, /aria-label="Liquidation line"/);
  assert.match(c, /Mainnet lines \(kusd-framework #56, merged\)/);
  assert.doesNotMatch(c, /not merged yet|proposed/i);
  assert.match(page, /Mainnet: 200% \/ 170% \(kusd-framework #56\)/);
  assert.match(c, /\/kusd\/oct10\.json|oct10\.json/);
});

test('the chart only reads fields the oracle path has (a missing one broke the /kusd prerender)', () => {
  const c = read('components/kusd/CrashReplay.jsx');
  const row = oraclePath(series(data), { refreshMin: 5 })[0];
  const keys = [...c.matchAll(/line\('(\w+)'\)/g)].map((m) => m[1]);
  assert.ok(keys.length >= 2);
  for (const k of keys) assert.ok(k in row, `path rows have no ${k}`);
  const chart = c.slice(c.indexOf('function Chart'), c.indexOf('function Bar'));
  for (const m of chart.matchAll(/\bf\.(\w+)/g)) assert.ok(m[1] in row, `Chart reads f.${m[1]}, which path rows lack`);
});
