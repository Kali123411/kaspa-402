// Per-offer payee keys, recomputed in the browser: a provider's quote must pay to its LISTED key tweaked by
// the offer's payment_id (BIP340 x-only additive tweak, tag "k402/kusd-offer"), or the page refuses to pay.
// Vector pinned from k402 (tests/test_kusd_keys.py) and kusd_pay (Keypair::add_xonly_tweak).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { derivePayee, offerTweak, OFFER_TAG } from '../lib/kusd/market/payee.mjs';

const P = '4f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa';

test('offerTweak is the tagged hash of the payment_id', () => {
  assert.equal(OFFER_TAG, 'k402/kusd-offer');
  assert.equal(offerTweak('p_1'), '5c3aa8a394ba561104c8104cd30135f9beec085ad60118f13885cf060d36ae72');
  assert.notEqual(offerTweak('p_1'), offerTweak('p_2'));
});

test('derivePayee matches k402 and kusd_pay for the pinned vector', () => {
  assert.equal(derivePayee(P, 'p_1'), '0f5cce65305b8f8ef8a944c10405f60c5b5b4f36125a642ea9e62e6482a4957a');
  assert.equal(derivePayee(P.toUpperCase(), 'p_1'), derivePayee(P, 'p_1'), 'a listed key in upper case is the same key');
  assert.notEqual(derivePayee(P, 'p_2'), derivePayee(P, 'p_1'));
  assert.match(derivePayee(P, 'p_2'), /^[0-9a-f]{64}$/);
});

test('an off-curve or malformed listed key is refused, never silently accepted', () => {
  assert.throws(() => derivePayee('cd'.repeat(32), 'p_1'), /not an x-only public key/);
  assert.throws(() => derivePayee('zz'.repeat(32), 'p_1'), /not an x-only public key/);
  assert.throws(() => derivePayee('ab', 'p_1'), /not an x-only public key/);
  assert.throws(() => derivePayee(P, ''), /payment_id/);
});
