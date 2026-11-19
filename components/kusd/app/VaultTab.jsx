// Vaults: lock KAS, borrow kUSD against it (175% minimum at the mint price), repay, adjust, close.
// A vault is liquidatable when its collateral at the liquidation price falls under 150% of its debt.
import { useState } from 'react';
import { parseKas, parseUsd } from '../../../lib/kusd/app/amounts.mjs';
import { vaultView, fundingNeed, checkFunds, safeBorrowCents, borrowRisk, repayPlan, SAFE_RATIO, LIQ_RATIO, MIN_COLLATERAL, MIN_DEBT, REPAY_SLACK } from '../../../lib/kusd/app/quotes.mjs';
import { AmountForm, Panel, Row, kasText, usdText, usdPerKas, secondary } from './ui';


function VaultCard({ v, oracle, holders, canAct, review, coins, protocol }) {
  const [err, setErr] = useState(null);
  const [releaseAll, setReleaseAll] = useState(true);
  const s = v.state;
  const view = vaultView(s, oracle);
  const owed = view.owedCents;
  const go = (fn) => (text) => {
    setErr(null);
    try { fn(text); } catch (e) { setErr(e.message); }
  };
  // every box can clear the vault (the cents above what is owed stay with the protocol) or repay part of it,
  // as long as at least $1.00 of debt would remain
  const plans = holders.map((h) => ({ h, plan: repayPlan(s, oracle, h.state.amount) })).filter(({ plan }) => plan.full || (!plan.tooBig && plan.remaining >= MIN_DEBT));

  return (
    <Panel title={`Vault · ${kasText(s.collateral)}`}>
      <Row k="Debt with interest" v={usdText(owed)} />
      <Row k="Stability fee" v={`${((oracle.rate ?? 0) / 100).toFixed(2)}% a year`} />
      <Row k="Ratio at the mint price" v={view.ratioAtMint === null ? '—' : `${view.ratioAtMint}%`} />
      <Row k="Ratio at the liquidation price" v={view.ratioAtLiq === null ? '—' : `${view.ratioAtLiq}%`} />
      <Row k={`Liquidatable below (${LIQ_RATIO}% at the liquidation price)`} v={view.liquidatesBelow === null ? 'no debt' : `${usdPerKas(view.liquidatesBelow)} per KAS`} />
      {owed > 0 && <Row k="KAS can fall before liquidation" v={`${borrowRisk(s, oracle, 0).dropPct}%`} />}
      <Row k={`Safe to borrow (${SAFE_RATIO}% target)`} v={usdText(safeBorrowCents(s, oracle))} />
      <Row k="Most it can borrow (175%)" v={usdText(view.maxMintCents)} />

      <div className="space-y-2 border-t border-gray-800 pt-3">
        <div className="text-xs text-gray-500">Borrow kUSD</div>
        <AmountForm placeholder="kUSD to borrow" disabled={!canAct} onReview={go((t) => {
          const c = parseUsd(t);
          if (c > view.maxMintCents) throw new Error(`this vault can borrow at most ${usdText(view.maxMintCents)} more`);
          checkFunds(coins, fundingNeed('mint', { cents: c }, protocol));
          const risk = borrowRisk(s, oracle, c);
          if (risk.needsConfirm && !window.confirm(`After this the vault sits at ${risk.ratioAfter}%. It becomes liquidatable if KAS falls ${risk.dropPct}% (below ${usdPerKas(risk.liquidatesBelow)}), and a liquidation costs about 13% of the debt. Borrow anyway?`)) return;
          review.start('mint', { vault: v, cents: c }, `Borrow ${usdText(c)} (vault at ${risk.ratioAfter}%, liquidatable after a ${risk.dropPct}% fall)`);
        })} />
      </div>

      <div className="space-y-2">
        <div className="text-xs text-gray-500">Collateral</div>
        <AmountForm placeholder="KAS to add" label="Add" disabled={!canAct} onReview={go((t) => {
          const d = parseKas(t);
          checkFunds(coins, fundingNeed('adjust', { delta: d }, protocol));
          review.start('adjust', { vault: v, delta: d }, `Add ${kasText(d)} collateral`);
        })} />
        <AmountForm placeholder="KAS to withdraw" label="Withdraw" disabled={!canAct} onReview={go((t) => {
          const d = parseKas(t);
          if (s.collateral - d < MIN_COLLATERAL) throw new Error(`a vault keeps at least ${kasText(MIN_COLLATERAL)}; close it to take everything`);
          review.start('adjust', { vault: v, delta: -d }, `Withdraw ${kasText(d)} collateral`);
        })} />
      </div>

      {owed > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-gray-500">Repay with a kUSD box</div>
          {plans.length === 0 && <p className="text-sm text-gray-400">No box of yours can repay this vault. Split or merge boxes in the Wallet tab: {usdText(owed)} (up to {usdText(owed + REPAY_SLACK)}) clears it.</p>}
          {plans.map(({ h, plan }) => (
            <div key={`${h.outpoint.transactionId}:${h.outpoint.index}`} className="flex flex-wrap items-center justify-between gap-2  bg-panel p-3">
              <span className="font-mono text-sm text-white">
                {usdText(h.state.amount)}{plan.full ? ' · repays all' : ` · leaves ${usdText(plan.remaining)}`}
                {plan.excess > 0 && <span className="text-xs text-gray-300"> ({usdText(plan.excess)} above the debt is kept by the protocol)</span>}
              </span>
              <button type="button" className={secondary} disabled={!canAct}
                onClick={() => review.start('repay', { vault: v, holder: h, withdraw_all: plan.full && releaseAll },
                  plan.full && releaseAll ? `Repay ${usdText(h.state.amount)} and release ${kasText(s.collateral)}` : `Repay ${usdText(h.state.amount)}`)}>
                Repay
              </button>
            </div>
          ))}
          {plans.some(({ plan }) => plan.full) && (
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={releaseAll} onChange={(e) => setReleaseAll(e.target.checked)} /> Release all collateral on a full repay
            </label>
          )}
          <p className="text-xs text-gray-500">Interest accrues at the stability fee every oracle refresh, so the debt can rise by a cent while you prepare; a box of at least what is owed always clears the vault. A partial repay must leave at least $1.00 of debt.</p>
        </div>
      )}

      {owed === 0 && (
        <button type="button" className={secondary} disabled={!canAct} onClick={() => review.start('close', { vault: v }, `Close the vault and take back ${kasText(s.collateral)}`)}>
          Close vault
        </button>
      )}
      {err && <p className="text-sm text-gray-200">{err}</p>}
    </Panel>
  );
}

export default function VaultTab({ k, wallet, review }) {
  const [err, setErr] = useState(null);
  const protocol = k.chain?.protocol;
  if (!wallet) return <Panel><p className="text-sm text-gray-400">Unlock or create a wallet in the Wallet tab first.</p></Panel>;
  if (!protocol) return <Panel><p className="text-sm text-gray-300">{k.canAct.reason}</p></Panel>;
  const oracle = protocol.oracle.state;

  const open = (text) => {
    setErr(null);
    try {
      const sompi = parseKas(text);
      if (sompi < MIN_COLLATERAL) throw new Error(`a vault needs at least ${kasText(MIN_COLLATERAL)}`);
      checkFunds(k.coins, fundingNeed('open_vault', { collateral: sompi }, protocol));
      review.start('open_vault', { collateral: sompi }, `Open a vault with ${kasText(sompi)}`);
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="space-y-4">
      {k.chain.vaults.map((v) => (
        <VaultCard key={`${v.outpoint.transactionId}:${v.outpoint.index}`} v={v} oracle={oracle} holders={k.chain.holders} canAct={k.canAct.ok} review={review} coins={k.coins} protocol={protocol} />
      ))}
      <Panel title="Open a vault">
        <p className="text-xs text-gray-500">
          Lock KAS, then borrow kUSD up to the collateral&apos;s value at the mint price ({usdPerKas(oracle.mint)}) divided by 1.75.
        </p>
        <AmountForm placeholder="KAS to lock, at least 2" label="Review" disabled={!k.canAct.ok} onReview={open} />
        {err && <p className="text-sm text-gray-200">{err}</p>}
      </Panel>
    </div>
  );
}
