import { useState } from 'react';

/** A runnable block: monospace, horizontal scroll on narrow screens (never wraps), one copy button. */
export default function CodeBlock({ code, className = '' }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(code); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked: the text is selectable */ }
  }
  return (
    <div className={`relative border border-gray-800 bg-panel ${className}`}>
      <button type="button" onClick={copy} aria-label="Copy" title="Copy" className="absolute right-2 top-2 border border-gray-700 px-2 py-0.5 font-mono text-[11px] text-gray-400 hover:border-accent hover:text-accent">
        {done ? 'copied' : 'copy'}
      </button>
      <pre className="overflow-x-auto whitespace-pre p-4 pr-16 font-mono text-[12.5px] leading-relaxed text-gray-300">{code}</pre>
    </div>
  );
}
