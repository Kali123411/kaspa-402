// The site's directory is a view of the k402 registry's catalog: every entry maps onto the listing shape the
// pages read, kUSD-priced listings stay on the market page, dust and malformed entries never show.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fromCatalog, fromCatalogAll } from '../lib/registry.js';

const attested = {
  id: 'attested:https://prove-api.kaspa-402.org/exact', kind: 'attested', capability: 'kaspa-finality-proof',
  endpoint: 'https://prove-api.kaspa-402.org/exact', serviceName: 'Finality proof', description: 'SP1', network: 'kaspa:mainnet',
  scheme: 'exact', currency: 'KAS', amount_sompi: 100000000, price_cents: 0,
  pay_to: 'kaspa:qze7l36kx4h926sfv00p8tj8gf7ulxmga6rc8nsn7dhnmppt6q8nyg5sr0xjy', settles: 'kaspa', tags: ['zk'], verified: true, live: true, probed_at: 1794900000,
};
const base = { ...attested, id: 'attested:https://router/x', endpoint: 'https://router/x', settles: 'base', capability: 'base:token-price' };
const signedKusd = { id: 'signed:ab:summarize', kind: 'signed', capability: 'summarize', endpoint: 'https://summarize.kaspa-402.org/summarize',
  network: 'kaspa:testnet-10', currency: 'kUSD', amount_sompi: null, price_cents: 5, payee_pubkey: 'ab'.repeat(32), verified: true };
const dust = { ...attested, id: 'attested:https://dust', endpoint: 'https://dust', amount_sompi: 1000 };

test('an attested KAS listing becomes a site listing with the live terms', () => {
  const l = fromCatalog(attested);
  assert.equal(l.resource, attested.endpoint);
  assert.equal(l.amountSompi, 100000000);
  assert.equal(l.payTo, attested.pay_to);
  assert.equal(l.kind, 'kaspa');
  assert.equal(l.source, 'attested');
  assert.equal(l.verified, true);
  assert.deepEqual(l.tags, ['zk']);
  assert.equal(fromCatalog(base).kind, 'base');
});

test('kUSD-priced and dust entries stay out of the KAS directory', () => {
  assert.equal(fromCatalog(signedKusd), null);
  assert.equal(fromCatalogAll([attested, base, signedKusd, dust, null, 'junk']).length, 2);
});
