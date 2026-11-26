// The relay's view of our own TN10 node: its UTXO set, over the Kaspa SDK's wRPC client (the same SDK build the
// browser app loads from public/kaspa-rpc). The node has a UTXO index but no transaction index, which is all the relay
// needs: a box that is in the UTXO set at its state's address, with the pinned covenant id, is accepted and unspent.
import { readFileSync } from 'node:fs';

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * `chain.utxos(addresses)` over an SDK RpcClient (or anything with its `getUtxosByAddresses`).
 *
 * With `connect` (an async factory returning a connected client) the chain also heals itself (2026-11-26: after a
 * reboot the relay's connection stopped answering and every verification failed for four hours, while a fresh
 * connection worked). A client that fails `dropAfter` calls in a row is disconnected and dropped, and the next call
 * connects a new one; `watch` probes the node on an interval, so a silent connection is caught with no traffic. The
 * SDK's connect to an unreachable node never settles, so a connect is timed out here: the factory hands the client it
 * is connecting to `abandon`, and a timed-out connect disconnects it. With a plain `rpc` nothing is ever dropped.
 */
export function nodeChain({ rpc, connect, timeoutMs = 8000, dropAfter = 2, log = () => {} }) {
  let current = rpc ?? null;
  let connecting = null;
  let failures = 0;
  let reconnects = 0;

  async function client() {
    if (current) return current;
    connecting ??= (async () => {
      let pending = null;
      try {
        current = await withTimeout(connect({ abandon: (c) => { pending = c; } }), timeoutMs, 'could not connect to the node');
        reconnects += 1;
        log(`kusd-relay: connected to the node (connection ${reconnects})`);
        return current;
      } catch (err) {
        if (pending) Promise.resolve().then(() => pending.disconnect?.()).catch(() => {});
        throw err;
      } finally {
        connecting = null;
      }
    })();
    return connecting;
  }

  function drop(reason) {
    if (!connect || !current) return;
    const old = current;
    current = null;
    log(`kusd-relay: dropping the node connection after ${failures} failed calls (${reason}); reconnecting`);
    Promise.resolve().then(() => old.disconnect?.()).catch(() => {});
  }

  async function call(f) {
    const c = await client();
    try {
      const r = await withTimeout(f(c), timeoutMs, 'node did not answer');
      failures = 0;
      return r;
    } catch (err) {
      failures += 1;
      if (failures >= dropAfter) drop(err.message);
      throw err;
    }
  }

  return {
    async utxos(addresses) {
      const unique = [...new Set(addresses)];
      const r = await call((c) => c.getUtxosByAddresses({ addresses: unique }));
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
    },
    /** One round trip to the node (getServerInfo); counts toward `dropAfter` like any call. */
    probe() {
      return call((c) => c.getServerInfo());
    },
    /** Probe every `everyMs`; returns a function that stops it. */
    watch(everyMs = 30_000) {
      const timer = setInterval(() => { this.probe().catch(() => {}); }, everyMs);
      timer.unref?.();
      return () => clearInterval(timer);
    },
    stats() {
      return { connected: current != null, failures, reconnects };
    },
  };
}

/** Connect to the node at `url` (Borsh wRPC, e.g. ws://100.70.36.25:17210) with the SDK found in `sdkDir`; the chain
 * reconnects on its own (`nodeChain`), probing every `probeEveryMs`. */
export async function connectNodeChain(url, sdkDir, { probeEveryMs = 30_000, log = console.log } = {}) {
  const k = await import(new URL('kaspa.js', sdkDir).href);
  k.initSync({ module: readFileSync(new URL('kaspa_bg.wasm', sdkDir)) });
  const connect = async ({ abandon }) => {
    const rpc = new k.RpcClient({ url, encoding: k.Encoding.Borsh, networkId: 'testnet-10' });
    abandon(rpc);
    await rpc.connect({ blockAsyncConnect: true, strategy: 'fallback' });
    return rpc;
  };
  const chain = nodeChain({ connect, log });
  chain.probe().catch((err) => log(`kusd-relay: node not reachable yet (${err.message}); will retry`));
  chain.watch(probeEveryMs);
  return chain;
}
