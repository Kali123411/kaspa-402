// Liveness indicators for /kusd: the overall badge and per-covenant dots.
import { useEffect, useState } from 'react';
import Freshness from '../Freshness';

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
  if (loading) return <Freshness state="checking" source="TN10" size="md" />;
  const state = overallState(status);
  const map = { current: 'verified', moved: 'moved', partial: 'partial', unreachable: 'unreachable' };
  return <Freshness state={map[state]} source="the TN10 API" ageSeconds={state === 'moved' ? undefined : secs} at={generatedAt} size="md" />;
}
