// The 10 Oct 2025 crash through kUSD's oracle rate limits and vault liquidation rules. A port of kusd-framework
// tools/stress/oct10_replay.py (docs/STRESS-2025-10-10.md); tests/kusd-crash-replay.test.mjs pins it to that
// script's figures.
//
// Oracle (oracle.ag): a refresh every `refreshMin` minutes posts the market close. mint_price follows it down at
// once and rises at most price·elapsed/360000 (10% an hour); liq_price follows it up at once and falls at most
// price·elapsed/144000 (25% an hour); elapsed is capped at one hour; one minute is 600 DAA.
// Vault (vault.ag): liquidatable when collateral·liq_price·100 < debt·LIQ_RATIO. The keeper takes 110% of the
// debt and the surplus 3%, valued at liq_price and capped at collateral less the 1-KAS tombstone. A keeper trades
// one minute after it first sees the vault liquidatable, if the trade makes money at the market price.

export const START_TS = 1760126940; // 20:09 UTC, the last close before the cascade
export const PAIRS = [[175, 150], [200, 160], [200, 170], [225, 175], [250, 200]];
export const COLLATERAL_KAS = 10_000;
const DAA_PER_MIN = 600;
const MINT_UP_DIV = 360000;
const LIQ_DOWN_DIV = 144000;
const RATE_WINDOW = 36000;
const KEEPER = 1.1;
const SURPLUS = 0.03;
const TOMBSTONE_KAS = 1;

/** The bundled candles (public/kusd/oct10.json) as one row per minute. */
export function series(data) {
  return data.close.map((close, i) => ({ ts: data.start + i * data.step, low: data.low[i], close }));
}

const startIndex = (rows) => rows.findIndex((r) => r.ts >= START_TS);

/**
 * The market under a scenario.
 * real: as it happened. hold: as it happened until the close first falls `depth` below the 20:09 close, then flat
 * there. gap: flat at the 20:09 close for ten minutes, then `depth` lower in one step, flat.
 */
export function scenario(rows, { kind = 'real', depth = 0 } = {}) {
  const s = startIndex(rows);
  const p0 = rows[s].close;
  if (kind === 'gap' && depth > 0) {
    const lo = p0 * (1 - depth);
    return rows.map((r, i) => {
      const p = i < s + 10 ? p0 : lo;
      return { ts: r.ts, low: p, close: p };
    });
  }
  if (kind === 'hold' && depth > 0) {
    const level = p0 * (1 - depth);
    let k = rows.findIndex((r, i) => i >= s && r.close <= level);
    if (k < 0) return rows;
    return rows.map((r, i) => (i < k ? r : { ts: r.ts, low: level, close: level }));
  }
  return rows;
}

/** Minute by minute from 20:09: the market and the oracle's rate-limited mint and liquidation prices. */
export function oraclePath(rows, { refreshMin = 5 } = {}) {
  const s = startIndex(rows);
  let mint = rows[s].close;
  let liq = mint;
  let last = 0;
  return rows.slice(s).map((r, k) => {
    if (k > 0 && k % refreshMin === 0) {
      const now = r.close;
      const elapsed = Math.min((k - last) * DAA_PER_MIN, RATE_WINDOW);
      let nm = now;
      if (now > mint) nm = Math.min(nm, mint + Math.max((mint * elapsed) / MINT_UP_DIV, 1e-12));
      let nl = now;
      if (now < liq) nl = Math.max(nl, liq - Math.max((liq * elapsed) / LIQ_DOWN_DIV, 1e-12));
      mint = nm;
      liq = nl;
      last = k;
    }
    return { ts: r.ts, low: r.low, close: r.close, mint, liq };
  });
}

/** The two vaults the replay follows: one borrowed to the borrowing line, one sitting 0.5% above the liquidation line. */
export function vaults(p0, { minRatio, liqRatio }, collateral = COLLATERAL_KAS) {
  return {
    max: { collateral, debt: (collateral * p0 * 100) / minRatio },
    line: { collateral, debt: (collateral * p0 * 100) / (liqRatio * 1.005) },
  };
}

/**
 * Replay one vault. Returns the liquidation (null if no keeper would take it), how far underwater it went at the
 * worst minute low, what it is short if left open at the end, and one frame per minute for the slider.
 */
export function replay(path, { collateral, debt, liqRatio, keeperLag = 1 }) {
  let worst = 0;
  let liquidated = null;
  for (let i = 0; i < path.length && !liquidated; i++) {
    worst = Math.max(worst, debt - collateral * path[i].low);
    if (collateral * path[i].liq * 100 >= debt * liqRatio) continue;
    const j = Math.min(i + keeperLag, path.length - 1);
    const liq = path[j].liq; // the keeper's transaction sees the oracle as it is when it lands
    if (collateral * liq * 100 >= debt * liqRatio) continue;
    const m = path[j].close;
    const keeperKas = Math.min((debt * KEEPER) / liq, collateral - TOMBSTONE_KAS);
    const surplusKas = Math.min((debt * SURPLUS) / liq, collateral - TOMBSTONE_KAS - keeperKas);
    const keeperPnl = keeperKas * m - debt;
    if (keeperPnl >= 0) {
      liquidated = { ts: path[j].ts, market: m, liq, keeperKas, surplusKas, keeperPnl, gapUsd: Math.max(0, debt - (keeperKas + surplusKas) * m) };
    }
  }
  const end = path[path.length - 1].close;
  const shortUsd = liquidated ? liquidated.gapUsd : Math.max(0, debt - collateral * end);
  const frames = path.map((p) => {
    const ratioMarket = (collateral * p.close * 100) / debt;
    const ratioOracle = (collateral * p.liq * 100) / debt;
    const state = liquidated && p.ts >= liquidated.ts ? 'liquidated' : ratioOracle < liqRatio ? 'liquidatable' : 'healthy';
    return { ts: p.ts, market: p.close, low: p.low, liq: p.liq, mint: p.mint, ratioMarket, ratioOracle, state, underwater: ratioMarket < 100 };
  });
  return { liquidated, worstUnderwaterUsd: Math.max(0, worst), shortUsd, frames };
}
