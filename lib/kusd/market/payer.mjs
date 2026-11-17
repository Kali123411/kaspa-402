// The browser agent's side of a kUSD payment (k402 DESIGN-kusd-market.md §5, in JavaScript):
//   quote()        fetch the provider's 402, read the kUSD requirement off PAYMENT-REQUIRED, and CHECK it before
//                  anything is built — our kUSD family, our network, a payee that is the listed key tweaked by
//                  the offer, a sane amount. A refusal here costs nothing.
//   checkPolicy()  the operator's per-call ceiling and capability allowlist (the ledger's other bounds are
//                  checked by SpendLedger.reserve).
//   present()      after the wallet built and broadcast the box: retry the SAME txid with PAYMENT-SIGNATURE
//                  while the provider says "not indexed yet"; anything else after money moved is a PaymentSent.
import { derivePayee } from './payee.mjs';
import { SpendRefused } from './spend.mjs';
import { HDR_REQUIRED, HDR_RESPONSE, HDR_SIGNATURE, RETRYABLE, decodeRequired, decodeResponse, pickKusd, signatureHeader } from './x402.mjs';

export const QUOTE_CODES = ['unreachable', 'free', 'no_quote', 'bad_quote', 'asset_mismatch', 'network_mismatch', 'bad_listed_key', 'payee_mismatch'];

export class QuoteError extends Error {
  constructor(code, reason) {
    super(`quote refused (${code}): ${reason}`);
    this.name = 'QuoteError';
    this.code = code;
    this.reason = reason;
  }
}

/** The box was built and broadcast, but the provider did not serve the call. The money moved. */
export class PaymentSent extends Error {
  constructor({ txid, cents, status, attempts, json, cause }) {
    const got = status ? `HTTP ${status}` : `no HTTP answer (${cause?.message ?? cause})`;
    super(`paid ${cents}¢ (tx ${txid.slice(0, 8)}…) but got ${got} after ${attempts} attempt(s)`);
    this.name = 'PaymentSent';
    Object.assign(this, { txid, cents, status, attempts, json: json ?? null });
  }
}

const JSON_HEADERS = { 'content-type': 'application/json' };

export async function quote({ listing, body, authority, network, fetchImpl = globalThis.fetch }) {
  const endpoint = listing.endpoint;
  let r;
  try {
    r = await fetchImpl(endpoint, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body ?? {}) });
  } catch (e) {
    throw new QuoteError('unreachable', `the provider did not answer (${e.message})`);
  }
  if (r.status < 400) throw new QuoteError('free', 'the endpoint answered without asking for payment');
  if (r.status !== 402) throw new QuoteError('no_quote', `the provider answered HTTP ${r.status}, not a 402`);
  const hdr = r.headers.get(HDR_REQUIRED);
  if (!hdr) throw new QuoteError('no_quote', 'the 402 carries no PAYMENT-REQUIRED header (not an x402 provider)');
  let req;
  try {
    req = pickKusd(decodeRequired(hdr));
  } catch (e) {
    throw new QuoteError('no_quote', e.message);
  }
  if (!req) throw new QuoteError('no_quote', 'the provider does not take kUSD on this endpoint');
  const cents = /^\d+$/.test(String(req.amount)) ? Number(req.amount) : NaN;   // digits only, as k402's int(): no "1e2", no "0x10"
  const paymentId = req.extra?.payment_id;
  if (!Number.isInteger(cents) || cents <= 0) throw new QuoteError('bad_quote', `the provider quoted an unusable amount (${req.amount})`);
  if (typeof paymentId !== 'string' || !paymentId) throw new QuoteError('bad_quote', 'the offer names no payment_id');
  if (String(req.asset ?? '').toLowerCase() !== String(authority).toLowerCase()) {
    throw new QuoteError('asset_mismatch', `the provider wants kUSD of family ${String(req.asset).slice(0, 8)}…, this wallet holds ${String(authority).slice(0, 8)}…`);
  }
  if (req.network !== network) throw new QuoteError('network_mismatch', `the offer is on ${req.network}, this wallet is on ${network}`);
  const listed = String(listing.payee_pubkey ?? '').toLowerCase();
  let expected;
  try {
    expected = derivePayee(listed, paymentId);
  } catch {
    throw new QuoteError('bad_listed_key', 'the listing\'s payee key is not a valid x-only public key, so the quote cannot be checked');
  }
  const payTo = String(req.payTo ?? '').toLowerCase();
  if (payTo !== expected) throw new QuoteError('payee_mismatch', 'the quote is not paid to the listed provider\'s key for this offer');
  return {
    cents, payTo, paymentId, network: req.network, accepted: req, endpoint, provider: listed,
    capability: listing.capability ?? '', expiresAt: Date.now() + (Number(req.maxTimeoutSeconds) || 120) * 1000,
  };
}

/** The operator's quote-level bounds: the per-call ceiling and the capability allowlist. */
export function checkPolicy(policy, q, status = {}) {
  if (policy.allowCapabilities && !policy.allowCapabilities.includes(q.capability)) {
    throw new SpendRefused('capability', `${q.capability || 'a provider naming no capability'} is not in the operator's allowed capabilities`, status);
  }
  if (policy.maxPerCallCents != null && q.cents > policy.maxPerCallCents) {
    throw new SpendRefused('per_call', `the provider quotes ${q.cents}¢; the operator allows at most ${policy.maxPerCallCents}¢ a call`, status);
  }
}

const notIndexed = (text) => {
  try {
    const reason = String(JSON.parse(text)?.reason ?? '').toLowerCase();
    return reason.includes('not indexed') || reason.includes('retry');
  } catch {
    return false;
  }
};

export async function present({ quote: q, body, txid, payer, fetchImpl = globalThis.fetch, delays = [2000, 4000, 8000, 15000], sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const id = String(txid).toLowerCase();
  const headers = { ...JSON_HEADERS, [HDR_SIGNATURE]: signatureHeader({ accepted: q.accepted, txid: id, payer }) };
  let attempts = 0;
  let r;
  let text;
  for (;;) {
    attempts += 1;
    try {
      r = await fetchImpl(q.endpoint, { method: 'POST', headers, body: JSON.stringify(body ?? {}) });
      text = await r.text();
    } catch (e) {
      throw new PaymentSent({ txid: id, cents: q.cents, status: 0, attempts, cause: e });
    }
    const reason = decodeResponse(r.headers.get(HDR_RESPONSE))?.errorReason;
    const retry = r.status === 402 && (RETRYABLE.has(reason) || notIndexed(text));
    const d = delays[attempts - 1];
    if (!retry || d === undefined) break;
    await sleep(d);
  }
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  if (r.status >= 400) throw new PaymentSent({ txid: id, cents: q.cents, status: r.status, attempts, json });
  return { status: r.status, json, attempts };
}
