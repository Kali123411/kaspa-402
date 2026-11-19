// KAS ⇄ kUSD through the PSM, at the oracle's prices. Buying uses the mint price, redeeming the
// liquidation price; both are signed oracle outputs.
import { useState } from 'react';
import { parseUsd } from '../../../lib/kusd/app/amounts.mjs';
import { swapInQuote, swapOutQuote, swapInLimits, swapInRate, fundingNeed, checkFunds } from '../../../lib/kusd/app/quotes.mjs';
import { AmountForm, Panel, Row, kasText, usdText, usdPerKas, secondary } from './ui';

export default function SwapTab({ k, wallet, review }) {
  const [err, setErr] = useState(null);
  const protocol = k.chain?.protocol;
  if (!wallet) return <Panel><p className="text-sm text-gray-400">Unlock or create a wallet in the Wallet tab first.</p></Panel>;
  if (!protocol) return <Panel><p className="text-sm text-gray-300">{k.canAct.reason}</p></Panel>;

  const oracle = protocol.oracle.state;
  const spread = protocol.psm.state.spread;
  const feeText = `${(spread / 100).toFixed(2)}%`;
  const clock = k.daa ? k.daa - 10 : protocol.budget.state.last;
  const limits = swapInLimits(protocol, clock);
  const buyRate = swapInRate(protocol, clock);
  const buyBudget = { limit: protocol.budget.state.limit, avail: limits.budgetCents };
  const holders = k.chain.holders;

  const buy = (text) => {
    setErr(null);
    try {
      const c = parseUsd(text);
      if (c > limits.maxCents) throw new Error(`the protocol accepts at most ${usdText(limits.maxCents)} right now`);
      checkFunds(k.coins, fundingNeed('swap_in', { cents: c }, protocol, clock));
      review.start('swap_in', { cents: c }, `Buy ${usdText(c)} through the PSM`);
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <Panel title="KAS → kUSD">
        <p className="text-xs text-gray-500">The PSM mints kUSD for KAS at the oracle&apos;s mint price ({usdPerKas(oracle.mint)} per KAS).</p>
        <AmountForm placeholder="kUSD to buy, e.g. 5.00" onReview={buy} disabled={!k.canAct.ok} />
        <Row k="1.00 kUSD costs" v={kasText(swapInQuote(100, oracle, spread, buyBudget).total)} />
        <Row k="PSM fee (to the surplus)" v={spread ? `${(buyRate / 100).toFixed(2)}%` : 'none'} />
        {spread > 0 && (
          <p className="text-xs text-gray-500">
            {feeText} while at least half the day&apos;s mint budget is left, then rising in a straight line to 2.50% as it
            empties, so no one buyer can drain it at the flat rate. A large buy pays the average rate over the part it uses.
          </p>
        )}
        <Row k="PSM room under its ceiling" v={usdText(limits.psmHeadroomCents)} />
        <Row k="Mint budget available" v={usdText(limits.budgetCents)} />
        {err && <p className="text-sm text-gray-200">{err}</p>}
      </Panel>

      <Panel title="kUSD → KAS">
        <p className="text-xs text-gray-500">
          The PSM pays KAS for kUSD at the oracle&apos;s liquidation price ({usdPerKas(oracle.liq)} per KAS). A whole box is redeemed; to
          redeem part of one, split it first in the Wallet tab (send to yourself).
        </p>
        {holders.length === 0 && <p className="text-sm text-gray-400">You hold no kUSD boxes yet.</p>}
        {holders.map((h) => (
          <div key={`${h.outpoint.transactionId}:${h.outpoint.index}`} className="flex flex-wrap items-center justify-between gap-2  bg-panel p-3">
            <div className="min-w-0">
              <div className="font-mono text-sm text-white">{usdText(h.state.amount)}</div>
              <div className="text-xs text-gray-500">pays {kasText(swapOutQuote(h.state.amount, oracle, spread).net)}{spread ? ` after the ${feeText} fee` : ''}</div>
            </div>
            <button type="button" className={secondary} disabled={!k.canAct.ok}
              onClick={() => review.start('swap_out', { holder: h }, `Redeem ${usdText(h.state.amount)} through the PSM`)}>
              Redeem
            </button>
          </div>
        ))}
      </Panel>
    </div>
  );
}
