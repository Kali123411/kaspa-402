// The transaction log's building blocks, shared by /kusd (the live family) and /kusd/history (retired families).
import { ExternalLink } from 'lucide-react';

export const txUrl = (id) => `https://api-tn10.kaspa.org/transactions/${id}`;
export const short = (h) => `${h.slice(0, 8)}…${h.slice(-4)}`;
export const day = (t) => new Date(t * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

export const STEP_LABEL = {
  'ORACLE-GENESIS': 'Oracle genesis', 'PSM-GENESIS': 'PSM genesis', 'SURPLUS-GENESIS': 'Surplus genesis',
  'BUDGET-GENESIS': 'Budget genesis', 'AUTHORITY-GENESIS': 'Token authority genesis', WIRE: 'Wire PSM',
  'BUDGET-WIRE': 'Wire budget', 'VAULT-GENESIS': 'Vault genesis', REFRESH: 'Price refresh',
  REFUSED_PRINTS: 'Bad prints refused', SET_MEMBER: 'Operator rotation', 'BUDGET-SET-LIMIT': 'Budget limit change',
  MINT: 'Mint', FREEZE: 'Oracle frozen', SWAP_OUT_FEE: 'PSM redeem with fee', LIQUIDATE: 'Liquidation',
  SET_MINER: 'Oracle bound to the miner median', 'MINER-POST': 'Miner median posted',
  SURPLUS_SPEND: 'Surplus spend', CLOSE: 'Vault close', HEARTBEAT: 'Routine refreshes', REPAY: 'Repay', ADJUST: 'Collateral top-up',
  NOT_FINAL: 'Future clock refused', SET_CEILING: 'PSM parameters', SET_RATE: 'Stability fee change', LIQ_REFUSED: 'Liquidation refused (above 150%)', SWAP_IN: 'PSM swap in', SWAP_OUT: 'PSM redeem',
};

// Retired covenant families, shown together under "Previous deployments".
export const FAMILY_LABEL = { 'stage1-v1': 'Stage 1, first deployment', 'phase5': 'Phase 5' };

export function Tx({ id }) {
  return (
    <a href={txUrl(id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-neon-purple hover:underline">
      {short(id)} <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  );
}


export function TimelineEntry({ e }) {
  const refused = e.txid == null;
  const family = FAMILY_LABEL[e.family];
  return (
    <li className={`rounded-xl border p-4 ${refused ? 'border-dashed border-amber-400/50 bg-amber-400/5' : 'border-gray-800 bg-black/30'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-white">
          {STEP_LABEL[e.step] || e.step}
          {family && <span className="ml-2 font-mono text-[10px] font-normal uppercase tracking-wider text-gray-500">{family}</span>}
        </div>
        {refused
          ? <span className="font-mono text-xs uppercase tracking-wider text-amber-300">{e.step === 'NOT_FINAL' ? 'refused by the node' : 'refused by the covenant'} · {'no transaction'}</span>
          : <Tx id={e.txid} />}
      </div>
      <p className="mt-1 text-sm text-gray-400">{e.note}</p>
      <div className="mt-1 font-mono text-[11px] text-gray-600">{day(e.time)}</div>
    </li>
  );
}
