// Loads the kaspa-wasm RPC SDK + initialises the WASM binary, then exposes it on window.
// Loaded as a same-origin <script type="module"> so it satisfies script-src 'self'.
import * as kaspa from '/kaspa-rpc/kaspa.js';

try {
  await kaspa.default('/kaspa-rpc/kaspa_bg.wasm');
  window.__kaspaSDK = kaspa;
  window.dispatchEvent(new CustomEvent('kaspa-sdk-ready'));
} catch (e) {
  window.dispatchEvent(new CustomEvent('kaspa-sdk-error', { detail: String(e) }));
}
