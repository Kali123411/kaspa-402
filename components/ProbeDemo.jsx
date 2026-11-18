import { useState } from 'react';
import { transcript } from '../lib/probe-demo.mjs';

/**
 * Watch an agent get paywalled (UI/UX brief, Phase 2 P0-3): one real, unpaid request to a listed service, shown as the
 * terminal transcript. The page pays nothing; the last line says what an agent does next.
 */
export default function ProbeDemo() {
  const [lines, setLines] = useState(null);
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState(null);
  async function run() {
    setBusy(true);
    setLines(['$ # sending one unpaid request to a listed service…']);
    try {
      const r = await fetch('/api/probe');
      const j = await r.json();
      if (j.error && !j.url) { setLines([`# ${j.error}`]); return; }
      setMeta(j);
      setLines(transcript(j));
    } catch {
      setLines(['# the probe route did not answer; try again in a moment']);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="border border-gray-100 bg-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[12px] text-gray-500">Fig. 2 — one unpaid request, live, to a listed service</div>
          <p className="mt-1 text-[13px] text-gray-400">One real unpaid request to a listed service{meta?.service ? ` (${meta.service}, ${meta.network})` : ''}. Nothing is paid by this page.</p>
        </div>
        <button type="button" onClick={run} disabled={busy} className="border border-gray-100 px-4 py-2 font-mono text-[12.5px] text-gray-100 hover:border-accent hover:text-accent disabled:opacity-50">
          {busy ? 'probing…' : lines ? 'run it again' : 'run an unpaid request'}
        </button>
      </div>
      <pre aria-live="polite" className="mt-3 min-h-[5.5rem] overflow-x-auto whitespace-pre font-mono text-[12.5px] leading-relaxed text-gray-200">
        {(lines || ['$ curl -si "<a listed service>"', '# → 402 Payment Required, a payment-required header, then an agent pays and retries. Press the button to see it live.']).join('\n')}
      </pre>
      <p className="mt-2 font-mono text-[11px] text-gray-600">To run the paid leg yourself: <a href="/get-started" className="text-teal-400 hover:underline">get set up on testnet-10</a>.</p>
    </div>
  );
}
