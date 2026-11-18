// The browser agent's payer: read a provider's 402, check the quote before anything is built (our family, our
// network, the listed key tweaked by the offer), present the payment with PAYMENT-SIGNATURE and wait out
// "not indexed yet" on the same txid — never re-sending money. Pure: fetch is injected.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quote, present, checkPolicy, QuoteError, PaymentSent } from '../lib/kusd/market/payer.mjs';
import { derivePayee } from '../lib/kusd/market/payee.mjs';
import { SpendPolicy, SpendRefused } from '../lib/kusd/market/spend.mjs';
import { HDR_REQUIRED, HDR_RESPONSE, HDR_SIGNATURE, KUSD_BINDING, NETWORK_TESTNET, decodeSignature } from '../lib/kusd/market/x402.mjs';

const AUTH = '06'.repeat(32);
const LISTED = '4f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa';
const PID = 'p_1';
const PAY_TO = derivePayee(LISTED, PID);
const ME = 'ea'.repeat(32);
const ENDPOINT = 'https://p.test/summarize';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64');

function required({ cents = 5, payTo = PAY_TO, asset = AUTH, network = NETWORK_TESTNET, pid = PID, kusd = true } = {}) {
  const accepts = [{ scheme: 'exact', network, amount: '3000000', asset: 'KAS', payTo: 'kaspatest:qq', extra: { payment_id: pid } }];
  if (kusd) accepts.push({ scheme: 'exact', network, amount: String(cents), asset, payTo, maxTimeoutSeconds: 120,
    extra: { assetSymbol: 'kUSD', decimals: 2, assetTransferMethod: 'submitted', payment_id: pid, binding: KUSD_BINDING } });
  return b64({ x402Version: 2, resource: { url: ENDPOINT }, accepts });
}

/** A provider: unpaid → 402 with PAYMENT-REQUIRED; paid → scripted answers, one per attempt. */
function provider(opts = {}, paidAnswers = [{ status: 200, body: { summary: '…' } }]) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const headers = new Headers(init.headers || {});
    const sig = headers.get(HDR_SIGNATURE);
    calls.push({ url, body: init.body, sig });
    if (opts.free) return new Response(JSON.stringify({ free: true }), { status: 200 });
    if (!sig) {
      const h = new Headers({ 'content-type': 'application/json' });
      if (!opts.noHeader) h.set(HDR_REQUIRED, required(opts));
      return new Response(JSON.stringify({ k402: { version: 1, offers: [] }, reason: 'payment required' }), { status: 402, headers: h });
    }
    const a = paidAnswers[Math.min(calls.filter((c) => c.sig).length - 1, paidAnswers.length - 1)];
    const h = new Headers({ 'content-type': 'application/json' });
    if (a.errorReason) h.set(HDR_RESPONSE, b64({ success: false, transaction: '', network: NETWORK_TESTNET, errorReason: a.errorReason }));
    return new Response(JSON.stringify(a.body ?? {}), { status: a.status, headers: h });
  };
  return { fetchImpl, calls };
}

const listing = { endpoint: ENDPOINT, payee_pubkey: LISTED, capability: 'summarize', price_cents: 5 };

test('quote reads the kUSD requirement and passes every check', async () => {
  const p = provider();
  const q = await quote({ listing, body: { text: 'hi' }, authority: AUTH, network: NETWORK_TESTNET, fetchImpl: p.fetchImpl });
  assert.equal(q.cents, 5);
  assert.equal(q.payTo, PAY_TO);
  assert.equal(q.paymentId, PID);
  assert.equal(q.network, NETWORK_TESTNET);
  assert.equal(q.accepted.extra.binding, KUSD_BINDING);
  assert.equal(p.calls.length, 1);
  assert.deepEqual(JSON.parse(p.calls[0].body), { text: 'hi' });
});

test('quote refuses before anything is built, each with its code', async () => {
  const refuse = async (opts, code) => {
    const p = provider(opts);
    await assert.rejects(quote({ listing, body: {}, authority: AUTH, network: NETWORK_TESTNET, fetchImpl: p.fetchImpl }),
      (e) => e instanceof QuoteError && e.code === code);
  };
  await refuse({ asset: 'ee'.repeat(32) }, 'asset_mismatch');
  await refuse({ network: 'kaspa:mainnet' }, 'network_mismatch');
  await refuse({ payTo: derivePayee(LISTED, 'p_other') }, 'payee_mismatch');
  await refuse({ kusd: false }, 'no_quote');
  await refuse({ noHeader: true }, 'no_quote');
  await refuse({ free: true }, 'free');
  await refuse({ cents: 0 }, 'bad_quote');
  await refuse({ cents: '1e2' }, 'bad_quote');   // digits only, like k402's int()
  await refuse({ cents: '0x10' }, 'bad_quote');
  const p = provider();
  await assert.rejects(quote({ listing: { ...listing, payee_pubkey: 'cd'.repeat(32) }, body: {}, authority: AUTH, network: NETWORK_TESTNET, fetchImpl: p.fetchImpl }),
    (e) => e instanceof QuoteError && e.code === 'bad_listed_key');
  // an unreachable provider is a QuoteError too, not a bare TypeError
  await assert.rejects(quote({ listing, body: {}, authority: AUTH, network: NETWORK_TESTNET, fetchImpl: async () => { throw new TypeError('Failed to fetch'); } }),
    (e) => e instanceof QuoteError && e.code === 'unreachable');
});

test('checkPolicy applies the operator ceiling (per_call) and the capability allowlist', () => {
  const q = { cents: 20, capability: 'summarize' };
  assert.doesNotThrow(() => checkPolicy(SpendPolicy.from({ maxPerCallCents: 25 }), q, { status: {} }));
  assert.throws(() => checkPolicy(SpendPolicy.from({ maxPerCallCents: 10 }), q, { status: {} }), (e) => e instanceof SpendRefused && e.code === 'per_call');
  assert.throws(() => checkPolicy(SpendPolicy.from({ allowCapabilities: ['extract'] }), q, { status: {} }), (e) => e instanceof SpendRefused && e.code === 'capability');
  assert.doesNotThrow(() => checkPolicy(SpendPolicy.from({ allowCapabilities: ['summarize'] }), q, { status: {} }));
});

test('present retries the same txid while the payment is not indexed, then returns the answer', async () => {
  const p = provider({}, [{ status: 402, errorReason: 'payment_not_found' }, { status: 200, body: { summary: 'ok' } }]);
  const q = await quote({ listing, body: { text: 'x' }, authority: AUTH, network: NETWORK_TESTNET, fetchImpl: p.fetchImpl });
  const slept = [];
  const r = await present({ quote: q, body: { text: 'x' }, txid: 'D3'.repeat(32), payer: ME, fetchImpl: p.fetchImpl, delays: [1, 2], sleep: async (ms) => { slept.push(ms); } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { summary: 'ok' });
  assert.equal(r.attempts, 2);
  assert.deepEqual(slept, [1]);
  const paid = p.calls.filter((c) => c.sig);
  assert.equal(paid.length, 2);
  for (const c of paid) assert.equal(decodeSignature(c.sig).payload.transaction, 'd3'.repeat(32), 'the same payment, lower-case, every time');
  assert.equal(decodeSignature(paid[0].sig).payload.payer, ME);
});

test('present gives up as PaymentSent after the retries, or at once on a hard error — the money moved', async () => {
  const p = provider({}, [{ status: 402, errorReason: 'payment_not_found' }]);
  const q = await quote({ listing, body: {}, authority: AUTH, network: NETWORK_TESTNET, fetchImpl: p.fetchImpl });
  await assert.rejects(present({ quote: q, body: {}, txid: 'd3'.repeat(32), payer: ME, fetchImpl: p.fetchImpl, delays: [1, 1], sleep: async () => {} }),
    (e) => e instanceof PaymentSent && e.status === 402 && e.txid === 'd3'.repeat(32) && e.attempts === 3);
  const p2 = provider({}, [{ status: 500, body: { error: 'model crashed' } }]);
  await assert.rejects(present({ quote: q, body: {}, txid: 'd3'.repeat(32), payer: ME, fetchImpl: p2.fetchImpl, delays: [1], sleep: async () => {} }),
    (e) => e instanceof PaymentSent && e.status === 500 && e.attempts === 1);
  // the provider takes the box and goes quiet: PaymentSent with status 0 (no HTTP answer)
  let n = 0;
  const quiet = async (url, init) => { n += 1; if (n === 1) return p.fetchImpl(url, init); throw new TypeError('Failed to fetch'); };
  const q3 = await quote({ listing, body: {}, authority: AUTH, network: NETWORK_TESTNET, fetchImpl: quiet });
  await assert.rejects(present({ quote: q3, body: {}, txid: 'd3'.repeat(32), payer: ME, fetchImpl: quiet, delays: [], sleep: async () => {} }),
    (e) => e instanceof PaymentSent && e.status === 0);
});
