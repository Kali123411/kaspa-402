// Protocol and user state for the app. The relay is an untrusted cache: every box it returns is
// re-checked against a Kaspa node (address implied by its state, unspent, covenant id, value) and the
// protocol boxes must sit under the covenants pinned by the committed snapshot. Nothing else is built on.
import { INDEX_SCALE, MIN_COLLATERAL } from './quotes.mjs';
const KINDS = ['oracle', 'psm', 'budget', 'authority', 'surplus'];
const AUTHORITY_SCHEME = 0x10;
const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (h) => h.match(/../g).map((b) => parseInt(b, 16));

/** Kaspa SDK UTXO entries → `{outpoint, amount, covenantId}` (the SDK keeps the covenant id on `.entry`). */
export function utxosFromSdk(entries) {
  return entries.map((u) => {
    const covid = u.entry?.covenantId ?? u.covenantId; // an SDK Hash object; its string form is the hex
    return {
      outpoint: { transactionId: u.outpoint.transactionId, index: u.outpoint.index },
      amount: Number(u.amount),
      covenantId: covid == null ? null : String(covid),
    };
  });
}

/** Check one relay entry against the node; `live` is the kusd-client form. */
export async function verifyBox(entry, { boxAddress, getUtxos }) {
  let address;
  try {
    address = boxAddress(entry.kind, entry.state);
  } catch (e) {
    return { ok: false, reason: `${entry.kind}: state is malformed (${e.message})` };
  }
  const utxo = (await getUtxos(address)).find((u) => u.outpoint.transactionId === entry.outpoint?.transactionId && u.outpoint.index === entry.outpoint?.index);
  if (!utxo) return { ok: false, reason: `${entry.kind}: the node holds no unspent box with that state at that outpoint` };
  if (utxo.covenantId !== entry.covid) return { ok: false, reason: `${entry.kind}: the box on chain is under a different covenant` };
  if (utxo.amount !== entry.value) return { ok: false, reason: `${entry.kind}: the box on chain holds a different value` };
  return { ok: true, live: { covid: fromHex(entry.covid), outpoint: entry.outpoint, value: entry.value, state: entry.state } };
}

function pinProblem(kind, entry, pins) {
  if (!entry) return `${kind}: the relay has no ${kind} box`;
  if (entry.kind !== kind) return `${kind}: the relay returned a ${entry.kind} box in its place`;
  if (entry.covid !== pins[kind]) return `${kind}: not under the pinned ${kind} covenant`;
  if (kind === 'authority' && entry.state?.owner_scheme !== AUTHORITY_SCHEME) return 'authority: not the token authority';
  return null;
}

// A vault's genesis state is chosen by whoever creates it, so a box can name anyone as owner with any
// figures. Shown only if it is wired to this protocol and its value backs its claimed collateral.
const TOMBSTONE = 100_000_000;
const MAX_COLLATERAL = 4_000_000_000_000;
const MAX_DEBT_MC = 2 * 40_000_000_000 * 1000; // vault.ag MAX_DEBT_MC: owed may reach twice MAX_DEBT (index <= 2.0)
function legitimateVault(e, pins) {
  const s = e.state || {};
  const wired = toHex(s.kusd_id || []) === pins.authority && toHex(s.oracle_id || []) === pins.oracle
    && toHex(s.surplus_id || []) === pins.surplus && toHex(s.budget_id || []) === pins.budget;
  const emptied = s.collateral === 0 && s.debt_mc === 0; // fully repaid with the collateral released
  const bounded = Number.isSafeInteger(s.collateral) && Number.isSafeInteger(s.debt_mc) && s.debt_mc >= 0 && s.debt_mc <= MAX_DEBT_MC
    && Number.isSafeInteger(s.index_at) && s.index_at >= INDEX_SCALE
    && (emptied || (s.collateral >= (s.debt_mc > 0 ? MIN_COLLATERAL : 0) && s.collateral <= MAX_COLLATERAL));
  return wired && bounded && e.value >= TOMBSTONE + s.collateral;
}

/**
 * `pins`: kind → covid hex from the snapshot; `owner`: the wallet's x-only key hex (optional);
 * `local`: boxes this page itself just created ({protocol: {kind: entry}, holders, vaults}) — candidates
 * while the relay lags, verified exactly like relay entries.
 */
export async function loadState({ relayUrl, owner, pins, boxAddress, getUtxos, fetchJson, local }) {
  let relay;
  try {
    relay = await fetchJson(owner ? `${relayUrl}?owner=${owner}` : relayUrl);
  } catch (e) {
    return { protocol: null, holders: [], vaults: [], problems: [`the state relay is unreachable (${e.message})`], relayDown: true };
  }
  const cache = new Map();
  const cachedUtxos = (address) => {
    if (!cache.has(address)) cache.set(address, getUtxos(address));
    return cache.get(address);
  };
  const deps = { boxAddress, getUtxos: cachedUtxos };
  const problems = [];

  const protocol = {};
  for (const kind of KINDS) {
    let first;
    for (const entry of [relay?.protocol?.[kind], local?.protocol?.[kind]]) {
      if (entry === undefined && first) continue;
      const pinned = pinProblem(kind, entry, pins);
      const r = pinned ? { ok: false, reason: pinned } : await verifyBox(entry, deps);
      if (r.ok) { protocol[kind] = r.live; break; }
      first ??= r.reason;
    }
    if (!protocol[kind]) problems.push(first);
  }

  const mine = async (list, kind, ok, quiet = new Set()) => {
    const kept = [];
    const seen = new Set();
    for (const entry of Array.isArray(list) ? list : []) {
      const key = `${entry?.outpoint?.transactionId}:${entry?.outpoint?.index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (entry?.kind !== kind || !owner || toHex(entry.state?.owner || []) !== owner || !ok(entry)) continue;
      const r = await verifyBox(entry, deps);
      if (r.ok) kept.push(r.live);
      else if (!quiet.has(entry)) problems.push(r.reason); // this page's own spent boxes drop silently
    }
    return kept;
  };
  const both = (a, b) => [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])];
  const own = new Set([...(local?.holders || []), ...(local?.vaults || [])]);
  const holders = await mine(both(relay?.holders, local?.holders), 'holder', (e) => e.covid === pins.authority && e.state.owner_scheme !== AUTHORITY_SCHEME, own);
  const vaults = await mine(both(relay?.vaults, local?.vaults), 'vault', (e) => legitimateVault(e, pins), own);

  const complete = KINDS.every((k) => protocol[k]);
  return { protocol: complete ? protocol : null, holders, vaults, problems };
}

/** Whether the app may build: only on a fully verified protocol. */
export function canAct(state) {
  if (state.protocol) return { ok: true };
  const reason = state.problems.find((p) => KINDS.some((k) => p.startsWith(`${k}:`))) || state.problems[0] || 'protocol state is not verified yet';
  return { ok: false, reason: state.relayDown ? reason : `cannot verify the protocol — ${reason}` };
}

/**
 * Re-read (`read()` → `{chain, …}`) until the protocol verifies: right after someone else's transaction
 * the relay can lag the node by up to a minute (its TN10 API does). An unreachable relay fails at once.
 */
export async function untilVerified(read, { tries = 25, delayMs = 3000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let v;
  for (let i = 0; i < tries; i++) {
    if (i > 0) await sleep(delayMs);
    v = await read();
    if (v.chain.protocol || v.chain.relayDown) break;
  }
  const ok = canAct(v.chain);
  if (!ok.ok) throw new Error(ok.reason);
  return v;
}
