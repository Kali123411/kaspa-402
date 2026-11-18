// Build → broadcast → publish one flow. Shared protocol boxes can be spent by someone else between our
// read and our broadcast; then the state is re-read and the flow rebuilt exactly once.
const CONTENTION = /already spent|orphan|missing|not found|double.?spend|utxo set/i;
const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** The relay entries for the boxes a broadcast transaction created. */
export const relayEntries = (built) => built.created.map((c) => ({
  kind: c.kind, covid: toHex(c.covid), outpoint: { transactionId: built.txid, index: c.index }, value: c.value, state: c.state,
}));

/** A shared box moved before the broadcast: `built` is the rebuild, to be reviewed again before signing. */
export class ContentionError extends Error {
  constructor(built, cause) {
    super('a shared protocol box moved before the broadcast; review the updated transaction');
    this.built = built;
    this.cause = cause;
  }
}

/**
 * `getState()` → a fresh request context `{protocol, gate, coins, clock, testnet}` (verified);
 * `params` is the flow's parameters, or a function of that context;
 * `build(request)` → kusd-client output (throws on refusal); `submit(built)` → txid (throws the node's
 * message); `publish(entries)` best effort. `prebuilt`: the transaction the user reviewed, broadcast as is.
 * If someone else spent a shared box first, the flow is rebuilt once against fresh state and returned
 * in a ContentionError — never broadcast unseen.
 */
export async function runFlow({ flow, params, secret, getState, build, submit, publish, prebuilt }) {
  const fresh = async () => {
    const ctx = await getState();
    return build({ ...ctx, flow, secret, params: typeof params === 'function' ? params(ctx) : params });
  };
  const built = prebuilt || await fresh();
  try {
    await submit(built);
  } catch (e) {
    if (!CONTENTION.test(String(e?.message ?? e))) throw e;
    throw new ContentionError(await fresh(), e);
  }
  try {
    await publish(relayEntries(built));
  } catch {
    // the relay is a cache; the next reader re-verifies and anyone may republish
  }
  return { txid: built.txid, created: built.created };
}

const RETRYABLE = (reason) => /^could not verify/.test(reason || '') || reason === 'already spent';

/**
 * POST `entries` to the relay (`post(batch)` → `{results}`), re-sending the ones it could not verify
 * yet (its explorer API lags the node) every few seconds, as the driver does.
 */
export async function publishWithRetry(entries, post, { attempts = 40, delayMs = 3000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let pending = entries;
  let published = 0;
  let refused = 0;
  for (let i = 0; i < attempts && pending.length; i++) {
    if (i > 0) await sleep(delayMs);
    let results;
    try {
      results = (await post(pending)).results || [];
    } catch {
      continue;
    }
    const retry = [];
    pending.forEach((e, j) => {
      const r = results[j] || {};
      if (r.ok) published++;
      else if (RETRYABLE(r.reason)) retry.push(e);
      else refused++;
    });
    pending = retry;
  }
  return { published, refused, unverified: pending.length };
}
