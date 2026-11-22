// The transaction log's building blocks, shared by /kusd (the live family) and /kusd/history (retired families).
import { LINK } from '../Ledger';

export const txUrl = (id) => `https://api-tn10.kaspa.org/transactions/${id}`;
export const short = (h) => `${h.slice(0, 8)}…${h.slice(-4)}`;
export const day = (t) => new Date(t * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

export const STEP_LABEL = {
  'ORACLE-GENESIS': 'Oracle genesis', 'PSM-GENESIS': 'PSM genesis', 'SURPLUS-GENESIS': 'Surplus genesis',
  'BUDGET-GENESIS': 'Budget genesis', 'AUTHORITY-GENESIS': 'Token authority genesis', WIRE: 'Wire PSM',
  'BUDGET-WIRE': 'Wire budget', 'VAULT-GENESIS': 'Vault genesis', REFRESH: 'Price refresh',
  REFUSED_PRINTS: 'Bad prints refused', SET_MEMBER: 'Operator rotation', 'BUDGET-SET-LIMIT': 'Budget limit change', 'BUDGET-SET-VAULT-CEILING': 'Vault-debt ceiling change', 'PSM-TOP-UP': 'PSM reserve top-up', 'FACTORY-GENESIS': 'Vault factory genesis', 'FACTORY-WIRE': 'Wire vault factory', 'SET-RECEIPTS': 'Create price receipts', 'SURPLUS-TOP-UP': 'Treasury top-up', 'KUSDT-TEST-GENESIS': 'kUSDT-code test token', 'KUSD-KUSDT-SWAP': 'kUSD / kUSDT atomic swap', CLAIM: 'Operator pay claim', 'SET-PAY': 'Operator pay rates', 'SWEEP-FEES': 'PSM fees to the treasury', TRANSFER: 'kUSD transfer', PSM_CAP_REFUSED: 'PSM buy refused at the share cap', CEILING_REFUSED: 'Mint refused at the vault-debt ceiling',
  MINT: 'Mint', FREEZE: 'Oracle frozen', SWAP_OUT_FEE: 'PSM redeem with fee', LIQUIDATE: 'Liquidation',
  SET_MINER: 'Oracle bound to the miner median', 'MINER-POST': 'Miner median posted',
  SURPLUS_SPEND: 'Surplus spend', CLOSE: 'Vault close', HEARTBEAT: 'Routine refreshes', REPAY: 'Repay', ADJUST: 'Collateral top-up',
  NOT_FINAL: 'Future clock refused', SET_CEILING: 'PSM parameters', SET_RATE: 'Stability fee change', LIQ_REFUSED: 'Liquidation refused (above 150%)', SWAP_IN: 'PSM swap in', SWAP_OUT: 'PSM redeem',
};

// Retired covenant families, shown together under "Previous deployments".
export const FAMILY_LABEL = { 'stage1-v1': 'Stage 1, first deployment', 'phase5': 'Phase 5' };

export function Tx({ id }) {
  return (
    <a href={txUrl(id)} target="_blank" rel="noreferrer" className={`font-mono text-[12.5px] ${LINK}`} title="open the raw transaction on the TN10 API">
      {short(id)}
    </a>
  );
}

/** one row of the ledger: label and family, the transaction (or why there is none), the caption, the day */
export function TimelineEntry({ e }) {
  const refused = e.txid == null;
  const family = FAMILY_LABEL[e.family];
  return (
    <li className={`grid gap-1 border-t py-3 lg:grid-cols-[150px_minmax(0,1fr)_200px] lg:gap-6 ${refused ? 'border-dashed border-gray-500' : 'border-gray-800'}`}>
      <div className="font-mono text-[12px] text-gray-500">{day(e.time)}</div>
      <div className="min-w-0">
        <div className="text-[15px] text-gray-100">
          {STEP_LABEL[e.step] || e.step}
          {family && <span className="ml-2 font-mono text-[11.5px] text-gray-500">{family}</span>}
        </div>
        <p className="mt-0.5 text-[14px] leading-relaxed text-gray-400">{e.note}</p>
      </div>
      <div className="font-mono text-[12.5px] lg:text-right">
        {refused
          ? <span className="text-gray-400">{e.step === 'NOT_FINAL' ? 'refused by the node' : 'refused by the covenant'} · {'no transaction'}</span>
          : <Tx id={e.txid} />}
      </div>
    </li>
  );
}
