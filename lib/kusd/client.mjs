// The kusd-client WebAssembly (lib/kusd/wasm, pinned by SOURCE.json) for Node: the same module the
// browser runs. Used to recompute a covenant box's address from claimed state — the check that lets
// the relay and the page verify state against the chain.
import { readFileSync } from 'node:fs';
import * as wasm from './wasm/kusd_client_wasm.mjs';

let ready = false;

function call(fn, ...args) {
  const out = JSON.parse(fn(...args));
  if (out.error) throw new Error(out.error);
  return out;
}

export function loadClient() {
  if (!ready) {
    wasm.initSync({ module: readFileSync(new URL('./wasm/kusd_client_wasm_bg.wasm', import.meta.url)) });
    ready = true;
  }
  return {
    /** P2SH address a box of `kind` holding `state` must sit at. */
    boxAddress: (kind, state, testnet = true) => call(wasm.box_address, JSON.stringify({ kind, state, testnet })).address,
    version: () => wasm.version(),
  };
}
