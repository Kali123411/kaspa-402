// lib/x402catalog.mjs — the marketplace's x402 v2 catalog layer, built on @kaspa-x402/core.
//
// A "listing" is a service's advertised x402 v2 terms. This turns a listing into a real x402 v2
// PaymentRequirements / PaymentRequired offer and validates it against HIS OWN validators, so only
// well-formed x402 v2 services get listed. Network-aware from day one: kaspa:testnet-10 (dev/interop)
// and kaspa:mainnet (final product) are just the `network` field — SUPPORTED_NETWORKS covers both.
//
// The marketplace does NOT mint per-request offers (a service's own @kaspa-x402/server does that at
// request time, with payToScriptPublicKey/challenge/etc.). It advertises a service's terms and, in
// /validate, decodes+validates the service's LIVE PAYMENT-REQUIRED to confirm it really speaks x402 v2.

import {
  validateKaspaPaymentRequirement, validatePaymentRequired,
  encodePaymentRequiredHeader, decodePaymentRequiredHeader,
  SUPPORTED_NETWORKS, X402_VERSION, ASSET_ID, isDecimalSompi,
} from '@kaspa-x402/core';

export const NETWORKS = SUPPORTED_NETWORKS;          // ["kaspa:mainnet","kaspa:testnet-10"]
export const SCHEMES = ['exact', 'batch-settlement'];
export const EXACT_BINDING = 'kaspa-exact-v2';
export const BATCH_BINDING = 'kaspa-escrow-v1';

function prune(o) { return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)); }

// listing -> x402 v2 PaymentRequirements
export function requirementFromListing(l) {
  const base = {
    scheme: l.scheme, network: l.network, amount: String(l.amountSompi), asset: ASSET_ID,
    payTo: l.payTo, maxTimeoutSeconds: l.maxTimeoutSeconds ?? 60,
  };
  if (l.scheme === 'exact') {
    base.extra = prune({
      binding: EXACT_BINDING, profile: l.profile ?? 'standard-native',
      finality: l.finality ?? 'accepted', transactionEncoding: 'kaspa-sdk-safe-json-v2.0.0',
      payToScriptPublicKey: l.payToScriptPublicKey,
    });
  } else if (l.scheme === 'batch-settlement') {
    base.extra = prune({
      binding: BATCH_BINDING, templateId: 'kaspa-x402-escrow-v1',
      serverPublicKey: l.serverPublicKey, minDepositSompi: String(l.minDepositSompi),
      refundTimeoutDaa: String(l.refundTimeoutDaa),
    });
  }
  return base;
}

// listing -> x402 v2 PaymentRequired offer
export function offerFromListing(l) {
  return {
    x402Version: X402_VERSION,
    resource: prune({ url: l.resource, description: l.description, serviceName: l.serviceName }),
    accepts: [requirementFromListing(l)],
  };
}

function resultOf(r, ok = { ok: true }) {
  return r?.ok ? ok : { ok: false, error: JSON.stringify(r?.error ?? r?.errors ?? r) };
}

// light validation for a LISTING (an advertisement). The full x402 v2 check (his validators over a
// real PaymentRequired) is done live by /validate against the running service — see validateLiveOffer.
export function validateListing(l) {
  const errs = [];
  if (!l || typeof l !== 'object') return { ok: false, error: 'listing must be an object' };
  if (!/^https?:\/\/\S+$/.test(l.resource || '')) errs.push('resource must be an http(s) URL');
  if (!NETWORKS.includes(l.network)) errs.push(`unsupported network: ${l.network}`);
  if (!SCHEMES.includes(l.scheme)) errs.push(`unsupported scheme: ${l.scheme}`);
  if (!isDecimalSompi(String(l.amountSompi))) errs.push('amountSompi must be a positive integer (sompi)');
  if (!(l.serviceName && String(l.serviceName).trim())) errs.push('serviceName required');
  if (l.payTo != null && typeof l.payTo !== 'string') errs.push('payTo must be a string');
  return errs.length ? { ok: false, error: errs.join('; ') } : { ok: true };
}

// the /validate preflight: decode + validate a service's LIVE PAYMENT-REQUIRED header
export function validateLiveOffer(paymentRequiredHeaderB64) {
  let decoded;
  try { decoded = decodePaymentRequiredHeader(paymentRequiredHeaderB64); }
  catch (e) { return { ok: false, error: `malformed PAYMENT-REQUIRED: ${e.message}` }; }
  const r = validatePaymentRequired(decoded);
  return r?.ok ? { ok: true, offer: r.value } : resultOf(r);
}

// what a service would send with its 402 (used by tests + the demo)
export function encodeOfferHeader(l) { return encodePaymentRequiredHeader(offerFromListing(l)); }
