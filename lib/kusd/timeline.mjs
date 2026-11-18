// Taming the transaction log (UI/UX brief, Phase 3 /kusd): routine events that repeat (price refreshes, repayments,
// vault closes, governance knobs, miner posts) collapse into one expandable group per run, so the events that matter
// (geneses, the bind, liquidations, freezes, refusals) stay visible; a text filter narrows by label, note or txid.
export const ROUTINE = new Set(['REFRESH', 'HEARTBEAT', 'REPAY', 'CLOSE', 'ADJUST', 'SET_RATE', 'SET_CEILING', 'BUDGET-SET-LIMIT', 'MINER-POST', 'SWAP_IN', 'SWAP_OUT', 'SWAP_IN_FEE', 'SWAP_OUT_FEE', 'MINT', 'TRANSFER']);

/** Consecutive routine entries with the same step become {kind:'group', step, entries}; everything else is {kind:'one', entry}. */
export function groupTimeline(entries) {
  const out = [];
  for (const e of entries) {
    const last = out[out.length - 1];
    if (ROUTINE.has(e.step) && last && last.kind === 'group' && last.step === e.step) { last.entries.push(e); continue; }
    if (ROUTINE.has(e.step)) out.push({ kind: 'group', step: e.step, entries: [e] });
    else out.push({ kind: 'one', entry: e });
  }
  // a run of one is just an entry
  return out.map((g) => (g.kind === 'group' && g.entries.length === 1 ? { kind: 'one', entry: g.entries[0] } : g));
}

/** Case-insensitive match on the step, its label, the note and the txid. */
export function filterTimeline(entries, q, labels = {}) {
  const needle = String(q || '').trim().toLowerCase();
  if (!needle) return entries;
  return entries.filter((e) => [e.step, labels[e.step], e.note, e.txid].filter(Boolean).join(' ').toLowerCase().includes(needle));
}
