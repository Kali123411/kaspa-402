// x402 V2 in the browser (k402 PROTOCOL.md §4 / scheme_exact_kusd.md): the provider's 402 carries a
// PAYMENT-REQUIRED header (base64 JSON, `accepts[]`); the kUSD requirement is the `exact` one tagged
// `extra.binding = "kusd-holder-v1"` (never guessed from `asset`); the payer answers with PAYMENT-SIGNATURE
// (the accepted requirement + the creating txid) and reads PAYMENT-RESPONSE for the settle outcome.
export const HDR_REQUIRED = 'PAYMENT-REQUIRED';
export const HDR_SIGNATURE = 'PAYMENT-SIGNATURE';
export const HDR_RESPONSE = 'PAYMENT-RESPONSE';
export const KUSD_BINDING = 'kusd-holder-v1';
export const NETWORK_TESTNET = 'kaspa:testnet-10';
export const NETWORK_MAINNET = 'kaspa:mainnet';
export const X402_VERSION = 2;
/** PAYMENT-RESPONSE errorReasons after which the same payment is presented again (never a new one). */
export const RETRYABLE = new Set(['payment_not_found', 'verifier_unavailable']);

const b64e = (obj) => {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
const b64d = (h) => {
  const bin = atob(String(h));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
};

export function decodeRequired(header) {
  try {
    const pr = b64d(header);
    if (!pr || typeof pr !== 'object') throw new Error('not an object');
    return pr;
  } catch (e) {
    throw new Error(`malformed ${HDR_REQUIRED} header (${e.message})`);
  }
}

/** The kUSD requirement of a decoded PAYMENT-REQUIRED, or null when the provider does not take kUSD. */
export function pickKusd(required) {
  for (const req of required?.accepts ?? []) {
    if (req && req.scheme === 'exact' && req.extra?.binding === KUSD_BINDING) return req;
  }
  return null;
}

/** PAYMENT-SIGNATURE for a kUSD payment: the requirement we accepted and the txid of the box we built. */
export function signatureHeader({ accepted, txid, payer }) {
  const payload = { transaction: String(txid).toLowerCase() };
  if (payer) payload.payer = String(payer).toLowerCase();
  return b64e({ x402Version: X402_VERSION, accepted, payload });
}

export function decodeSignature(header) {
  return b64d(header);
}

/** The decoded PAYMENT-RESPONSE, or null when absent or unreadable (a missing header is not an error). */
export function decodeResponse(header) {
  if (!header) return null;
  try {
    const r = b64d(header);
    return r && typeof r === 'object' ? r : null;
  } catch {
    return null;
  }
}
