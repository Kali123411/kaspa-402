// The wallet key at rest: sealed with the user's passphrase (PBKDF2-SHA256 600k → AES-GCM-256) using
// WebCrypto, so the browser stores only ciphertext and the key never leaves the page.
const ITERATIONS = 600_000;
const subtle = () => {
  if (!globalThis.crypto?.subtle) throw new Error('this browser has no WebCrypto; a wallet needs a secure (https) page');
  return globalThis.crypto.subtle;
};
const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hexOf = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** A fresh random wallet key (hex), checked to be a valid secp256k1 key by the kusd-client `wallet`. */
export function newSecret(wallet) {
  for (;;) {
    const s = hexOf(globalThis.crypto.getRandomValues(new Uint8Array(32)));
    if (!JSON.parse(wallet(s, true)).error) return s;
  }
}

async function aesKey(passphrase, salt, iterations, usage) {
  const base = await subtle().importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, [usage]);
}

export async function sealSecret(hex, passphrase) {
  if (typeof passphrase !== 'string' || passphrase.length < 8) throw new Error('the passphrase needs at least 8 characters');
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await aesKey(passphrase, salt, ITERATIONS, 'encrypt');
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(hex)));
  return { v: 1, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}

export async function openSecret(blob, passphrase) {
  let salt, iv, ct;
  try {
    if (blob?.v !== 1 || blob.kdf !== 'PBKDF2-SHA256' || blob.iterations !== ITERATIONS) throw new Error();
    [salt, iv, ct] = [unb64(blob.salt), unb64(blob.iv), unb64(blob.ct)];
    if (salt.length !== 16 || iv.length !== 12 || ct.length < 17) throw new Error();
  } catch {
    throw new Error('unreadable wallet file');
  }
  const key = await aesKey(String(passphrase), salt, ITERATIONS, 'decrypt');
  let plain;
  try {
    plain = new TextDecoder().decode(await subtle().decrypt({ name: 'AES-GCM', iv }, key, ct));
  } catch {
    throw new Error('wrong passphrase');
  }
  if (!/^[0-9a-f]{64}$/.test(plain)) throw new Error('unreadable wallet file');
  return plain;
}
