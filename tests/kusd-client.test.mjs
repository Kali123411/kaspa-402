// The kusd-client WASM in Kaspa Lab: pinned to the kusd-framework build it came from, and computing
// the same box addresses as the Rust library (golden fixture from kusd-framework).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadClient } from '../lib/kusd/client.mjs';

const golden = JSON.parse(readFileSync(new URL('./fixtures/kusd-golden.json', import.meta.url), 'utf8'));
const source = JSON.parse(readFileSync(new URL('../lib/kusd/wasm/SOURCE.json', import.meta.url), 'utf8'));

test('the WASM is the pinned kusd-framework build', () => {
  const wasm = readFileSync(new URL('../lib/kusd/wasm/kusd_client_wasm_bg.wasm', import.meta.url));
  assert.equal(createHash('sha256').update(wasm).digest('hex'), source.sha256);
  assert.match(source.commit, /^[0-9a-f]{7,40}$/);
});

test('boxAddress matches the Rust library', () => {
  const { boxAddress } = loadClient();
  assert.equal(boxAddress('oracle', golden.box_address.request.state), golden.box_address.address);
});

test('boxAddress throws on state that does not fit the kind', () => {
  assert.throws(() => loadClient().boxAddress('oracle', {}), /state/);
});
