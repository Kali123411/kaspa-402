// The landing's "Attested data" section (k402-attest launch pair, 2026-11-19): the two paid endpoints, their price, the
// methodology pages and the offline verifier, in the ledger's numbered-section style.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const idx = readFileSync(new URL('../pages/index.js', import.meta.url), 'utf8');

test('the landing has an Attested data section with both endpoints, the price, methodology links and the verifier', () => {
  const i = idx.indexOf('id="attested"');
  assert.ok(i > 0, 'section present');
  const block = idx.slice(i, i + 5000);
  for (const needle of ['attest.kaspa-402.org/receipt', 'attest.kaspa-402.org/fees', 'attest.kaspa-402.org/methodology/receipt', 'attest.kaspa-402.org/methodology/fees',
                        'attest.kaspa-402.org/audit', 'github.com/kaspa-402/k402-attest', 'verify.py', '1 kUSD cent']) {
    assert.ok(block.includes(needle), `missing ${needle}`);
  }
  assert.ok(idx.indexOf('id="covenants"') < i, 'placed after the covenants section');
  assert.ok(!block.includes('uppercase tracking') && !block.includes('rounded-2xl'), 'ledger style, no ornament');
});
