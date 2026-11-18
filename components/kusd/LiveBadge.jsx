// Liveness indicators for /kusd: the overall badge and per-covenant dots.
import { useEffect, useState } from 'react';

export function overallState(status) {
  if (!status) return 'unreachable';
  const v = Object.values(status.covenants || {});
  if (v.length === 0 || v.every((s) => s === 'unknown')) return 'unreachable';
  if (v.some((s) => s === 'moved')) return 'moved';
  if (v.every((s) => s === 'current')) return 'current';
  return 'partial';
}

const DOT = {
  current: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]',
  moved: 'bg-amber-400',
  unknown: 'bg-gray-500',
  loading: 'bg-gray-600 animate-pulse',
};

export function Dot({ state }) {
  const label = { current: 'matches chain', moved: 'chain has moved', unknown: 'not checked', loading: 'checking' }[state];
  return <span title={label} aria-label={label} className={`inline-block h-2.5 w-2.5 rounded-full ${DOT[state] || DOT.unknown}`} />;
}

function useSecondsSince(iso) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return iso ? Math.max(0, Math.round((now - Date.parse(iso)) / 1000)) : null;
}

export default function LiveBadge({ status, loading, generatedAt }) {
  const secs = useSecondsSince(status?.checkedAt);
  if (loading) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-gray-700 bg-black/40 px-4 py-1.5 text-sm text-gray-400">
        <Dot state="loading" /> Checking TN10…
      </span>
    );
  }
  const state = overallState(status);
  const text = {
    current: `Matches chain · checked ${secs}s ago`,
    moved: `Chain has moved past this snapshot (exported ${generatedAt})`,
    partial: `Some covenants couldn't be checked · checked ${secs}s ago`,
    unreachable: 'TN10 unreachable, showing the archived snapshot',
  }[state];
  const tone = {
    current: 'border-emerald-400/50 text-emerald-300',
    moved: 'border-amber-400/50 text-amber-300',
    partial: 'border-amber-400/50 text-amber-300',
    unreachable: 'border-gray-600 text-gray-400',
  }[state];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border bg-black/40 px-4 py-1.5 text-sm ${tone}`}>
      <Dot state={state === 'current' ? 'current' : state === 'unreachable' ? 'unknown' : 'moved'} /> {text}
    </span>
  );
}
