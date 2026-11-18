// The hourly oracle refresh job re-exports the snapshot to a data branch of the public kUSD repo.
// The page prefers that copy, but only when it describes the same covenants and is newer.

export const FEED_URL = 'https://raw.githubusercontent.com/Kali123411/kUSD/showcase-data/snapshot.json';

const time = (s) => Date.parse(s?.generatedAt);

export function pickSnapshot(bundled, remote) {
  if (!remote || typeof remote !== 'object' || remote.network !== bundled.network) return bundled;
  if (!(time(remote) > time(bundled))) return bundled;
  const names = Object.keys(bundled.covenants);
  const rc = remote.covenants || {};
  if (Object.keys(rc).length !== names.length) return bundled;
  if (!names.every((n) => rc[n]?.covid === bundled.covenants[n].covid)) return bundled;
  return remote;
}

export async function loadSnapshot(bundled, fetchJson, { url = FEED_URL, now = Date.now(), timeoutMs = 3000 } = {}) {
  // raw.githubusercontent.com caches for minutes; a per-minute query keeps the copy close to the chain
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs));
  try {
    const remote = await Promise.race([fetchJson(`${url}?m=${Math.floor(now / 60000)}`), timeout]);
    return pickSnapshot(bundled, remote);
  } catch {
    return bundled;
  }
}
