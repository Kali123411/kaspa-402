// Liveness of the kUSD showcase snapshot against TN10: is each covenant's outpoint still unspent?
// The covenant state itself sits behind a P2SH hash, so the snapshot carries the values and this only
// answers "does the chain still match them". Never throws; failures become 'unknown' / null.

import { vaultOwed } from './app/quotes.mjs';

export const TN10_API = 'https://api-tn10.kaspa.org';

/**
 * The vault panel's figures from the exported state. Since the stability fee the vault carries
 * `{collateral, debt_mc, index_at}` and the oracle a rate `index`: the debt shown is what is owed NOW
 * (vault.ag owed_cents: milli-cent principal rebased by the index, rounded up), and the ratio at the
 * liquidation price is undefined when nothing is owed (null, never NaN or Infinity).
 */
export function vaultView(vault, oracle) {
  const collateralKas = Number(vault.collateral) / 1e8;
  const debtCents = vaultOwed(vault, oracle || {});
  const ratioPct = debtCents > 0 ? (collateralKas * (Number(oracle.liq) / 1e4) * 100) / debtCents * 100 : null;
  return { collateralKas, debtCents, ratioPct };
}
export const STALE_DAA = 36000; // ag/oracle.ag: anyone may freeze the oracle after 1 hour of silence

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

async function covenantStatus(c, fetchJson, base, timeoutMs) {
  try {
    const utxos = await withTimeout(fetchJson(`${base}/addresses/${encodeURIComponent(c.address)}/utxos`), timeoutMs);
    const found = (utxos || []).some(
      (u) => u.outpoint?.transactionId === c.txid && Number(u.outpoint?.index) === c.index,
    );
    return found ? 'current' : 'moved';
  } catch {
    return 'unknown';
  }
}

async function daaScore(fetchJson, base, timeoutMs) {
  try {
    const info = await withTimeout(fetchJson(`${base}/info/blockdag`), timeoutMs);
    const n = Number(info?.virtualDaaScore);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export async function checkStatus(snapshot, fetchJson, { now = Date.now(), timeoutMs = 4000, base = TN10_API } = {}) {
  const names = Object.keys(snapshot.covenants);
  const [daa, ...statuses] = await Promise.all([
    daaScore(fetchJson, base, timeoutMs),
    ...names.map((n) => covenantStatus(snapshot.covenants[n], fetchJson, base, timeoutMs)),
  ]);
  const last = snapshot.covenants.oracle?.state?.last;
  return {
    checkedAt: new Date(now).toISOString(),
    daaScore: daa,
    covenants: Object.fromEntries(names.map((n, i) => [n, statuses[i]])),
    staleOracle: daa == null || last == null ? null : daa - last > STALE_DAA,
  };
}
