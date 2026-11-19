// What the app is connected to and whether it may act: network, node, oracle, verification, the
// client build's hash and the standing caveats.
import { useEffect, useState } from 'react';
import Freshness from '../../Freshness';
import Term from '../../Term';
import snapshot from '../../../public/kusd/snapshot.json';
import source from '../../../lib/kusd/wasm/SOURCE.json';
import { oracleSources, oracleAgeSeconds, oracleView } from '../../../lib/kusd/app/status.mjs';
import { loadSnapshot } from '../../../lib/kusd/feed.mjs';
import { DISCLAIMERS } from '../../../lib/kusd/story.mjs';

const usdPerKas = (p) => `$${(p / 1e4).toFixed(4)}`;
const ago = (s) => (s < 90 ? `${s}s ago` : s < 5400 ? `${Math.round(s / 60)} min ago` : `${(s / 3600).toFixed(1)} h ago`);

export default function StatusStrip({ k }) {
  const [fullHash, setFullHash] = useState(false);
  const [feed, setFeed] = useState(snapshot);
  useEffect(() => {
    loadSnapshot(snapshot, (url) => fetch(url, { cache: 'no-store' }).then((r) => r.json())).then(setFeed).catch(() => {});
  }, []);
  const sources = oracleSources(feed.timeline);
  const shown = oracleView(k.chain?.protocol, feed);
  const verified = k.canAct.ok;
  return (
    <div className="border border-gray-800 bg-panel p-4 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-mono text-xs text-gray-300">TN10</span>
        <span className="min-w-0 break-all font-mono text-xs text-gray-400">
          node: {k.phase === 'ready' ? (k.node || 'public resolver') : k.phase === 'loading' ? 'connecting…' : 'unreachable'}
        </span>
        {shown && (
          <span className={`font-mono text-xs ${shown.verified ? 'text-gray-300' : 'text-gray-500'}`}>
            KAS {usdPerKas(shown.state.price)} · <Term id="mint-price">mint</Term> {usdPerKas(shown.state.mint)} · <Term id="liq-price">liq</Term> {usdPerKas(shown.state.liq)}
            {shown.verified && k.daa ? ` · ${ago(oracleAgeSeconds(k.daa, shown.state.last))}` : ''}
          </span>
        )}
        {shown && (
          shown.verified
            ? <Freshness state="verified" source="the node" />
            : <Freshness state="unverified" source="feed snapshot" at={shown.asOf} />
        )}
      </div>
      <div className="mt-2 flex items-start gap-2">
        <span className={`mt-0.5 shrink-0 font-mono text-[13px] ${verified ? 'text-accent' : 'text-gray-400'}`} aria-hidden>{k.phase === 'loading' || !k.chain ? '…' : verified ? '✓' : '!'}</span>
        <p className={`min-w-0 break-words text-xs ${verified ? 'text-accent' : 'text-gray-300'}`}>
          {verified
            ? 'Protocol state verified against the node by this browser.'
            : k.error && !k.chain ? k.error : `Actions are off: ${k.canAct.reason}`}
        </p>
      </div>
      {sources && <p className="mt-1 text-xs text-gray-500">Latest price prints from {sources.join(', ')}.</p>}
      <p className="mt-2 text-xs text-gray-500">
        Client build{' '}
        <button type="button" onClick={() => setFullHash((v) => !v)} className="break-all font-mono text-gray-400 underline decoration-dotted">
          {fullHash ? source.sha256 : `${source.sha256.slice(0, 12)}…`}
        </button>{' '}
        (kusd-client {source.commit.slice(0, 7)}; keys never leave this page — every transaction is signed here).
      </p>
      <p className="mt-2 text-xs text-gray-300">
        {DISCLAIMERS.research} {DISCLAIMERS.advice} Today all five operator keys are
        held by the deployer; independent operators are a pre-mainnet gate.
      </p>
    </div>
  );
}
