// The /rwa register's liveness: is each holder box (a Tessera covenant output) still unspent at its address?
// The figures come from the exported snapshot (tools/export_showcase.py in Tessera compiles each claimed state to
// its address and keeps only boxes a TN10 node reports); this only answers "does the chain still hold them".
// Never throws: a failed lookup is 'unknown'.
import { TN10_API } from '../kusd/status.mjs';

export const T_PLUS_ONE_S = 86_400; // US equities settle T+1: one business day

/** 'current' | 'moved' | 'unknown' for one box. */
export async function boxStatus(h, fetchJson, base = TN10_API) {
  try {
    const utxos = await fetchJson(`${base}/addresses/${encodeURIComponent(h.address)}/utxos`);
    return (utxos || []).some((u) => u.outpoint?.transactionId === h.txid && Number(u.outpoint?.index) === h.index) ? 'current' : 'moved';
  } catch {
    return 'unknown';
  }
}

/** Status of every box, in order, plus counts. */
export async function checkRegister(holders, fetchJson, { base = TN10_API } = {}) {
  const boxes = await Promise.all(holders.map((h) => boxStatus(h, fetchJson, base)));
  const counts = { current: 0, moved: 0, unknown: 0 };
  for (const b of boxes) counts[b] += 1;
  return { boxes, counts };
}

/** The supply audit from the holder rows: minter note + circulating = authorized. */
export function auditOf(holders) {
  const minter = holders.filter((h) => h.minter).reduce((a, h) => a + h.amount, 0);
  const circulating = holders.filter((h) => !h.minter).reduce((a, h) => a + h.amount, 0);
  return { minter, circulating, total: minter + circulating };
}

/** The fastest recorded trade (submit → network-accepted). */
export function fastestSettlement(settlements) {
  const s = settlements.reduce((best, x) => (best == null || x.submit_to_chain_accepted_s < best.submit_to_chain_accepted_s ? x : best), null);
  return s ? { ...s, seconds: s.submit_to_chain_accepted_s } : null;
}
