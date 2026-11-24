// kUSD state relay: a cache of where the protocol's covenant boxes (and each user's own boxes) are now.
// It is never trusted. An entry is stored only after the public TN10 API confirms:
//   - its address is the P2SH of its claimed state (recomputed with the kusd-client WASM),
//   - the creating transaction's output carries the pinned covenant ID (consensus lets a box carry a
//     covenant ID only as a valid continuation, so this proves lineage) and the claimed value,
//   - the outpoint is unspent.
// Browsers re-verify what they read, so a stale or tampered relay can delay the app, not mislead it.
// The API lags the node (usually by a minute, at times by several), so an entry it cannot check yet is queued and
// re-checked here for up to RETRY_WINDOW_MS: one delivery from the box's creator is enough.

import { parseJson, stringifyJson } from './json64.mjs';

export const PROTOCOL_KINDS = ['oracle', 'psm', 'budget', 'authority', 'surplus', 'miner', 'factory'];
export const OWNER_KINDS = ['holder', 'vault'];
// Price receipts (oracle.ag `Receipt`): many boxes in the oracle's covenant, all carrying the oracle's price fields;
// consumers read one. Stored as a set keyed by outpoint, pruned when a verified transaction spends one (every
// price change spends them all).
export const RECEIPT_KIND = 'receipt';
export const MAX_RECEIPTS = 32;
export const MAX_ENTRIES = 32;
export const MAX_PER_OWNER = 64;
export const MAX_OWNER_ENTRIES = 5000;
const SPENT_MEMORY = 5000;
// the public TN10 API's transaction index has lagged the node by 5-8 minutes for an hour at a time (2026-11-24)
export const RETRY_WINDOW_MS = 20 * 60_000;
export const MAX_QUEUED = 64;
export const MAX_QUEUED_PER_CLIENT = 8;
const AUTHORITY_SCHEME = 16; // owner_scheme 0x10: only the token authority's own lineage carries it

// The fields each kind's kusd-client state has; anything else is refused, so stored state is exactly
// what the covenant commits to (extra JSON would pass the address check and be served verbatim).
const FIELDS = {
  oracle: ['price', 'mint', 'liq', 'epoch', 'last', 'status', 'keys', 'fee', 'gov', 'miner_id', 'bounded',
    'receipts', 'earned', 'last_paid', 'paid_total', 'pay_per_print', 'relayer_bonus', 'relayer_per_print'],
  receipt: ['price', 'mint', 'liq', 'status', 'last', 'fee'],
  miner: ['median', 'votes', 'blocks', 'anchor_daa', 'anchor_bs', 'epoch', 'image_id', 'tally_root', 'gov'],
  psm: ['ceiling', 'minted', 'spread', 'gov', 'kusd_id', 'oracle_id', 'surplus_id', 'budget_id', 'share_bps', 'floor', 'fees'],
  budget: ['limit', 'available', 'last', 'kusd_id', 'gov', 'vault_debt', 'vault_ceiling'],
  authority: ['amount', 'owner', 'owner_scheme', 'borrow_scheme', 'borrow_guard', 'ext'],
  holder: ['amount', 'owner', 'owner_scheme', 'borrow_scheme', 'borrow_guard', 'ext'],
  surplus: ['gov', 'kusd_id', 'oracle_id'],
  vault: ['owner', 'collateral', 'debt', 'kusd_id', 'oracle_id', 'surplus_id', 'budget_id'],
  factory: ['kusd_id', 'oracle_id', 'surplus_id', 'budget_id', 'gov', 'opened'],
};

// One writer at a time per store key: verification and the replace decision for a kind (or an owner)
// happen together, so a slow, stale POST can't land after a newer one.
const locks = new Map();
async function locked(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  let release;
  const mine = new Promise((r) => { release = r; });
  locks.set(key, prev.then(() => mine));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(key) === mine) locks.delete(key);
  }
}

export class RelayInputError extends Error {}

const HEX64 = /^[0-9a-f]{64}$/;
const hex = (bytes) => Buffer.from(bytes).toString('hex');

/** The protocol's pinned covenant IDs, from a showcase snapshot (`covenants.<name>.covid`). */
export function pinsFromSnapshot(snapshot) {
  return Object.fromEntries(PROTOCOL_KINDS.map((k) => {
    const covid = snapshot?.covenants?.[k]?.covid;
    if (!HEX64.test(covid || '')) throw new Error(`snapshot has no ${k} covid`);
    return [k, covid];
  }));
}

/** Validate a raw entry's shape and compute the address its state implies (throws RelayInputError). */
export function parseEntry(raw, { boxAddress }) {
  if (!raw || typeof raw !== 'object') throw new RelayInputError('entry must be an object');
  const { kind, covid, outpoint, value, state } = raw;
  if (![...PROTOCOL_KINDS, ...OWNER_KINDS, RECEIPT_KIND].includes(kind)) throw new RelayInputError(`unknown kind '${kind}'`);
  if (!HEX64.test(covid || '')) throw new RelayInputError('covid must be 64 lowercase hex');
  if (!outpoint || !HEX64.test(outpoint.transactionId || '')) throw new RelayInputError('outpoint.transactionId must be 64 lowercase hex');
  if (!Number.isSafeInteger(outpoint.index) || outpoint.index < 0) throw new RelayInputError('outpoint.index must be a non-negative integer');
  if (!Number.isSafeInteger(value) || value <= 0) throw new RelayInputError('value must be a positive integer (sompi)');
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new RelayInputError('state must be an object');
  const extra = Object.keys(state).filter((f) => !FIELDS[kind].includes(f));
  if (extra.length) throw new RelayInputError(`${kind} state has unknown field '${extra[0]}'`);
  let address;
  try {
    address = boxAddress(kind, state);
  } catch (e) {
    throw new RelayInputError(`${kind} state: ${e.message}`);
  }
  const owner = OWNER_KINDS.includes(kind) ? hex(state.owner) : undefined;
  return { kind, covid, outpoint: { transactionId: outpoint.transactionId, index: outpoint.index }, value, state, address, owner };
}

function lineageReason(e, pins) {
  // holder boxes share the authority's script and covid: the 0x10 owner scheme is what tells them apart
  if (e.kind === 'authority' && e.state.owner_scheme !== AUTHORITY_SCHEME) return 'not the token authority: owner scheme must be 0x10';
  if (e.kind === 'holder' && e.state.owner_scheme === AUTHORITY_SCHEME) return 'that is the token authority, not a holder box';
  if (PROTOCOL_KINDS.includes(e.kind)) return e.covid === pins[e.kind] ? null : `covid is not the pinned ${e.kind} covenant`;
  // a receipt lives in the oracle's covenant group: only the oracle's own entries can create one
  if (e.kind === RECEIPT_KIND) return e.covid === pins.oracle ? null : 'covid is not the pinned oracle covenant';
  if (e.kind === 'holder') return e.covid === pins.authority ? null : 'covid is not the pinned authority covenant';
  // vault provenance: the authority accepts a vault only from the factory's covenant group
  if (e.covid !== pins.factory) return 'not a vault the factory opened: covid is not the pinned vault group';
  const s = e.state;
  const wired = [['kusd_id', 'authority'], ['oracle_id', 'oracle'], ['surplus_id', 'surplus'], ['budget_id', 'budget']]
    .every(([field, pin]) => Array.isArray(s[field]) && hex(s[field]) === pins[pin]);
  return wired ? null : 'vault is not wired to this protocol';
}

/**
 * Check a parsed entry against our own node's UTXO set (`chain.utxos(addresses)`). The UTXO set alone is the proof:
 * the box exists, is accepted and unspent, at the address its claimed state implies, with the claimed value, and
 * carries the pinned covenant id, which consensus allows only as a valid continuation (no transaction lookup is
 * needed, and the node has no transaction index). Spent entries are pruned by liveness (`pruneDead`).
 */
async function verifyOnNode(e, { chain, pins }) {
  const lineage = lineageReason(e, pins);
  if (lineage) return { ok: false, reason: lineage };
  try {
    const u = (await chain.utxos([e.address])).find((x) => x.transactionId === e.outpoint.transactionId && Number(x.index) === e.outpoint.index);
    if (!u) return { ok: false, reason: "could not verify: not in the node's UTXO set (spent, or not accepted yet)", retry: true };   // the driver retries 'could not verify'
    if (u.covenantId !== e.covid) return { ok: false, reason: 'the box carries another covenant id' };
    if (Number(u.amount) !== e.value) return { ok: false, reason: 'value does not match' };
    return { ok: true, address: e.address, owner: e.owner, spent: [] };
  } catch (err) {
    return { ok: false, reason: `could not verify: ${err.message}`, retry: true };
  }
}

/** Drop stored receipts (with `receipts`) and the boxes of `owners` that the node no longer holds. Callers hold the locks. */
async function pruneDead(store, chain, { receipts: withReceipts = false, owners = [] } = {}) {
  const receipts = withReceipts ? Object.entries(await store.hgetall('kusd:receipts')).map(([k, v]) => ({ key: 'kusd:receipts', field: k, e: parseJson(v) })) : [];
  const mine = [];
  for (const o of owners) {
    for (const [k, v] of Object.entries(await store.hgetall(`kusd:owner:${o}`))) mine.push({ key: `kusd:owner:${o}`, field: k, e: parseJson(v) });
  }
  const all = [...receipts, ...mine];
  if (!all.length) return;
  const live = new Set((await chain.utxos([...new Set(all.map((x) => x.e.address))])).map((u) => `${u.transactionId}:${Number(u.index)}`));
  for (const x of all) {
    if (live.has(x.field)) continue;
    await store.hdel(x.key, x.field);
    if (x.key !== 'kusd:receipts') {
      await store.set('kusd:owner-entries', String(Math.max(0, Number((await store.get('kusd:owner-entries')) || 0) - 1)));
      await store.del(`kusd:outpoint:${x.field}`);
    }
  }
}

/** Check a parsed entry: against our own node when `deps.chain` is set, else against the TN10 API. */
export async function verifyEntry(e, deps) {
  if (deps.chain) return verifyOnNode(e, deps);
  const { fetchJson, pins, api } = deps;
  const lineage = lineageReason(e, pins);
  if (lineage) return { ok: false, reason: lineage };
  try {
    const tx = await fetchJson(`${api}/transactions/${e.outpoint.transactionId}`);
    if (tx.is_accepted === false) return { ok: false, reason: 'could not verify: transaction not accepted yet', retry: true };
    const out = (tx.outputs || []).find((o) => Number(o.index) === e.outpoint.index);
    if (!out) return { ok: false, reason: `creating transaction has no output ${e.outpoint.index}` };
    if (out.script_public_key_address !== e.address) return { ok: false, reason: 'address does not match the claimed state' };
    if (out.covenant_id !== e.covid) return { ok: false, reason: 'creating output carries another covenant id' };
    if (Number(out.amount) !== e.value) return { ok: false, reason: 'value does not match' };
    const utxos = await fetchJson(`${api}/addresses/${e.address}/utxos`);
    const live = (utxos || []).some((u) => u.outpoint?.transactionId === e.outpoint.transactionId && Number(u.outpoint?.index) === e.outpoint.index);
    // or not in the API's address index yet: worth another look
    if (!live) return { ok: false, reason: 'already spent', retry: true };
    // every vault continues the factory's group (an open spends the factory, a vault op spends the vault): a
    // creating transaction with no input of that group can't have produced it
    if (e.kind === 'vault' && !(tx.inputs || []).some((i) => i.covenant_id === e.covid)) {
      return { ok: false, reason: 'a vault is only created by the factory or by its own previous box' };
    }
    const spent = (tx.inputs || []).map((i) => ({ transactionId: i.previous_outpoint_hash, index: Number(i.previous_outpoint_index) }));
    return { ok: true, address: e.address, owner: e.owner, spent };
  } catch (err) {
    return { ok: false, reason: `could not verify: ${err.message}`, retry: true };
  }
}

const outpointKey = (o) => `${o.transactionId}:${o.index}`;
const stored = (e) => stringifyJson({ kind: e.kind, covid: e.covid, outpoint: e.outpoint, value: e.value, state: e.state, address: e.address });

async function rememberSpent(store, outpoints) {
  const list = JSON.parse((await store.get('kusd:spent')) || '[]');
  for (const o of outpoints) if (!list.includes(outpointKey(o))) list.push(outpointKey(o));
  await store.set('kusd:spent', JSON.stringify(list.slice(-SPENT_MEMORY)));
}

async function isRememberedSpent(store, o) {
  return JSON.parse((await store.get('kusd:spent')) || '[]').includes(outpointKey(o));
}

async function prune(store, spent) {
  const receipts = await store.hgetall('kusd:receipts');
  for (const s of spent) if (receipts[outpointKey(s)]) await store.hdel('kusd:receipts', outpointKey(s));
  for (const s of spent) {
    const owner = await store.get(`kusd:outpoint:${outpointKey(s)}`);
    if (!owner) continue;
    await locked(`kusd:owner:${owner}`, async () => {
      const h = await store.hgetall(`kusd:owner:${owner}`);
      if (h[outpointKey(s)]) {
        await store.hdel(`kusd:owner:${owner}`, outpointKey(s));
        await store.set('kusd:owner-entries', String(Math.max(0, Number((await store.get('kusd:owner-entries')) || 0) - 1)));
      }
      await store.del(`kusd:outpoint:${outpointKey(s)}`);
    });
  }
}

/** A protocol kind's stored box may be replaced only by a box whose tx spent it, or once it is spent. */
async function replaceReason(store, e, v, deps) {
  const prev = await store.get(`kusd:protocol:${e.kind}`);
  if (!prev) return null;
  const old = parseJson(prev);
  if (outpointKey(old.outpoint) === outpointKey(e.outpoint)) return null;
  // a governance rebind re-pins the kind to another covenant: the old box may stay unspent forever
  if (old.covid !== deps.pins[e.kind]) return null;
  if (v.spent.some((s) => outpointKey(s) === outpointKey(old.outpoint))) return null;
  if (deps.chain) {
    try {
      const live = (await deps.chain.utxos([old.address])).some((u) => `${u.transactionId}:${Number(u.index)}` === outpointKey(old.outpoint));
      return live ? 'the stored box is newer and still unspent' : null;
    } catch (err) {
      return `could not verify: ${err.message}`;
    }
  }
  try {
    const utxos = await deps.fetchJson(`${deps.api}/addresses/${old.address}/utxos`);
    const stillLive = (utxos || []).some((u) => outpointKey({ transactionId: u.outpoint?.transactionId, index: Number(u.outpoint?.index) }) === outpointKey(old.outpoint));
    return stillLive ? 'the stored box is newer and still unspent' : null;
  } catch (err) {
    return `could not verify: ${err.message}`;
  }
}

async function acceptOne(e, { store, ...deps }) {
  if (e.kind === RECEIPT_KIND) {
    return locked('kusd:receipts', async () => {
      if (await isRememberedSpent(store, e.outpoint)) return { ok: false, reason: 'already spent' };
      const v = await verifyEntry(e, deps);
      if (!v.ok) return v;
      if (deps.chain) await pruneDead(store, deps.chain, { receipts: true });
      const have = await store.hgetall('kusd:receipts');
      if (!have[outpointKey(e.outpoint)] && Object.keys(have).length >= MAX_RECEIPTS) return { ok: false, reason: `the relay holds ${MAX_RECEIPTS} receipts already` };
      await rememberSpent(store, v.spent);
      await prune(store, v.spent);
      await store.hset('kusd:receipts', outpointKey(e.outpoint), stored(e));
      return { ok: true, key: 'kusd:receipts' };
    });
  }
  if (PROTOCOL_KINDS.includes(e.kind)) {
    const key = `kusd:protocol:${e.kind}`;
    return locked(key, async () => {
      const v = await verifyEntry(e, deps);
      if (!v.ok) return v;
      const why = await replaceReason(store, e, v, deps);
      if (why) return { ok: false, reason: why, retry: why.startsWith('could not verify') };
      await rememberSpent(store, v.spent);
      await prune(store, v.spent);
      await store.set(key, stored(e));
      return { ok: true, key };
    });
  }
  const key = `kusd:owner:${e.owner}`;
  const v = await locked(key, async () => {
    if (await isRememberedSpent(store, e.outpoint)) return { ok: false, reason: 'already spent' };
    const r = await verifyEntry(e, deps);
    if (!r.ok) return r;
    if (deps.chain) await pruneDead(store, deps.chain, { owners: [e.owner] });
    const mine = await store.hgetall(key);
    const fresh = !mine[outpointKey(e.outpoint)];
    if (fresh && Object.keys(mine).length >= MAX_PER_OWNER) return { ok: false, reason: `that owner holds too many boxes here (${MAX_PER_OWNER})` };
    const total = Number((await store.get('kusd:owner-entries')) || 0);
    if (fresh && total >= MAX_OWNER_ENTRIES) return { ok: false, reason: 'the relay is full' };
    await store.hset(key, outpointKey(e.outpoint), stored(e));
    await store.set(`kusd:outpoint:${outpointKey(e.outpoint)}`, e.owner);
    if (fresh) await store.set('kusd:owner-entries', String(total + 1));
    return r;
  });
  if (!v.ok) return v;
  await rememberSpent(store, v.spent);
  await prune(store, v.spent);
  return { ok: true, key };
}

/**
 * Entries the API could not confirm yet, re-checked on their own: first after `firstMs`, then at
 * doubling intervals up to `capMs`, for `windowMs`. Bounded at `max`, and at `perClient` for one
 * poster; when full, creators' own retries still apply. Keyed by the whole claimed entry, so a forged
 * copy of a real outpoint (another state, value or covid) can't hold the honest entry's slot.
 */
export function makeRetryQueue({ now = Date.now, windowMs = RETRY_WINDOW_MS, max = MAX_QUEUED, perClient = MAX_QUEUED_PER_CLIENT, firstMs = 5_000, capMs = 30_000 } = {}) {
  const q = new Map(); // stored(entry) -> { entry, client, until, next, gap }
  let draining = null;
  return {
    get size() { return q.size; },
    /** Queue a parsed entry posted by `client`; false when the queue, or that client's share, is full. */
    add(e, client = '') {
      const k = stored(e);
      if (q.has(k)) return true;
      if (q.size >= max) return false;
      let mine = 0;
      for (const item of q.values()) if (item.client === client) mine++;
      if (mine >= perClient) return false;
      q.set(k, { entry: e, client, until: now() + windowMs, next: now() + firstMs, gap: firstMs });
      return true;
    },
    /** Re-check the entries that are due; resolves to how many were stored. One drain at a time. */
    drain(deps) {
      draining ??= (async () => {
        let stored = 0;
        for (const [k, item] of [...q]) {
          const t = now();
          if (t > item.until || (await isRememberedSpent(deps.store, item.entry.outpoint))) {
            q.delete(k);
            continue;
          }
          if (t < item.next) continue;
          const r = await acceptOne(item.entry, deps);
          if (r.ok) stored++;
          if (r.ok || !r.retry) {
            q.delete(k);
            continue;
          }
          item.gap = Math.min(capMs, item.gap * 2);
          item.next = now() + item.gap;
        }
        return stored;
      })().finally(() => { draining = null; });
      return draining;
    },
  };
}

/**
 * Verify and store each entry; prune owner boxes the verified transactions spent. With `deps.queue`,
 * an entry the API cannot confirm yet is queued for re-checking (`queued: true`), counted against
 * `deps.client` (the poster).
 */
export async function accept(rawEntries, deps) {
  if (!Array.isArray(rawEntries) || rawEntries.length === 0) throw new RelayInputError('entries must be a non-empty array');
  if (rawEntries.length > MAX_ENTRIES) throw new RelayInputError(`at most ${MAX_ENTRIES} entries per request`);
  const parsed = rawEntries.map((r) => parseEntry(r, deps));
  const results = [];
  for (const e of parsed) {
    const r = await acceptOne(e, deps);
    if (r.ok) results.push({ ok: true, key: r.key });
    else if (r.retry && deps.queue) results.push({ ok: false, reason: r.reason, queued: deps.queue.add(e, deps.client) });
    else results.push({ ok: false, reason: r.reason });
  }
  return results;
}

/** The protocol's latest verified boxes, plus `owner`'s boxes when asked. */
export async function read(store, { owner } = {}) {
  const protocol = {};
  for (const k of PROTOCOL_KINDS) {
    const v = await store.get(`kusd:protocol:${k}`);
    if (v) protocol[k] = parseJson(v);
  }
  // only receipts carrying the stored oracle's price fields (an older one is spent, or the relay is behind)
  const o = protocol.oracle?.state;
  protocol.receipts = Object.values(await store.hgetall('kusd:receipts')).map((v) => parseJson(v))
    .filter((r) => o && ['price', 'mint', 'liq', 'status', 'last', 'index'].every((f) => r.state[f] === o[f]));
  const mine = owner ? Object.values(await store.hgetall(`kusd:owner:${owner}`)).map((v) => parseJson(v)) : [];
  return { protocol, holders: mine.filter((e) => e.kind === 'holder'), vaults: mine.filter((e) => e.kind === 'vault') };
}
