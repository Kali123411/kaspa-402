import { useState } from 'react';
import CodeBlock from './CodeBlock';

const LABEL = { curl: 'curl', python: 'Python', typescript: 'TypeScript' };

/** The code samples as tabs (curl first: it is the one everyone can run), keyboard-operable, one copy button each. */
export default function CodeTabs({ samples }) {
  const keys = Object.keys(samples);
  const [cur, setCur] = useState(keys[0]);
  return (
    <div>
      <div role="tablist" aria-label="code samples" className="flex gap-1 font-mono text-[12px]">
        {keys.map((k) => (
          <button key={k} role="tab" type="button" id={`tab-${k}`} aria-selected={cur === k} aria-controls={`panel-${k}`} onClick={() => setCur(k)}
            className={`rounded-t-lg border border-b-0 px-3 py-1.5 ${cur === k ? 'border-teal-400/40 bg-gray-950/60 text-teal-300' : 'border-gray-800 text-gray-500 hover:text-gray-300'}`}>
            {LABEL[k] || k}
          </button>
        ))}
      </div>
      {keys.map((k) => (
        <div key={k} role="tabpanel" id={`panel-${k}`} aria-labelledby={`tab-${k}`} hidden={cur !== k}>
          <CodeBlock code={samples[k]} className="rounded-tl-none" />
        </div>
      ))}
    </div>
  );
}
