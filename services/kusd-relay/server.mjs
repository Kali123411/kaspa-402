// kUSD state relay HTTP service (runs on murr7800, public through the Cloudflare tunnel).
//   GET  /health                 -> {ok, entries, queued}
//   GET  /state[?owner=<64hex>]  -> the protocol's latest verified boxes (+ that owner's boxes)
//   POST /state {entries:[...]}  -> per-entry {ok, reason?, queued?}; stored only if verified against TN10;
//                                   entries the API can't confirm yet are re-checked here for a few minutes
// Untrusted by design: browsers re-verify everything they read.
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { accept, read, makeRetryQueue, RelayInputError } from '../../lib/kusd/relay.mjs';
import { loadClient } from '../../lib/kusd/client.mjs';
import { openFileStore } from '../../lib/kusd/file-store.mjs';
import { limitedFetchJson, httpGetText } from '../../lib/kusd/fetch-limit.mjs';
import { connectNodeChain } from '../../lib/kusd/node-chain.mjs';
import { parseJson, stringifyJson } from '../../lib/kusd/json64.mjs';

const MAX_BODY = 64 * 1024;
const DEFAULT_LIMITS = { postsPerMinute: 30, maxClients: 10_000, maxInFlight: 8 };
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', ...CORS });
  res.end(stringifyJson(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, `body over ${MAX_BODY} bytes`));
        req.pause();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function makeServer({ store, fetchJson, boxAddress, pins, api, chain, limits = {}, now = Date.now, queue = makeRetryQueue(), retryEveryMs = 5_000 }) {
  const { postsPerMinute, maxClients, maxInFlight } = { ...DEFAULT_LIMITS, ...limits };
  const deps = { store, fetchJson, boxAddress, pins, api, chain, queue };
  // fixed one-minute windows per client; refused requests are not counted; stale clients swept
  const windows = new Map(); // client -> { start, count }
  const limited = (client) => {
    const t = now();
    for (const [c, w] of windows) if (t - w.start >= 60_000) windows.delete(c);
    let w = windows.get(client);
    if (!w) {
      if (windows.size >= maxClients) return true;
      w = { start: t, count: 0 };
      windows.set(client, w);
    }
    if (w.count >= postsPerMinute) return true;
    w.count++;
    return false;
  };
  let inFlight = 0;

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://relay');
      if (req.method === 'OPTIONS') {
        res.writeHead(204, CORS);
        return res.end();
      }
      if (url.pathname === '/health' && req.method === 'GET') return send(res, 200, { ok: true, entries: store.size(), queued: queue.size });
      if (url.pathname !== '/state') return send(res, 404, { error: 'not found' });
      if (req.method === 'GET') {
        const owner = url.searchParams.get('owner') || undefined;
        if (owner && !/^[0-9a-f]{64}$/.test(owner)) throw new HttpError(400, 'owner must be 64 lowercase hex');
        return send(res, 200, await read(store, { owner }));
      }
      if (req.method === 'POST') {
        const client = String(req.headers['cf-connecting-ip'] || req.socket.remoteAddress);
        if (limited(client)) throw new HttpError(429, `at most ${postsPerMinute} posts per minute`);
        if (inFlight >= maxInFlight) throw new HttpError(503, 'busy, try again shortly');
        inFlight++;
        try {
          let body;
          try {
            body = parseJson(await readBody(req));
          } catch (e) {
            if (e instanceof HttpError) throw e;
            throw new HttpError(400, 'body must be JSON');
          }
          return send(res, 200, { results: await accept(body?.entries, { ...deps, client }) });
        } finally {
          inFlight--;
        }
      }
      return send(res, 405, { error: 'method not allowed' });
    } catch (e) {
      if (e instanceof HttpError) {
        if (e.status === 413) res.setHeader('connection', 'close');
        send(res, e.status, { error: e.message });
        if (e.status === 413) req.destroy();
        return;
      }
      if (e instanceof RelayInputError) return send(res, 400, { error: e.message });
      return send(res, 500, { error: 'internal error' });
    }
  });
  // slow clients (slow-loris) are cut off quickly
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  const retry = setInterval(() => queue.drain(deps).catch((e) => console.error('kusd-relay: retry', e)), retryEveryMs);
  retry.unref();
  server.on('close', () => clearInterval(retry));
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.env.KUSD_RELAY_DIR || fileURLToPath(new URL('.', import.meta.url));
  const port = Number(process.env.KUSD_RELAY_PORT || 8735);
  const pins = JSON.parse(readFileSync(join(dir, 'pins.json'), 'utf8'));
  // KUSD_RELAY_NODE (Borsh wRPC, e.g. ws://100.70.36.25:17210): verify against our own node's UTXO set instead of the
  // public API, whose transaction index can lag the chain by many minutes. KUSD_RELAY_SDK: the Kaspa SDK directory.
  const nodeUrl = process.env.KUSD_RELAY_NODE;
  const sdkDir = pathToFileURL(`${process.env.KUSD_RELAY_SDK || fileURLToPath(new URL('../../public/kaspa-rpc/', import.meta.url))}/`.replace(/\/+$/, '/'));
  const chain = nodeUrl ? await connectNodeChain(nodeUrl, sdkDir) : undefined;
  if (chain) console.log(`kusd-relay: verifying against the node at ${nodeUrl}`);
  const server = makeServer({
    chain,
    store: openFileStore(join(dir, 'store.json')),
    fetchJson: limitedFetchJson(httpGetText),
    boxAddress: loadClient().boxAddress,
    pins,
    api: process.env.KUSD_TN10_API || 'https://api-tn10.kaspa.org',
  });
  server.listen(port, '0.0.0.0', () => console.log(`kusd-relay listening on 0.0.0.0:${port}`));
  process.on('unhandledRejection', (e) => console.error('kusd-relay: unhandled', e));
}
