import { FRESHNESS_MEANING, FRESHNESS_TONE, freshnessText } from '../lib/kusd/freshness.mjs';
import { Dot } from './kusd/LiveBadge';

/**
 * The one freshness / trust badge: state (verified, unverified, checking, moved, unreachable, partial), the source it
 * looked at, the age or timestamp, and — on hover or focus — what "verified" means on this site.
 */
export default function Freshness({ state, source, ageSeconds, at, size = 'sm' }) {
  const text = freshnessText({ state, source, ageSeconds, at });
  const dot = { verified: 'current', checking: 'loading', unreachable: 'unknown', unverified: 'unknown' }[state] || 'moved';
  const pad = size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm';
  return (
    <span className="group relative inline-block">
      <span role="status" tabIndex={0} aria-describedby={`fresh-${state}`} className={`inline-flex cursor-help items-center gap-2 border bg-panel font-mono ${pad} ${FRESHNESS_TONE[state] || FRESHNESS_TONE.checking} focus:outline-none focus:ring-1 focus:ring-teal-400/60`}>
        <Dot state={dot} /> {text}
      </span>
      <span id={`fresh-${state}`} role="tooltip" className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden w-80 max-w-[85vw] border border-gray-700 bg-panel p-3 text-left font-sans text-[12.5px] leading-snug text-gray-200 shadow-xl group-hover:block group-focus-within:block">
        {FRESHNESS_MEANING[state] || FRESHNESS_MEANING.checking}
      </span>
    </span>
  );
}
