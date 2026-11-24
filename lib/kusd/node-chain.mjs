// The relay's view of our own TN10 node: its UTXO set, over the Kaspa SDK's wRPC client (the same SDK build the
// browser app loads from public/kaspa-rpc). The node has a UTXO index but no transaction index, which is all the relay
// needs: a box that is in the UTXO set at its state's address, with the pinned covenant id, is accepted and unspent.
import { readFileSync } from 'node:fs';

/** `chain.utxos(addresses)` over an SDK RpcClient (or anything with its `getUtxosByAddresses`). */
export function nodeChain({ rpc, timeoutMs = 8000 }) {
  return {
    async utxos(addresses) {
      const unique = [...new Set(addresses)];
      let timer;
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('node did not answer')), timeoutMs); });
      try {
        const r = await Promise.race([rpc.getUtxosByAddresses({ addresses: unique }), timeout]);
        return (r.entries || []).map((e) => {
          const covid = e.entry?.covenantId ?? e.covenantId;
          return {
            address: String(e.address),
            transactionId: e.outpoint.transactionId,
            index: Number(e.outpoint.index),
            amount: BigInt(e.amount),
            covenantId: covid == null ? null : String(covid),
          };
        });
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/** Connect to the node at `url` (Borsh wRPC, e.g. ws://100.70.36.25:17210) with the SDK found in `sdkDir`. */
export async function connectNodeChain(url, sdkDir) {
  const k = await import(new URL('kaspa.js', sdkDir).href);
  k.initSync({ module: readFileSync(new URL('kaspa_bg.wasm', sdkDir)) });
  const rpc = new k.RpcClient({ url, encoding: k.Encoding.Borsh, networkId: 'testnet-10' });
  await rpc.connect({ blockAsyncConnect: false, retryInterval: 2000 });
  return nodeChain({ rpc });
}
