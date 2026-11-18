import { useEffect, useState } from 'react';
import { RECORDING, REPLAY_SPEED, replayRows } from '../lib/roundtrip.mjs';

const ROWS = replayRows(RECORDING);

/**
 * A real round trip, replayed (identity design, E2): the four phases of one recorded kUSD purchase on testnet-10 appear at
 * their measured times, compressed REPLAY_SPEED×. The stamps are the recording's; the page says it is a replay.
 */
export default function RoundTrip() {
  const [shown, setShown] = useState(0);
  const [clock, setClock] = useState(0);
  const [run, setRun] = useState(0);
  useEffect(() => {
    setShown(0); setClock(0);
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const t = ((performance.now() - start) / 1000) * REPLAY_SPEED;
      const end = ROWS[ROWS.length - 1].t;
      setClock(Math.min(t, end));
      setShown(ROWS.filter((r) => r.t <= t).length);
      if (t < end) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run]);
  return (
    <figure className="m-0 font-mono text-[12.5px] leading-relaxed" aria-live="polite">
      <figcaption className="flex items-baseline justify-between border-b border-gray-100 pb-2 text-gray-500">
        <span>Fig. 1 — one paid call, as it happened on {RECORDING.network}</span>
        <span className="tabular-nums">t = {clock.toFixed(2)} s</span>
      </figcaption>
      <ol className="m-0 list-none p-0">
        {ROWS.map((r, i) => (
          <li key={r.at} className={`grid grid-cols-[64px_minmax(0,1fr)] gap-3 border-b py-3 transition-opacity duration-300 ${i === ROWS.length - 1 ? 'border-gray-100' : 'border-gray-800'} ${i < shown ? 'opacity-100' : 'opacity-0'}`}>
            <span className="tabular-nums text-gray-500">{r.at}</span>
            <span className="text-gray-200">
              {r.status ? <span className="font-bold text-accent">{r.status} </span> : null}{r.status ? r.text.replace(/^(402|200)\s*/, '').replace(/→ 200 OK$/, '→ OK') : r.text}
              <br /><span className="text-gray-500">{r.sub}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="flex items-baseline justify-between pt-2 text-gray-500">
        <span>replay at {REPLAY_SPEED}× · recorded {RECORDING.recorded_at.slice(0, 10)} · <a href={`https://explorer-tn10.kaspa.org/txs/${RECORDING.txid}`} target="_blank" rel="noopener noreferrer" className="underline decoration-gray-700 underline-offset-4 hover:text-accent">the transaction</a></span>
        <button type="button" onClick={() => setRun((n) => n + 1)} className="underline decoration-gray-700 underline-offset-4 hover:text-accent">replay</button>
      </div>
    </figure>
  );
}
