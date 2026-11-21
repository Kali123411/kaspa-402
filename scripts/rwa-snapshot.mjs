// scripts/rwa-snapshot.mjs — copy Tessera's showcase export into public/rwa/showcase.json, marking each transaction
// with whether the public TN10 API still serves it (it prunes old transactions; the boxes they created stay
// checkable by address). Usage: node scripts/rwa-snapshot.mjs <tessera export.json>
import { readFileSync, writeFileSync } from 'node:fs';
const API = process.env.KUSD_TN10_API || 'https://api-tn10.kaspa.org';
const snap = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const seen = new Map();
async function onExplorer(txid) {
  if (!seen.has(txid)) {
    seen.set(txid, fetch(`${API}/transactions/${txid}`, { signal: AbortSignal.timeout(10000) })
      .then(async (r) => r.ok && (await r.json()).transaction_id === txid).catch(() => false));
  }
  return seen.get(txid);
}
for (const r of snap.rules) for (const p of r.proofs) if (p.txid) p.onExplorer = await onExplorer(p.txid);
for (const s of snap.settlements) s.onExplorer = await onExplorer(s.txid);
writeFileSync(new URL('../public/rwa/showcase.json', import.meta.url), `${JSON.stringify(snap, null, 1)}\n`);
const txs = [...seen.values()];
console.log(`public/rwa/showcase.json: ${snap.holders.length} boxes; ${(await Promise.all(txs)).filter(Boolean).length} of ${txs.length} transactions still on the public API`);
