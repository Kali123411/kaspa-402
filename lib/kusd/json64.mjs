// Lossless JSON for covenant state. Covenant fields are i64: an integer beyond 2^53 parses as a BigInt and
// stringifies back as the same digits (a JavaScript number would round it, and the WebAssembly client would then
// refuse the state or compute another address). Integers within 2^53 stay plain numbers.
//
// Runtimes with JSON source access (Node 21+, current browsers) use it; others take a small scanner fallback.

const SENTINEL = '\u0000i64:';
const NATIVE = (() => {
  try {
    return typeof JSON.rawJSON === 'function' && JSON.parse('1', (k, v, c) => c?.source) === '1';
  } catch {
    return false;
  }
})();

const unsafe = (digits) => !Number.isSafeInteger(Number(digits));

/** Wrap every integer literal outside a string that doesn't fit 2^53 as a sentinel string. */
function quoteUnsafe(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (c === '-' || (c >= '0' && c <= '9')) {
      const m = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i, i + 64));
      const tok = m ? m[0] : c;
      out += m && !m[1] && !m[2] && unsafe(tok) ? `"\\u0000i64:${tok}"` : tok;
      i += tok.length;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

/** JSON.parse that keeps integers beyond 2^53 exact (as BigInt). `native: false` forces the fallback. */
export function parseJson(text, { native = NATIVE } = {}) {
  if (native) {
    return JSON.parse(text, (k, v, ctx) => (typeof v === 'number' && /^-?\d+$/.test(ctx?.source ?? '') && unsafe(ctx.source) ? BigInt(ctx.source) : v));
  }
  return JSON.parse(quoteUnsafe(text), (k, v) => (typeof v === 'string' && v.startsWith(SENTINEL) ? BigInt(v.slice(SENTINEL.length)) : v));
}

/** JSON.stringify that writes BigInts as their exact digits. `native: false` forces the fallback. */
export function stringifyJson(value, { native = NATIVE } = {}) {
  if (native) return JSON.stringify(value, (k, v) => (typeof v === 'bigint' ? JSON.rawJSON(v.toString()) : v));
  const s = JSON.stringify(value, (k, v) => (typeof v === 'bigint' ? `${SENTINEL}${v}` : v));
  return s.replace(/"\\u0000i64:(-?\d+)"/g, '$1');
}
