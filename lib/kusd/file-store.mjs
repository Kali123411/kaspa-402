// A tiny key-value store kept in one JSON file: the kUSD relay's storage on murr7800. Operations act on
// memory at once; every change schedules a write of the whole file (temp file, fsync, rename, so a crash
// or power loss can never leave it half-written), and writes run one after another. A failed write
// rejects that operation but never blocks the ones after it; a corrupt file found at startup is moved
// aside so the service still starts.
import { readFileSync, existsSync, openSync, writeSync, fsyncSync, closeSync, renameSync } from 'node:fs';

function load(path) {
  if (!existsSync(path)) return {};
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    if (data && typeof data === 'object' && !Array.isArray(data)) return data;
    throw new Error('not an object');
  } catch (e) {
    const aside = `${path}.corrupt-${Date.now()}`;
    renameSync(path, aside);
    console.error(`kusd-relay: ${path} was unreadable (${e.message}); moved to ${aside}, starting empty`);
    return {};
  }
}

function writeAtomic(path, text) {
  const tmp = `${path}.tmp`;
  const fd = openSync(tmp, 'w');
  try {
    writeSync(fd, text);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, path);
}

export function openFileStore(path) {
  const data = load(path);
  let queue = Promise.resolve();

  function persist() {
    const run = queue.catch(() => {}).then(() => writeAtomic(path, JSON.stringify(data)));
    queue = run;
    return run;
  }

  return {
    async get(k) { return typeof data[k] === 'string' ? data[k] : null; },
    async set(k, v) { data[k] = v; await persist(); },
    async del(k) { delete data[k]; await persist(); },
    async hset(k, f, v) { (data[k] = data[k] && typeof data[k] === 'object' ? data[k] : {})[f] = v; await persist(); },
    async hdel(k, f) { if (data[k] && typeof data[k] === 'object') delete data[k][f]; await persist(); },
    async hgetall(k) { return { ...(data[k] && typeof data[k] === 'object' ? data[k] : {}) }; },
    /** Number of stored keys (health check). */
    size: () => Object.keys(data).length,
    /** Resolves once every scheduled write has been attempted. */
    flush: () => queue.catch(() => {}),
  };
}
