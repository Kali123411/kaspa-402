
/**
 * What the market can do right now (UI/UX brief, Phase 3 /market): whether payments are frozen (the operator's kill
 * switch, promoted here from the drawer), what unlocks when, and when the registry last refreshed.
 */
export default function MarketReadiness({ k, frozen, onFreeze, hasLedger, checkedAt, fromSnapshot }) {
  const ready = Boolean(k.canAct?.ok);
  const since = checkedAt ? Math.max(0, Math.round((Date.now() - checkedAt) / 1000)) : null;
  const state = frozen ? 'FROZEN' : ready ? 'ON' : 'PENDING';
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2  border border-gray-800 bg-panel px-4 py-3 text-sm">
      <span role="status" className={`font-mono text-xs ${frozen ? 'border-gray-500 text-gray-200' : ready ? 'border-accent text-accent' : 'border-gray-600 text-gray-400'}`}>
        payments: {state}
      </span>
      <span className="text-xs text-gray-400">
        {frozen
          ? 'Every payment is refused until you unfreeze.'
          : ready
            ? 'Ready: pick a listing, quote, pay.'
            : k.phase === 'loading' || !k.chain
              ? 'Reading the chain… quotes and payments unlock once the protocol boxes are verified against the node (a few seconds).'
              : `Payments unlock once ${k.canAct?.reason || 'the wallet is open and the chain is verified'}.`}
      </span>
      <button type="button" onClick={onFreeze} disabled={!hasLedger} title={hasLedger ? '' : 'unlock a wallet first'}
        className="inline-flex items-center gap-1  border border-gray-700 px-3 py-1 font-mono text-xs text-gray-300 hover:border-gray-500 hover:text-gray-200 disabled:opacity-50">
        {frozen ? <> Unfreeze</> : <> Freeze (kill switch)</>}
      </button>
      <span className="ml-auto font-mono text-[11px] text-gray-500">
        {fromSnapshot ? 'registry: snapshot' : `registry refreshes every 10 s${since != null ? ` · ${since}s ago` : ''}`}
      </span>
    </div>
  );
}
