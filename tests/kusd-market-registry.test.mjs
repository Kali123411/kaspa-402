// The market page's view of the registry: kUSD listings, the verified-settlements feed, a provider's detail,
// a liveness probe of an endpoint, and the bundled-snapshot fallback when the registry is unreachable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchListings, fetchActivity, fetchProvider, preflightLive, pickMarketSnapshot, loadMarket } from '../lib/kusd/market/registry.mjs';
import { HDR_REQUIRED, KUSD_BINDING, NETWORK_TESTNET } from '../lib/kusd/market/x402.mjs';

const BASE = 'https://market.test';
const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', ...headers } });
const listing = (over = {}) => ({ capability: 'summarize', endpoint: 'https://p.test/summarize', payee_pubkey: 'ab'.repeat(32), price_usd: 0.05,
  currency: 'kUSD', price_cents: 5, network: 'testnet-10', schemes: ['kusd-utxo'], listed_at: 1, meta: { wires: ['x402', 'k402'] },
  reputation: { settled_kas: 0, settled_cents: 25, closes: 0, first_settled: 1, last_settled: 2 }, ...over });

test('fetchListings asks for kUSD and keeps only kUSD listings', async () => {
  const seen = [];
  const f = async (url) => { seen.push(url); return json({ providers: [listing(), listing({ currency: 'KAS', price_cents: 0 })], count: 2 }); };
  const got = await fetchListings(BASE, f);
  assert.equal(got.length, 1);
  assert.equal(got[0].price_cents, 5);
  assert.match(seen[0], /\/registry\/search\?/);
  assert.match(seen[0], /currency=kUSD/);
  assert.match(seen[0], /limit=100/);
  await assert.rejects(fetchListings(BASE, async () => json({ error: 'down' }, 503)), /503/);
});

test('fetchActivity and fetchProvider return the registry answers; totals are numbers', async () => {
  const act = { settlements: [{ t: 1700000000, txid: 'd3'.repeat(32), idx: 0, payee_pubkey: 'ab'.repeat(32), cents: 5, capability: 'summarize' }], total_cents: 5 };
  const a = await fetchActivity(BASE, async (url) => { assert.match(url, /\/registry\/activity\?limit=50/); return json(act); });
  assert.deepEqual(a, act);
  const a2 = await fetchActivity(BASE, async (url) => { assert.match(url, /limit=7/); return json(act); }, 7);
  assert.equal(a2.total_cents, 5);
  const prov = await fetchProvider(BASE, 'ab'.repeat(32), async (url) => { assert.match(url, new RegExp(`/registry/provider/${'ab'.repeat(32)}$`)); return json({ payee_pubkey: 'ab'.repeat(32), listings: [], reputation: {} }); });
  assert.equal(prov.payee_pubkey, 'ab'.repeat(32));
});

test('preflightLive: a 402 carrying a kUSD requirement is live (and tells the quoted cents); anything else is not', async () => {
  const required = Buffer.from(JSON.stringify({ x402Version: 2, accepts: [{ scheme: 'exact', network: NETWORK_TESTNET, amount: '5', asset: '06'.repeat(32), payTo: 'cd'.repeat(32), extra: { binding: KUSD_BINDING, payment_id: 'p' } }] })).toString('base64');
  const live = await preflightLive('https://p.test/summarize', async (url, init) => { assert.equal(init.method, 'POST'); return json({}, 402, { [HDR_REQUIRED]: required }); });
  assert.deepEqual(live, { live: true, cents: 5 });
  // with our family and network given, another family's kUSD is not "live for us"
  const ok402 = async () => json({}, 402, { [HDR_REQUIRED]: required });
  assert.deepEqual(await preflightLive('https://p.test/summarize', ok402, { authority: '06'.repeat(32), network: NETWORK_TESTNET }), { live: true, cents: 5 });
  assert.deepEqual(await preflightLive('https://p.test/summarize', ok402, { authority: 'ee'.repeat(32), network: NETWORK_TESTNET }), { live: false, cents: null });
  assert.deepEqual(await preflightLive('https://p.test/summarize', ok402, { authority: '06'.repeat(32), network: 'kaspa:mainnet' }), { live: false, cents: null });
  assert.deepEqual(await preflightLive('https://p.test/summarize', async () => json({ hello: 'free' })), { live: false, cents: null });
  assert.deepEqual(await preflightLive('https://p.test/summarize', async () => json({}, 402)), { live: false, cents: null });
  assert.deepEqual(await preflightLive('https://p.test/summarize', async () => { throw new TypeError('Failed to fetch'); }), { live: false, cents: null });
});

test('pickMarketSnapshot / loadMarket: live when the registry answers, the bundled snapshot when it does not', async () => {
  const bundled = { generatedAt: '2026-11-17T00:00:00Z', registry: BASE, providers: [listing()], activity: { settlements: [], total_cents: 10 } };
  const live = { providers: [listing(), listing({ capability: 'extract' })], activity: { settlements: [{ cents: 5 }], total_cents: 15 } };
  assert.deepEqual(pickMarketSnapshot(bundled, live), { ...live, fromSnapshot: false, generatedAt: null, reason: null });
  assert.deepEqual(pickMarketSnapshot(bundled, null), { providers: bundled.providers, activity: bundled.activity, fromSnapshot: true, generatedAt: bundled.generatedAt, reason: 'unreachable' });
  const m = await loadMarket(BASE, bundled, async (url) => (url.includes('/registry/search') ? json({ providers: live.providers, count: 2 }) : json(live.activity)));
  assert.equal(m.fromSnapshot, false);
  assert.equal(m.providers.length, 2);
  const down = await loadMarket(BASE, bundled, async () => { throw new TypeError('Failed to fetch'); });
  assert.equal(down.fromSnapshot, true);
  assert.equal(down.activity.total_cents, 10);
  // one of the two calls failing still falls back as a whole (a half-live page would mislead)
  const half = await loadMarket(BASE, bundled, async (url) => (url.includes('/registry/search') ? json({ providers: live.providers }) : json({ error: 'x' }, 500)));
  assert.equal(half.fromSnapshot, true);
  assert.equal(half.reason, 'unreachable');
  // a registry that answers but has no /registry/activity (older k402) is told apart from one that is down
  const old = await loadMarket(BASE, bundled, async (url) => (url.includes('/registry/search') ? json({ providers: live.providers }) : json({ detail: 'Not Found' }, 404)));
  assert.equal(old.fromSnapshot, true);
  assert.equal(old.reason, 'no-activity');
});
