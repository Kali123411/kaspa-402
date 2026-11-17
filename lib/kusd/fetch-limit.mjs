// Outbound calls from the relay to the TN10 API: at most `concurrency` in flight (so hostile POSTs from
// many clients can't get this machine's IP throttled), accepted transactions cached (they never change),
// and responses over `maxBytes` refused. `get(url)` returns the response body as text.
export function limitedFetchJson(get, { concurrency = 4, maxBytes = 2_000_000, cacheSize = 500 } = {}) {
  let active = 0;
  const waiting = [];
  const cache = new Map();

  async function slot() {
    if (active < concurrency) {
      active++;
      return;
    }
    await new Promise((r) => waiting.push(r));
  }
  function release() {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }

  return async function fetchJson(url) {
    if (cache.has(url)) return cache.get(url);
    await slot();
    let text;
    try {
      text = await get(url, maxBytes);
    } finally {
      release();
    }
    if (text.length > maxBytes) throw new Error('response too large');
    const json = JSON.parse(text);
    if (url.includes('/transactions/') && json && json.is_accepted === true) {
      cache.set(url, json);
      if (cache.size > cacheSize) cache.delete(cache.keys().next().value);
    }
    return json;
  };
}

/** `get` for limitedFetchJson over real HTTP: 8 s timeout, body read with a byte cap. */
export async function httpGetText(url, maxBytes) {
  const r = await fetch(url, { headers: { 'user-agent': 'kusd-relay/1' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const reader = r.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error('response too large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
