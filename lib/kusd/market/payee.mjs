// Per-offer payee keys (k402 DESIGN-kusd-market.md §5): a provider is paid at its LISTED x-only key tweaked by
// a tagged hash of the offer's payment_id — a BIP340 additive tweak, the same arithmetic as k402's
// kusd_keys.derive_payee and kusd_pay's Keypair::add_xonly_tweak. The page recomputes it from the registry's
// listing and refuses any quote that pays elsewhere, so a hijacked endpoint cannot redirect the money.
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, concatBytes, utf8ToBytes } from '@noble/hashes/utils.js';

export const OFFER_TAG = 'k402/kusd-offer';
const XONLY = /^[0-9a-f]{64}$/;

/** tagged_hash(OFFER_TAG, payment_id) as hex: sha256(sha256(tag) || sha256(tag) || payment_id). */
export function offerTweak(paymentId) {
  if (typeof paymentId !== 'string' || paymentId.length === 0) throw new Error('the offer names no payment_id');
  const tag = sha256(utf8ToBytes(OFFER_TAG));
  return bytesToHex(sha256(concatBytes(tag, tag, utf8ToBytes(paymentId))));
}

/** The x-only key that owns the box paying offer `paymentId` to the provider whose listed key is `listedXonly`. */
export function derivePayee(listedXonly, paymentId) {
  const x = String(listedXonly ?? '').toLowerCase();
  if (!XONLY.test(x)) throw new Error('not an x-only public key');
  let P;
  try {
    P = secp256k1.Point.fromHex(`02${x}`);   // lift_x: the even-y point, as BIP340 does
  } catch {
    throw new Error('not an x-only public key');
  }
  const t = BigInt(`0x${offerTweak(paymentId)}`);
  const Q = P.add(secp256k1.Point.BASE.multiply(t));
  return bytesToHex(Q.toBytes(true).subarray(1));
}
