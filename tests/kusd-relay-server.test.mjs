// The relay HTTP service and its file store.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadClient } from '../lib/kusd/client.mjs';
import { openFileStore } from '../lib/kusd/file-store.mjs';
import { makeServer } from '../services/kusd-relay/server.mjs';

const golden = JSON.parse(readFileSync(new URL('./fixtures/kusd-golden.json', import.meta.url), 'utf8'));
const { boxAddress } = loadClient();
const pins = { oracle: '07'.repeat(32), psm: '66'.repeat(32), budget: '88'.repeat(32), authority: '42'.repeat(32), surplus: '77'.repeat(32) };
const oracleState = golden.box_address.request.state;

function oracleEntry(txByte = 'a1', price = oracleState.price) {
  return { kind: 'oracle', covid: pins.oracle, outpoint: { transactionId: txByte.repeat(32), index: 3 }, value: 100_000_000, state: { ...oracleState, price } };
}

/** Fake TN10: every oracle entry posted is a confirmed, unspent box. */
function fetchJsonFor(entries) {
  return async (url) => {
    const tx = url.match(/\/transactions\/([0-9a-f]{64})$/);
    if (tx) {
      const e = entries.find((x) => x.outpoint.transactionId === tx[1]);
      return { is_accepted: true, inputs: [], outputs: [{ index: 3, amount: e.value, covenant_id: e.covid, script_public_key_address: boxAddress('oracle', e.state) }] };
    }
    const ad = url.match(/\/addresses\/([^/]+)\/utxos$/);
    return entries.filter((e) => boxAddress('oracle', e.state) === ad[1]).map((e) => ({ outpoint: e.outpoint, utxoEntry: { amount: String(e.value) } }));
  };
}

async function start(opts) {
  const dir = mkdtempSync(join(tmpdir(), 'kusd-relay-'));
  const store = opts.store || openFileStore(join(dir, 'store.json'));
  const server = makeServer({ store, boxAddress, pins, api: 'https://tn10.test', ...opts });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { dir, store, server, base, close: () => new Promise((r) => server.close(r)) };
}

const post = (base, body, headers = {}) => fetch(`${base}/state`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('malformed_requests_refused', async () => {
  const s = await start({ fetchJson: fetchJsonFor([]) });
  try {
    const many = Array.from({ length: 17 }, () => oracleEntry());
    let r = await post(s.base, { entries: many });
    assert.equal(r.status, 400);
    assert.match((await r.json()).error, /at most 16/);
    r = await post(s.base, 'x'.repeat(70 * 1024));
    assert.equal(r.status, 413);
    r = await fetch(`${s.base}/state?owner=xyz`);
    assert.equal(r.status, 400);
    r = await post(s.base, { entries: [{ ...oracleEntry(), kind: 'liquidator' }] });
    assert.equal(r.status, 400);
    assert.match((await r.json()).error, /liquidator/);
    r = await post(s.base, '{not json');
    assert.equal(r.status, 400);
    r = await fetch(`${s.base}/state`, { method: 'DELETE' });
    assert.equal(r.status, 405);
  } finally {
    await s.close();
  }
});

test('post_then_get_round_trip', async () => {
  const e = oracleEntry();
  const s = await start({ fetchJson: fetchJsonFor([e]) });
  try {
    const r = await post(s.base, { entries: [e] });
    assert.equal(r.status, 200);
    assert.deepEqual((await r.json()).results.map((x) => x.ok), [true]);
    const got = await (await fetch(`${s.base}/state`)).json();
    assert.deepEqual(got.protocol.oracle.outpoint, e.outpoint);
    const health = await (await fetch(`${s.base}/health`)).json();
    assert.equal(health.ok, true);
  } finally {
    await s.close();
  }
});

test('cors_preflight_answered', async () => {
  const s = await start({ fetchJson: fetchJsonFor([]) });
  try {
    const r = await fetch(`${s.base}/state`, { method: 'OPTIONS', headers: { origin: 'https://kaspa-app.vercel.app', 'access-control-request-method': 'POST' } });
    assert.equal(r.status, 204);
    assert.equal(r.headers.get('access-control-allow-origin'), '*');
    assert.match(r.headers.get('access-control-allow-methods'), /POST/);
    const g = await fetch(`${s.base}/state`);
    assert.equal(g.headers.get('access-control-allow-origin'), '*');
  } finally {
    await s.close();
  }
});

test('store_survives_restart', async () => {
  const e = oracleEntry();
  const s = await start({ fetchJson: fetchJsonFor([e]) });
  await post(s.base, { entries: [e] });
  await s.store.flush();
  await s.close();
  const reopened = openFileStore(join(s.dir, 'store.json'));
  const again = await start({ store: reopened, fetchJson: fetchJsonFor([e]) });
  try {
    const got = await (await fetch(`${again.base}/state`)).json();
    assert.deepEqual(got.protocol.oracle.outpoint, e.outpoint);
  } finally {
    await again.close();
  }
});

test('concurrent_posts_do_not_corrupt_the_file', async () => {
  const entries = Array.from({ length: 20 }, (_, i) => oracleEntry(i.toString(16).padStart(2, 'b'), oracleState.price + i));
  const s = await start({ fetchJson: fetchJsonFor(entries) });
  try {
    const res = await Promise.all(entries.map((e) => post(s.base, { entries: [e] }, { 'cf-connecting-ip': `10.0.0.${entries.indexOf(e)}` })));
    assert.ok(res.every((r) => r.status === 200));
    await s.store.flush();
    const file = JSON.parse(readFileSync(join(s.dir, 'store.json'), 'utf8'));
    const kept = JSON.parse(file['kusd:protocol:oracle']);
    assert.ok(entries.some((e) => e.outpoint.transactionId === kept.outpoint.transactionId));
  } finally {
    await s.close();
  }
});

test('post_rate_limited', async () => {
  const e = oracleEntry();
  const s = await start({ fetchJson: fetchJsonFor([e]) });
  try {
    for (let i = 0; i < 30; i++) assert.equal((await post(s.base, { entries: [e] }, { 'cf-connecting-ip': '203.0.113.9' })).status, 200);
    assert.equal((await post(s.base, { entries: [e] }, { 'cf-connecting-ip': '203.0.113.9' })).status, 429);
    assert.equal((await post(s.base, { entries: [e] }, { 'cf-connecting-ip': '203.0.113.10' })).status, 200);
  } finally {
    await s.close();
  }
});

// --- review fixes --------------------------------------------------------------------------------

test('refused posts do not extend a client\'s block, and the window resets', async () => {
  let clock = 1_000_000;
  const e = oracleEntry();
  const s = await start({ fetchJson: fetchJsonFor([e]), now: () => clock });
  try {
    const ip = { 'cf-connecting-ip': '203.0.113.20' };
    for (let i = 0; i < 30; i++) assert.equal((await post(s.base, { entries: [e] }, ip)).status, 200);
    for (let i = 0; i < 50; i++) {
      clock += 1000;
      assert.equal((await post(s.base, { entries: [e] }, ip)).status, 429);
    }
    clock += 11_000; // 61 s after the window opened
    assert.equal((await post(s.base, { entries: [e] }, ip)).status, 200);
  } finally {
    await s.close();
  }
});

test('the number of tracked clients is capped', async () => {
  const e = oracleEntry();
  const s = await start({ fetchJson: fetchJsonFor([e]), limits: { maxClients: 3 } });
  try {
    for (const n of [1, 2, 3]) assert.equal((await post(s.base, { entries: [e] }, { 'cf-connecting-ip': `198.51.100.${n}` })).status, 200);
    assert.equal((await post(s.base, { entries: [e] }, { 'cf-connecting-ip': '198.51.100.4' })).status, 429);
  } finally {
    await s.close();
  }
});

test('posts beyond the in-flight cap get 503', async () => {
  const e = oracleEntry();
  const slow = async (url) => { await new Promise((r) => setTimeout(r, 200)); return fetchJsonFor([e])(url); };
  const s = await start({ fetchJson: slow, limits: { maxInFlight: 2 } });
  try {
    const res = await Promise.all([1, 2, 3].map((n) => post(s.base, { entries: [e] }, { 'cf-connecting-ip': `192.0.2.${n}` })));
    assert.deepEqual(res.map((r) => r.status).sort(), [200, 200, 503]);
  } finally {
    await s.close();
  }
});

test('slow clients time out quickly', async () => {
  const s = await start({ fetchJson: fetchJsonFor([]) });
  try {
    assert.ok(s.server.requestTimeout > 0 && s.server.requestTimeout <= 15_000, String(s.server.requestTimeout));
    assert.ok(s.server.headersTimeout > 0 && s.server.headersTimeout <= 15_000, String(s.server.headersTimeout));
  } finally {
    await s.close();
  }
});
