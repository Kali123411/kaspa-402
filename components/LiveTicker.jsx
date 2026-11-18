import { useEffect, useState } from 'react';

/**
 * The live wire (identity design, E2): one acid band of real registry events — kUSD settlements and passed 402 probes —
 * moving across the top of the landing. The only motion on the page is data moving; it pauses on hover and stops under
 * prefers-reduced-motion (globals.css).
 */
export default function LiveTicker() {
  const [events, setEvents] = useState(null);
  useEffect(() => {
    fetch('/api/stats').then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))).then((s) => setEvents(Array.isArray(s.events) ? s.events : [])).catch(() => setEvents([]));
  }, []);
  const items = events && events.length ? events : [{ kind: 'none', text: events ? 'registry unreachable — the ticker shows what the registry has indexed' : 'reading the registry…' }];
  const row = items.map((e, i) => <span key={i} className="shrink-0 whitespace-nowrap">{e.text}</span>);
  return (
    <div aria-label="live events: kUSD settlements and passed 402 probes from the registry" className="group overflow-hidden bg-accent font-mono text-[12.5px] font-medium text-ground">
      <div className="ticker-track flex w-max gap-12 py-2 hover:[animation-play-state:paused] group-hover:[animation-play-state:paused]">
        <div className="flex shrink-0 gap-12 pl-12">{row}</div>
        <div className="flex shrink-0 gap-12 pl-12" aria-hidden="true">{row}</div>
      </div>
    </div>
  );
}
