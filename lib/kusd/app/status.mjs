// Figures for the app's status strip that come from the showcase snapshot rather than the chain.

/** The price sources named in the latest heartbeat note ("printed 268 (CoinGecko) / …"), or null. */
export function oracleSources(timeline) {
  const beats = (Array.isArray(timeline) ? timeline : []).filter((e) => e.step === 'HEARTBEAT' && typeof e.note === 'string');
  const latest = beats.sort((a, b) => b.time - a.time)[0];
  const names = latest ? [...latest.note.matchAll(/\d+ \(([A-Za-z][\w. -]*)\)/g)].map((m) => m[1]) : [];
  return names.length ? names : null;
}

/** Seconds since the oracle's last refresh, from DAA scores (10 per second on TN10). */
export const oracleAgeSeconds = (virtualDaa, last) => Math.max(0, Math.round((virtualDaa - last) / 10));

/** The oracle to show: the node-verified box, else the last published snapshot's, marked unverified. */
export function oracleView(protocol, snapshot) {
  if (protocol?.oracle) return { state: protocol.oracle.state, verified: true };
  const state = snapshot?.covenants?.oracle?.state;
  return state ? { state, verified: false, asOf: snapshot.generatedAt } : null;
}
