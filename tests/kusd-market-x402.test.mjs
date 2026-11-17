// The x402 V2 wire in the browser: read a provider's PAYMENT-REQUIRED, pick its kUSD requirement, build the
// PAYMENT-SIGNATURE, read PAYMENT-RESPONSE. Fixtures below were produced by k402's x402 module (k402 0.10.1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeRequired, pickKusd, signatureHeader, decodeResponse, decodeSignature, RETRYABLE, KUSD_BINDING, NETWORK_TESTNET,
} from '../lib/kusd/market/x402.mjs';

const AUTH = '06'.repeat(32);
const PAY_TO = '0f5cce65305b8f8ef8a944c10405f60c5b5b4f36125a642ea9e62e6482a4957a';
// k402: payment_required(resource https://p.test/summarize, accepts=[KAS 3_000_000 sompi, kUSD 5¢ to PAY_TO, pid p_1])
const REQUIRED = 'eyJ4NDAyVmVyc2lvbiI6MiwicmVzb3VyY2UiOnsidXJsIjoiaHR0cHM6Ly9wLnRlc3Qvc3VtbWFyaXplIn0sImFjY2VwdHMiOlt7InNjaGVtZSI6ImV4YWN0IiwibmV0d29yayI6Imthc3BhOnRlc3RuZXQtMTAiLCJhbW91bnQiOiIzMDAwMDAwIiwiYXNzZXQiOiJLQVMiLCJwYXlUbyI6Imthc3BhdGVzdDpxcSIsIm1heFRpbWVvdXRTZWNvbmRzIjoxMjAsImV4dHJhIjp7InBheW1lbnRfaWQiOiJwXzEiLCJhc3NldFRyYW5zZmVyTWV0aG9kIjoic3VibWl0dGVkIn19LHsic2NoZW1lIjoiZXhhY3QiLCJuZXR3b3JrIjoia2FzcGE6dGVzdG5ldC0xMCIsImFtb3VudCI6IjUiLCJhc3NldCI6IjA2MDYwNjA2MDYwNjA2MDYwNjA2MDYwNjA2MDYwNjA2MDYwNjA2MDYwNjA2MDYwNjA2MDYwNjA2MDYwNjA2MDYiLCJwYXlUbyI6IjBmNWNjZTY1MzA1YjhmOGVmOGE5NDRjMTA0MDVmNjBjNWI1YjRmMzYxMjVhNjQyZWE5ZTYyZTY0ODJhNDk1N2EiLCJtYXhUaW1lb3V0U2Vjb25kcyI6MTIwLCJleHRyYSI6eyJhc3NldFN5bWJvbCI6ImtVU0QiLCJkZWNpbWFscyI6MiwiYXNzZXRUcmFuc2Zlck1ldGhvZCI6InN1Ym1pdHRlZCIsInBheW1lbnRfaWQiOiJwXzEiLCJiaW5kaW5nIjoia3VzZC1ob2xkZXItdjEifX1dfQ==';
// k402: payment_payload(accepted=<the kUSD requirement>, txid d3*32, payer ea*32)
const SIG = 'eyJ4NDAyVmVyc2lvbiI6MiwiYWNjZXB0ZWQiOnsic2NoZW1lIjoiZXhhY3QiLCJuZXR3b3JrIjoia2FzcGE6dGVzdG5ldC0xMCIsImFtb3VudCI6IjUiLCJhc3NldCI6IjA2MDYwNjA2MDYwNjA2MDYwNjA2MDYwNjA2MDYwNjA2MDYwNjA2MDYwNjA2MDYwNjA2MDYwNjA2MDYwNjA2MDYiLCJwYXlUbyI6IjBmNWNjZTY1MzA1YjhmOGVmOGE5NDRjMTA0MDVmNjBjNWI1YjRmMzYxMjVhNjQyZWE5ZTYyZTY0ODJhNDk1N2EiLCJtYXhUaW1lb3V0U2Vjb25kcyI6MTIwLCJleHRyYSI6eyJhc3NldFN5bWJvbCI6ImtVU0QiLCJkZWNpbWFscyI6MiwiYXNzZXRUcmFuc2Zlck1ldGhvZCI6InN1Ym1pdHRlZCIsInBheW1lbnRfaWQiOiJwXzEiLCJiaW5kaW5nIjoia3VzZC1ob2xkZXItdjEifX0sInBheWxvYWQiOnsidHJhbnNhY3Rpb24iOiJkM2QzZDNkM2QzZDNkM2QzZDNkM2QzZDNkM2QzZDNkM2QzZDNkM2QzZDNkM2QzZDNkM2QzZDNkM2QzZDNkM2QzIiwicGF5ZXIiOiJlYWVhZWFlYWVhZWFlYWVhZWFlYWVhZWFlYWVhZWFlYWVhZWFlYWVhZWFlYWVhZWFlYWVhZWFlYWVhZWFlYWVhIn19';
// k402: settle_response(success=False, network testnet, error_reason payment_not_found)
const RESP = 'eyJzdWNjZXNzIjpmYWxzZSwidHJhbnNhY3Rpb24iOiIiLCJuZXR3b3JrIjoia2FzcGE6dGVzdG5ldC0xMCIsImVycm9yUmVhc29uIjoicGF5bWVudF9ub3RfZm91bmQifQ==';

test('decodeRequired + pickKusd read the kUSD requirement off a k402 402 and ignore the KAS one', () => {
  const pr = decodeRequired(REQUIRED);
  assert.equal(pr.x402Version, 2);
  assert.equal(pr.resource.url, 'https://p.test/summarize');
  assert.equal(pr.accepts.length, 2);
  const q = pickKusd(pr);
  assert.equal(q.scheme, 'exact');
  assert.equal(q.network, NETWORK_TESTNET);
  assert.equal(q.amount, '5');
  assert.equal(q.asset, AUTH);
  assert.equal(q.payTo, PAY_TO);
  assert.equal(q.extra.payment_id, 'p_1');
  assert.equal(q.extra.binding, KUSD_BINDING);
  // only the binding tag identifies kUSD, never a guess from the asset field
  assert.equal(pickKusd({ accepts: [{ scheme: 'exact', asset: AUTH, extra: {} }] }), null);
  assert.equal(pickKusd({ accepts: [{ scheme: 'upto', extra: { binding: KUSD_BINDING } }] }), null, 'only the exact scheme');
  assert.equal(pickKusd({}), null);
});

test('signatureHeader produces exactly what k402 produces for the same payment', () => {
  const accepted = pickKusd(decodeRequired(REQUIRED));
  const h = signatureHeader({ accepted, txid: 'd3'.repeat(32), payer: 'ea'.repeat(32) });
  assert.deepEqual(decodeSignature(h), decodeSignature(SIG));
  assert.deepEqual(decodeSignature(h).payload, { transaction: 'd3'.repeat(32), payer: 'ea'.repeat(32) });
  assert.equal(decodeSignature(h).x402Version, 2);
  assert.equal(signatureHeader({ accepted, txid: 'D3'.repeat(32), payer: 'ea'.repeat(32) }), h, 'txids are canonical lowercase');
});

test('decodeResponse reads the settle response; garbage is null, not a throw', () => {
  assert.deepEqual(decodeResponse(RESP), { success: false, transaction: '', network: NETWORK_TESTNET, errorReason: 'payment_not_found' });
  assert.equal(decodeResponse('not base64 json'), null);
  assert.equal(decodeResponse(''), null);
  assert.equal(decodeResponse(undefined), null);
  assert.ok(RETRYABLE.has('payment_not_found') && RETRYABLE.has('verifier_unavailable') && !RETRYABLE.has('invalid_payment'));
  assert.throws(() => decodeRequired('%%%'), /PAYMENT-REQUIRED/);
});
