import { byId } from '../lib/glossary.mjs';

/**
 * A term's first use on a page: dotted underline, the glossary's one-line definition as a tooltip on hover and on
 * keyboard focus, and a link to its /glossary entry. Unknown ids render the children plain (never a crash).
 */
export default function Term({ id, children }) {
  const g = byId[id];
  if (!g) return <>{children}</>;
  const tip = `term-tip-${id}`;
  return (
    <span className="term group relative inline-block">
      <a href={`/glossary#${id}`} aria-describedby={tip} className="cursor-help border-b border-dotted border-gray-500 text-inherit no-underline hover:border-teal-400 focus:border-teal-400 focus:outline-none">
        {children ?? g.term}
      </a>
      <span id={tip} role="tooltip" className="term-tip pointer-events-none absolute left-0 top-full z-50 mt-1 hidden w-72 max-w-[80vw] rounded-lg border border-gray-700 bg-gray-900 p-3 text-left font-sans text-[12.5px] font-normal normal-case leading-snug tracking-normal text-gray-200 shadow-xl group-hover:block group-focus-within:block">
        <span className="font-mono text-[11px] uppercase tracking-wider text-teal-400">{g.term}</span>
        <br />{g.short}
      </span>
    </span>
  );
}
