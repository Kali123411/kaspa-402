// kusd-client transactions handed to the bundled Kaspa SDK (what the browser submits through) keep
// their identity: for every flow the SDK computes the same transaction id as the Rust builder.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as sdk from '../public/kaspa-rpc/kaspa.js';
import * as kc from '../lib/kusd/wasm/kusd_client_wasm.mjs';
import { toSdkTransaction } from '../lib/kusd/app/sdk-tx.mjs';

sdk.initSync({ module: readFileSync(new URL('../public/kaspa-rpc/kaspa_bg.wasm', import.meta.url)) });
kc.initSync({ module: readFileSync(new URL('../lib/kusd/wasm/kusd_client_wasm_bg.wasm', import.meta.url)) });
const golden = JSON.parse(readFileSync(new URL('./fixtures/kusd-golden.json', import.meta.url), 'utf8'));

for (const [flow, c] of Object.entries(golden.cases)) {
  test(`${flow}: the SDK computes the builder's txid`, () => {
    const out = JSON.parse(kc.build(JSON.stringify(c.request)));
    assert.equal(out.error, undefined, out.error);
    const tx = toSdkTransaction(out.tx, sdk);
    assert.equal(tx.id, c.txid);
    assert.equal(tx.inputs.length, out.tx.inputs.length);
  });
}

test('a malformed script public key is refused', () => {
  const out = JSON.parse(kc.build(JSON.stringify(golden.cases.swap_in.request)));
  out.tx.outputs[0].scriptPublicKey = 'zz';
  assert.throws(() => toSdkTransaction(out.tx, sdk), /scriptPublicKey/);
});
