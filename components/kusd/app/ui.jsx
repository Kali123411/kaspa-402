// Shared pieces of the kUSD app's tabs, derived from the site's Ledger grammar (components/Ledger.jsx).
import { FIELD, H3, LINK } from '../../Ledger';

export const input = `w-full min-w-0 ${FIELD}`;
const button = 'inline-flex items-center justify-center gap-2 px-4 py-2 font-mono text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-40';
export const primary = `${button} btn-kaspa`;
export const secondary = `${button} border border-gray-100 text-gray-100 hover:border-accent hover:text-accent`;
export const link = LINK;

export const kasText = (s) => `${(s / 1e8).toLocaleString('en-US', { maximumFractionDigits: 4 })} KAS`;
export const usdText = (c) => `${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kUSD`;
export const usdPerKas = (p) => `$${(p / 1e4).toFixed(4)}`;
export const txUrl = (id) => `https://api-tn10.kaspa.org/transactions/${id}`;

/** a ruled block with a heading: the ledger's unit of grouping (no card) */
export function Panel({ title, children }) {
  return (
    <section className="border-t border-gray-100 pt-4">
      {title && <h3 className={H3}>{title}</h3>}
      <div className={title ? 'mt-3 space-y-3' : 'space-y-3'}>{children}</div>
    </section>
  );
}

/** a small mono label above a value (replaces the uppercase micro-labels) */
export function Label({ children }) {
  return <div className="font-mono text-[12px] text-gray-500">{children}</div>;
}

/** an inset for a value or a form: the panel surface, square */
export const inset = 'border border-gray-800 bg-panel p-3';
/** a notice the reader must not miss (a refusal, an unknown outcome, a caveat): a dashed rule, plain words */
export const notice = 'border border-dashed border-gray-500 bg-panel p-3 text-[14px] text-gray-200';

export function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-gray-500">{k}</span>
      <span className="min-w-0 break-words text-right font-mono text-gray-200">{v}</span>
    </div>
  );
}

/** An amount field with a Review button; the caller parses the text and shows any error. */
export function AmountForm({ placeholder, onReview, disabled, label = 'Review', children }) {
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const text = new FormData(e.currentTarget).get('amount');
        onReview(text);
      }}
    >
      <div className="flex gap-2">
        <input name="amount" className={input} placeholder={placeholder} inputMode="decimal" autoComplete="off" />
        <button type="submit" className={primary} disabled={disabled}>{label}</button>
      </div>
      {children}
    </form>
  );
}
