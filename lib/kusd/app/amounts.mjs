// Amounts typed by a person → integer sompi / cents, refusing anything ambiguous before it reaches a build.
function parseDecimal(text, decimals, unit) {
  const s = String(text ?? '').trim();
  if (s.includes(',')) throw new Error('use a dot for decimals');
  const m = s.match(/^(\d+)(?:\.(\d*))?$/);
  if (!m) throw new Error(`enter an amount in ${unit}`);
  const frac = m[2] || '';
  if (frac.length > decimals) throw new Error(`${unit} amounts have at most ${decimals} decimals`);
  const v = BigInt(m[1]) * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, '0') || '0');
  if (v === 0n) throw new Error('the amount must be more than zero');
  if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('that amount is too large');
  return Number(v);
}

/** KAS text → sompi. */
export const parseKas = (text) => parseDecimal(text, 8, 'KAS');
/** USD (kUSD) text → cents. */
export const parseUsd = (text) => parseDecimal(text, 2, 'USD');
