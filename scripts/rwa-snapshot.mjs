// scripts/rwa-snapshot.mjs — copy Tessera's showcase export into public/rwa/showcase.json, marking each transaction
// with whether the public TN10 API still serves it (it prunes old transactions; the boxes they created stay
// checkable by address). Usage: node scripts/rwa-snapshot.mjs <tessera export.json> [--v3]
// (--v3: the TESS3 export from tools/export_showcase_v3.py, written to public/rwa/tess3.json)
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
const target = process.argv.includes('--v3') ? 'tess3.json' : 'showcase.json';
writeFileSync(new URL(`../public/rwa/${target}`, import.meta.url), `${JSON.stringify(snap, null, 1)}\n`);
const txs = [...seen.values()];
console.log(`public/rwa/${target}: ${snap.holders.length} boxes; ${(await Promise.all(txs)).filter(Boolean).length} of ${txs.length} transactions still on the public API`);
