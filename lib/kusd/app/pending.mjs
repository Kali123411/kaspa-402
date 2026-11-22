// Boxes this browser created, kept per wallet in localStorage: shown (after node verification) and
// republished to the relay on the next visit, in case the relay missed them.
export const LOCAL_KEY = 'kusd.created.v1';
const KINDS = ['oracle', 'psm', 'budget', 'authority', 'surplus'];
const CAP = 20;
const empty = () => ({ protocol: {}, holders: [], vaults: [], receipts: [] });

function readAll(storage) {
  try {
    const v = JSON.parse(storage.getItem(LOCAL_KEY) || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

/** `owner`: the wallet's x-only key; the record of another wallet is never mixed in. */
export function loadLocal(storage, owner) {
  const r = readAll(storage)[owner];
  if (!r || typeof r !== 'object') return empty();
  return {
    protocol: r.protocol && typeof r.protocol === 'object' ? r.protocol : {},
    holders: Array.isArray(r.holders) ? r.holders : [],
    vaults: Array.isArray(r.vaults) ? r.vaults : [],
    receipts: Array.isArray(r.receipts) ? r.receipts : [],
  };
}

export function saveLocal(storage, owner, local) {
  try {
    storage.setItem(LOCAL_KEY, JSON.stringify({ ...readAll(storage), [owner]: local }));
  } catch {
    // storage blocked: kept for this visit only
  }
}

/** Fold a transaction's created entries (relay form) into the record, newest first, stamped with `now`. */
export function mergeCreated(local, entries, now = Date.now()) {
  const stamped = entries.map((e) => ({ ...e, at: now }));
  return {
    protocol: { ...local.protocol, ...Object.fromEntries(stamped.filter((e) => KINDS.includes(e.kind)).map((e) => [e.kind, e])) },
    holders: [...stamped.filter((e) => e.kind === 'holder'), ...local.holders].slice(0, CAP),
    vaults: [...stamped.filter((e) => e.kind === 'vault'), ...local.vaults].slice(0, CAP),
    // the price receipt a transaction re-emitted (it read one): a candidate while the relay lags
    receipts: [...stamped.filter((e) => e.kind === 'receipt'), ...(local.receipts || [])].slice(0, CAP),
  };
}

/**
 * Drop what is no longer useful: protocol boxes older than `maxAgeMs` (the relay has caught up or they are
 * spent) and user boxes older than that which no longer verify (`verified`: "txid:index" keys).
 */
export function pruneLocal(local, verified, now, maxAgeMs) {
  const young = (e) => now - (e.at ?? 0) < maxAgeMs;
  const keep = (e) => young(e) || verified.has(`${e.outpoint.transactionId}:${e.outpoint.index}`);
  return {
    protocol: Object.fromEntries(Object.entries(local.protocol).filter(([, e]) => young(e))),
    holders: local.holders.filter(keep),
    vaults: local.vaults.filter(keep),
    receipts: (local.receipts || []).filter(young),
  };
}

/** Relay entries of a record (without the local timestamp), for republishing. */
export const allEntries = (local) => [...Object.values(local.protocol), ...local.holders, ...local.vaults, ...(local.receipts || [])].map(({ at, ...e }) => e);
