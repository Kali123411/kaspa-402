// The ledger's grammar (identity design, docs/uiux/2026-11-18-identity-design.md), shared by every page: a 1600 px page
// grid, numbered sections with a 180 px margin column for the § mark and a side note, hairline rules, underlined text
// links, one filled button per view. Nothing here is a card.
export const PAGE = 'mx-auto w-full max-w-[1600px] px-6 lg:px-14';
export const MARK = 'font-mono text-[12px] leading-relaxed text-gray-500';
export const H1 = 'font-orbitron text-[clamp(36px,3.8vw,64px)] font-medium leading-[1.04] tracking-[-0.03em] text-gray-100 [text-wrap:balance]';
export const H2 = 'font-orbitron text-[clamp(26px,2.2vw,34px)] font-medium leading-tight tracking-[-0.02em] text-gray-100';
export const H3 = 'font-orbitron text-[clamp(20px,1.6vw,24px)] font-medium tracking-[-0.02em] text-gray-100';
export const LINK = 'underline decoration-gray-700 underline-offset-4 hover:text-accent hover:decoration-accent';
export const BUTTON = 'btn-kaspa px-5 py-3 font-mono text-[14px] font-medium';
export const FIELD = 'border border-gray-800 bg-panel px-3 py-2 font-mono text-[13px] text-gray-100 outline-none placeholder:text-gray-600 focus:border-accent';
export const notice = 'border border-dashed border-gray-500 bg-panel p-3 text-[14px] text-gray-200';
export const NUM = 'font-orbitron text-[clamp(28px,2.6vw,44px)] font-medium leading-none tracking-[-0.03em] text-gray-100 tabular-nums';

/** a numbered section: § mark + side note in the margin column, content beside it; one column on phones */
export function Section({ id, mark, note, children, className = '', top = true }) {
  return (
    <section id={id} className={`grid gap-6 ${top ? 'border-t border-gray-100 pt-6' : ''} scroll-mt-20 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-10 ${className}`}>
      <div className={MARK}>{mark != null && <div>§ {mark}</div>}{note ? <div className="mt-1 text-gray-600">{note}</div> : null}</div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** a ruled table of facts: rows = [label, value, note?] */
export function Facts({ rows, className = '' }) {
  return (
    <table className={`w-full border-collapse text-[14px] ${className}`}>
      <tbody className="tabular-nums">
        {rows.map(([k, v, n]) => (
          <tr key={k} className="border-b border-gray-800 align-baseline">
            <th scope="row" className="py-2.5 pr-4 text-left font-normal text-gray-500">{k}</th>
            <td className="py-2.5 pr-4 font-mono text-[13.5px] text-gray-100">{v}</td>
            <td className="py-2.5 text-[13px] text-gray-500">{n}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
