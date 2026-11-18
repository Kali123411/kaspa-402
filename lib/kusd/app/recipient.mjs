// Who receives kUSD: an x-only key, or a TN10 Schnorr wallet address (kUSD boxes are owned by a key).

/** `scriptOf(address)` → the address's script hex (Kaspa SDK payToAddressScript), throwing if invalid. */
export function recipientKey(text, scriptOf) {
  const s = String(text ?? '').trim();
  if (/^[0-9a-fA-F]{64}$/.test(s)) return s.toLowerCase();
  if (/^kaspa:/i.test(s)) throw new Error('that is a mainnet address; kUSD runs on TN10 (kaspatest:)');
  let script;
  try {
    script = scriptOf(s);
  } catch {
    throw new Error('enter a kaspatest: wallet address or a 64-hex public key');
  }
  const m = /^20([0-9a-f]{64})ac$/.exec(script);
  if (!m) throw new Error('kUSD can only be sent to a standard (Schnorr) wallet address');
  return m[1];
}
