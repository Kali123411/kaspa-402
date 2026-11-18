// The /kusd/app page: the shipped client is the pinned build, the copy carries the honest caveats, and
// the page talks only to the relay, the TN10 explorer API and the feed — no trackers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { oracleSources } from '../lib/kusd/app/status.mjs';

const source = JSON.parse(readFileSync(new URL('../lib/kusd/wasm/SOURCE.json', import.meta.url), 'utf8'));
const files = [
  'pages/kusd/app.js',
  'lib/kusd/story.mjs',   // the disclaimer set the status strip renders
  ...readdirSync(new URL('../components/kusd/app/', import.meta.url)).map((f) => `components/kusd/app/${f}`),
  ...readdirSync(new URL('../lib/kusd/app/', import.meta.url)).map((f) => `lib/kusd/app/${f}`),
];
const app = files.map((f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')).join('\n');

test('the browser loads the pinned kusd-client build', () => {
  const wasm = readFileSync(new URL('../public/kusd-wasm/kusd_client_wasm_bg.wasm', import.meta.url));
  assert.equal(createHash('sha256').update(wasm).digest('hex'), source.sha256);
  assert.equal(
    readFileSync(new URL('../public/kusd-wasm/kusd_client_wasm.mjs', import.meta.url), 'utf8'),
    readFileSync(new URL('../lib/kusd/wasm/kusd_client_wasm.mjs', import.meta.url), 'utf8'),
  );
  const strip = readFileSync(new URL('../components/kusd/app/StatusStrip.jsx', import.meta.url), 'utf8');
  assert.match(strip, /import source from '\.\.\/\.\.\/\.\.\/lib\/kusd\/wasm\/SOURCE\.json'/);
  assert.match(strip, /source\.sha256/, 'the status strip shows the pinned hash');
});

test('the app page carries the caveats', () => {
  assert.match(app, /not audited/i);
  assert.match(app, /TN10/);
  assert.match(app.replace(/\s+/g, ' '), /all five operator keys are held by the deployer/);
});

test('no trackers and no unexpected hosts', () => {
  assert.doesNotMatch(app, /googletagmanager|google-analytics|gtag\(|plausible|segment\.com|mixpanel|posthog/i);
  assert.doesNotMatch(app, /<script[^>]+src=/i);
  const allowed = [/^https:\/\/www\.kaspa-402\.org\//, /^https:\/\/kusd\.kaspa-402\.org\//, /^https:\/\/api-tn10\.kaspa\.org\//, /^https:\/\/raw\.githubusercontent\.com\/kaspa-402\/kUSD\//,
    /^https:\/\/faucet-tn10\.kaspanet\.io\//, /^https:\/\/github\.com\/kaspa-402\/kUSD/, /^https:\/\/explorer-tn10\.kaspa\.org\//,
    // our own three layers, named in lib/kusd/story.mjs
    /^https:\/\/kaspa-402\.org/, /^https:\/\/kaspa-app\.vercel\.app\//, /^https:\/\/github\.com\/kaspa-402\/k402/];
  const urls = app.match(/https?:\/\/[^\s'"`)]+/g) || [];
  for (const u of urls) assert.ok(allowed.some((r) => r.test(u)), `unexpected host in ${u}`);
});

test('oracle source names come from the latest heartbeat note', () => {
  const timeline = [
    { step: 'HEARTBEAT', time: 1, note: '3 routine refreshes … Latest: operators 0, 2 and 3 printed 268 (CoinGecko) / 267 (Kraken) / 268 (KuCoin), median $0.0268.' },
    { step: 'REFRESH', time: 2, note: 'Price refresh by operators 0,2,3' },
    { step: 'HEARTBEAT', time: 3, note: '12 routine refreshes since 2026-11-15 00:37 UTC keep the feed from going stale. Latest: operators 0, 2 and 3 printed 268 (CoinGecko) / 267 (Kraken) / 268 (Gate.io), median $0.0268.' },
  ];
  assert.deepEqual(oracleSources(timeline), ['CoinGecko', 'Kraken', 'Gate.io']);
  assert.equal(oracleSources([{ step: 'REFRESH', time: 1, note: 'no names' }]), null);
  assert.equal(oracleSources(undefined), null);
});
