// The kUSD app's wallet logic: the passphrase-sealed key, amount parsing, quotes and coin selection.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as kc from '../lib/kusd/wasm/kusd_client_wasm.mjs';
import { newSecret, sealSecret, openSecret } from '../lib/kusd/app/keystore.mjs';
import { parseKas, parseUsd } from '../lib/kusd/app/amounts.mjs';
import { swapInQuote, swapOutQuote, vaultView } from '../lib/kusd/app/quotes.mjs';
import { coinsFromUtxos } from '../lib/kusd/app/coins.mjs';

kc.initSync({ module: readFileSync(new URL('../lib/kusd/wasm/kusd_client_wasm_bg.wasm', import.meta.url)) });
const golden = JSON.parse(readFileSync(new URL('./fixtures/kusd-golden.json', import.meta.url), 'utf8'));
const SECRET = '01'.repeat(32);

test('a new secret is a valid wallet key', () => {
  const s = newSecret(kc.wallet);
  assert.match(s, /^[0-9a-f]{64}$/);
  assert.equal(JSON.parse(kc.wallet(s, true)).error, undefined);
  assert.notEqual(newSecret(kc.wallet), s);
});

test('seal then open returns the secret', async () => {
  const blob = await sealSecret(SECRET, 'correct horse');
  assert.equal(blob.v, 1);
  assert.equal(blob.kdf, 'PBKDF2-SHA256');
  assert.equal(blob.iterations, 600000);
  assert.ok(!JSON.stringify(blob).includes(SECRET));
  assert.equal(await openSecret(blob, 'correct horse'), SECRET);
});

test('a wrong passphrase is refused', async () => {
  const blob = await sealSecret(SECRET, 'correct horse');
  await assert.rejects(openSecret(blob, 'wrong horse!'), /wrong passphrase/);
});

test('a tampered or malformed wallet file is refused', async () => {
  const blob = await sealSecret(SECRET, 'correct horse');
  const ct = Buffer.from(blob.ct, 'base64');
  ct[0] ^= 1;
  await assert.rejects(openSecret({ ...blob, ct: ct.toString('base64') }, 'correct horse'), /wrong passphrase/);
  await assert.rejects(openSecret({ v: 1, kdf: 'PBKDF2-SHA256' }, 'correct horse'), /unreadable wallet file/);
  await assert.rejects(openSecret('not json', 'correct horse'), /unreadable wallet file/);
  await assert.rejects(openSecret({ ...blob, iterations: 1 }, 'correct horse'), /unreadable wallet file/);
});

test('a short passphrase is refused', async () => {
  await assert.rejects(sealSecret(SECRET, 'short'), /at least 8/);
});

test('parse_amount_rejects_bad_input', () => {
  assert.throws(() => parseKas('1,5'), /use a dot for decimals/);
  assert.throws(() => parseKas('0'), /more than zero/);
  assert.throws(() => parseKas('-1'));
  assert.throws(() => parseKas('1.123456789'), /8 decimals/);
  assert.throws(() => parseUsd('0.001'), /2 decimals/);
  assert.throws(() => parseUsd(''));
  assert.throws(() => parseUsd('abc'));
  assert.throws(() => parseKas('1e3'));
  assert.throws(() => parseKas('999999999999999'), /too large/);
});

test('parse_amount_accepts_dot_decimals', () => {
  assert.equal(parseUsd('12.5'), 1250);
  assert.equal(parseUsd(' 4 '), 400);
  assert.equal(parseKas('2.5'), 250000000);
  assert.equal(parseKas('0.00000001'), 1);
});

test('swap quotes mirror the builder', () => {
  const c = golden.cases.swap_in;
  const oracle = c.request.protocol.oracle.state;
  const psmBefore = c.request.protocol.psm.value;
  const out = JSON.parse(kc.build(JSON.stringify(c.request)));
  const psmAfter = out.created.find((b) => b.kind === 'psm').value;
  assert.deepEqual(swapInQuote(400, oracle), { sompi: psmAfter - psmBefore, fee: 0, total: psmAfter - psmBefore, price: oracle.mint });
  assert.deepEqual(swapOutQuote(400, { ...oracle, liq: 262 }), { sompi: 15267170000, fee: 0, net: 15267170000, price: 262 });
});

test('vault view figures', () => {
  const oracle = { price: 262, mint: 262, liq: 262 };
  const v = vaultView({ collateral: 30_000_000_000, debt_mc: 200_000, index_at: 1_000_000_000 }, oracle);
  assert.equal(v.ratioAtMint, 393);
  assert.equal(v.ratioAtLiq, 393);
  // 300 KAS stays healthy down to 150% of $2 = $3.00 → 0.01 USD/KAS → 100 in 1e-4 USD
  assert.equal(v.liquidatesBelow, 100);
  assert.equal(v.maxMintCents, 449 - 200);
  const empty = vaultView({ collateral: 30_000_000_000, debt_mc: 0, index_at: 1_000_000_000 }, oracle);
  assert.equal(empty.ratioAtMint, null);
  assert.equal(empty.liquidatesBelow, null);
  assert.equal(empty.maxMintCents, 449);
});

test('coinsFromUtxos keeps only the wallet\'s plain coins', () => {
  const own = '000020' + '44'.repeat(32) + 'ac';
  const u = (script, extra = {}) => ({ outpoint: { transactionId: 'ab'.repeat(32), index: 4 }, amount: 2158650000n, scriptPublicKey: { version: 0, script }, blockDaaScore: 623843087n, isCoinbase: false, ...extra });
  const coins = coinsFromUtxos([u('20' + '44'.repeat(32) + 'ac'), u('20' + '55'.repeat(32) + 'ac'), u('20' + '44'.repeat(32) + 'ac', { covenantId: 'cd'.repeat(32) })], own);
  assert.deepEqual(coins, [{ outpoint: { transactionId: 'ab'.repeat(32), index: 4 }, entry: { amount: 2158650000, scriptPublicKey: own, blockDaaScore: 623843087, isCoinbase: false, covenantId: null } }]);
});
