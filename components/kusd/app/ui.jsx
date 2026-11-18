// Shared pieces of the kUSD app's tabs.
export const input = 'w-full min-w-0 rounded-lg border border-gray-700 bg-black/40 px-3 py-2 font-mono text-sm text-gray-100 placeholder:text-gray-600 focus:border-neon-purple focus:outline-none';
const button = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40';
export const primary = `${button} bg-neon-purple text-black hover:bg-neon-purple/90`;
export const secondary = `${button} border border-gray-700 text-gray-200 hover:border-neon-purple`;

export const kasText = (s) => `${(s / 1e8).toLocaleString('en-US', { maximumFractionDigits: 4 })} KAS`;
export const usdText = (c) => `${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kUSD`;
export const usdPerKas = (p) => `$${(p / 1e4).toFixed(4)}`;
export const txUrl = (id) => `https://api-tn10.kaspa.org/transactions/${id}`;

export function Panel({ title, children }) {
  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 sm:p-5">
      {title && <h3 className="font-semibold text-neon-purple">{title}</h3>}
      <div className={title ? 'mt-3 space-y-3' : 'space-y-3'}>{children}</div>
    </section>
  );
}

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
