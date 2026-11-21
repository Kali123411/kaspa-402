// The app's connection to Kaspa: the kusd-client WASM (pinned build) and the Kaspa SDK load in the
// browser; protocol state comes from the relay and is verified against a TN10 node before anything is
// built; transactions are signed here and broadcast straight to the node.
import { useCallback, useEffect, useRef, useState } from 'react';
import snapshot from '../../../public/kusd/snapshot.json';
import { loadState, canAct, utxosFromSdk, untilVerified } from '../../../lib/kusd/app/state.mjs';
import { coinsFromUtxos } from '../../../lib/kusd/app/coins.mjs';
import { toSdkTransaction } from '../../../lib/kusd/app/sdk-tx.mjs';
import { runFlow, relayEntries, publishWithRetry } from '../../../lib/kusd/app/flow.mjs';
import { describeTx } from '../../../lib/kusd/app/review.mjs';
import { loadLocal, saveLocal, mergeCreated, allEntries, pruneLocal } from '../../../lib/kusd/app/pending.mjs';

export const RELAY_URL = 'https://kusd.kaspa-402.org/state';
export const NODE_KEY = 'kusd.node';
const KINDS = ['oracle', 'psm', 'budget', 'authority', 'surplus'];
// Pinned in reviewed code: a relay can't move the app onto other covenants.
export const PINS = Object.fromEntries(KINDS.map((k) => [k, snapshot.covenants[k].covid]));
const GATE = [PINS.oracle, PINS.psm, PINS.surplus, PINS.budget, PINS.factory];

export const readStored = (key) => {
  try { return window.localStorage.getItem(key); } catch { return null; }
};
export const writeStored = (key, value) => {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch { /* storage blocked: the setting lasts this visit only */ }
};

const storage = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};
const postRelay = (batch) => fetchJson(RELAY_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entries: batch }) });

async function fetchJson(url, init) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal, cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

const call = (fn, req) => {
  const out = JSON.parse(fn(JSON.stringify(req)));
  if (out.error) throw new Error(out.error);
  return out;
};

export default function useKusd(wallet) {
  const [phase, setPhase] = useState('loading'); // loading | ready | error
  const [error, setError] = useState(null);
  const [view, setView] = useState({ chain: null, coins: [], daa: null, node: null });
  const mods = useRef({});
  const latest = useRef(view);
  // boxes this page just created: candidates while the relay catches up (still verified on the node)
  const local = useRef({ protocol: {}, holders: [], vaults: [] });
  const walletRef = useRef(wallet);
  walletRef.current = wallet;

  const connect = useCallback(async () => {
    setPhase('loading');
    setError(null);
    try {
      if (!mods.current.kc) {
        const kc = await import(/* webpackIgnore: true */ '/kusd-wasm/kusd_client_wasm.mjs');
        await kc.default({ module_or_path: '/kusd-wasm/kusd_client_wasm_bg.wasm' });
        const k = await import(/* webpackIgnore: true */ '/kaspa-rpc/kaspa.js');
        await k.default({ module_or_path: '/kaspa-rpc/kaspa_bg.wasm' });
        mods.current = { kc, k };
      }
      const { k } = mods.current;
      try { await mods.current.rpc?.disconnect(); } catch { /* already closed */ }
      const url = readStored(NODE_KEY);
      const rpc = url ? new k.RpcClient({ url, networkId: 'testnet-10' }) : new k.RpcClient({ resolver: new k.Resolver(), networkId: 'testnet-10' });
      await rpc.connect();
      mods.current.rpc = rpc;
      setPhase('ready');
    } catch (e) {
      setError(`could not reach a TN10 node: ${e?.message || e}`);
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    connect();
    return () => { try { mods.current.rpc?.disconnect(); } catch { /* closing */ } };
  }, [connect]);

  const boxAddress = useCallback((kind, state) => call(mods.current.kc.box_address, { kind, state, testnet: true }).address, []);

  /** Re-read the chain: verified protocol + the wallet's boxes and coins. */
  const refresh = useCallback(async () => {
    const { rpc } = mods.current;
    if (!rpc) throw new Error('not connected to a node');
    const w = walletRef.current;
    const getUtxos = async (address) => utxosFromSdk((await rpc.getUtxosByAddresses([address])).entries);
    const [info, chain, own] = await Promise.all([
      rpc.getBlockDagInfo(),
      loadState({ relayUrl: RELAY_URL, owner: w?.xonly, pins: PINS, boxAddress, getUtxos, fetchJson, local: local.current }),
      w ? rpc.getUtxosByAddresses([w.address]) : null,
    ]);
    // a refresh started for another wallet (since locked or switched) must not overwrite this one's view
    if ((walletRef.current?.xonly ?? null) !== (w?.xonly ?? null)) return latest.current;
    if (w) {
      const verified = new Set([...chain.holders, ...chain.vaults].map((l) => `${l.outpoint.transactionId}:${l.outpoint.index}`));
      const pruned = pruneLocal(local.current, verified, Date.now(), 10 * 60_000);
      if (allEntries(pruned).length !== allEntries(local.current).length) {
        local.current = pruned;
        saveLocal(storage, w.xonly, pruned);
      }
    }
    const next = {
      chain,
      coins: own ? coinsFromUtxos(own.entries, `000020${w.xonly}ac`) : [],
      daa: Number(info.virtualDaaScore),
      node: rpc.url || null,
    };
    latest.current = next;
    setView(next);
    return next;
  }, [boxAddress]);

  // this wallet's own recently created boxes (from earlier visits too), republished in case the relay missed them
  useEffect(() => {
    local.current = wallet ? loadLocal(storage, wallet.xonly) : { protocol: {}, holders: [], vaults: [] };
    const entries = allEntries(local.current);
    if (entries.length) publishWithRetry(entries, postRelay, { attempts: 5 }).catch(() => {});
  }, [wallet?.xonly]);

  // poll every 30 s, or every 5 s while the protocol does not verify (someone's transaction is propagating)
  useEffect(() => {
    if (phase !== 'ready') return undefined;
    let live = true;
    let timer;
    const tick = async () => {
      let v = null;
      try { v = await refresh(); } catch (e) { if (live) setError(String(e?.message || e)); }
      if (live) timer = setTimeout(tick, v && !v.chain.protocol && !v.chain.relayDown ? 5_000 : 30_000);
    };
    tick();
    return () => { live = false; clearTimeout(timer); };
  }, [phase, refresh, wallet?.address]);

  const freshContext = useCallback(async () => {
    const v = await untilVerified(refresh);
    return { protocol: v.chain.protocol, gate: GATE, coins: v.coins, clock: v.daa - 10, testnet: true };
  }, [refresh]);

  /** Build and sign the flow against freshly verified state, without broadcasting: what the review shows. */
  const preview = useCallback(async (flow, params, secret) => {
    const ctx = await freshContext();
    const request = { ...ctx, flow, secret, params: typeof params === 'function' ? params(latest.current) : params };
    const built = call(mods.current.kc.build, request);
    return { built, description: describeTx(built, { request, owner: walletRef.current?.xonly }) };
  }, [freshContext]);

  /** Broadcast the reviewed transaction (rebuilt once if a shared box moved meanwhile). */
  const run = useCallback(async (flow, params, secret, prebuilt) => {
    const { kc, k, rpc } = mods.current;
    const result = await runFlow({
      flow,
      secret,
      prebuilt,
      params: typeof params === 'function' ? () => params(latest.current) : params,
      getState: freshContext,
      build: (req) => call(kc.build, req),
      submit: (built) => rpc.submitTransaction({ transaction: toSdkTransaction(built.tx, k), allowOrphan: false }),
      // in the background: the relay's explorer API lags the node, so entries are retried for a while
      publish: (entries) => { publishWithRetry(entries, postRelay).catch(() => {}); },
    });
    local.current = mergeCreated(local.current, relayEntries(result));
    if (walletRef.current) saveLocal(storage, walletRef.current.xonly, local.current);
    // wait (up to ~20 s) until the node shows the new boxes, so the next action builds on them
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const v = await refresh().catch(() => null);
      const seen = (l) => l?.outpoint?.transactionId === result.txid;
      if (v && (Object.values(v.chain.protocol || {}).some(seen) || v.chain.holders.some(seen) || v.chain.vaults.some(seen) || v.coins.some(seen))) break;
    }
    return result;
  }, [refresh, freshContext]);

  /** Describe a wallet key: {address, xonly}. */
  const walletOf = useCallback((secret) => {
    const w = JSON.parse(mods.current.kc.wallet(secret, true));
    if (w.error) throw new Error(w.error);
    return w;
  }, []);

  /** A TN10 address's script hex (for recipients). */
  const scriptOf = useCallback((address) => mods.current.k.payToAddressScript(address).script, []);

  return { phase, error, ...view, connect, refresh, preview, run, walletOf, scriptOf, kc: () => mods.current.kc, canAct: view.chain ? canAct(view.chain) : { ok: false, reason: 'reading the chain…' } };
}
