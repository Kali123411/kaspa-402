// Phase 2 P1-6: directory cards say what the badge means, when the probe last passed, the price in human units with
// raw sompi on hover, a copy-URL button; the directory sorts (recency, price) and has an empty state per network filter.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fromCatalog } from '../lib/registry.js';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const idx = read('pages/index.js');
const card = idx.slice(idx.indexOf('function ServiceCard'), idx.indexOf('export default function'));

test('the card: probe badge, last verified, human price with raw sompi on hover, copy URL', () => {
  assert.ok(card.includes("'402 probe passed'"), 'badge text says what verified means');
  assert.ok(card.includes('last verified') && card.includes('probedAt'), 'last verified from probedAt');
  assert.ok(/title=\{`\$\{l\.amountSompi\} sompi`\}/.test(card), 'raw sompi on hover');
  assert.ok(card.includes('<CopyUrl') && idx.includes('navigator.clipboard.writeText(l.resource)'), 'copy-URL button');
  assert.ok(idx.includes('aria-label="Copy URL"'));
});

test('the directory sorts by recency or price and names the network in its empty state', () => {
  assert.ok(/<option value="recent">/.test(idx) && /<option value="price">/.test(idx), 'sort control');
  assert.ok(idx.includes("sort === 'price'"), 'price sort branch');
  assert.ok(idx.includes('No ${net} services match') || idx.includes("net === 'all' ? 'No services match' : `No ${net} services match"), 'per-network empty state');
});

test('fromCatalog carries listedAt for the recency sort', () => {
  const l = fromCatalog({ id: 'x', endpoint: 'https://s/x', amount_sompi: '1000', network: 'kaspa:mainnet', scheme: 'exact', kind: 'signed', listed_at: 1794800000, probed_at: 1794800100, verified: true, currency: 'KAS' });
  assert.equal(l.listedAt, 1794800000);
  assert.equal(l.probedAt, 1794800100);
});
