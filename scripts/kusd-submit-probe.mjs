// Manual live go/no-go (not part of the test suite): build a kUSD swap_in with the kusd-client WASM
// from relay state and submit it through the bundled Kaspa SDK, exactly as the browser will.
// Usage: node scripts/kusd-submit-probe.mjs <secret-file> [cents]   (the secret is never printed)
import { readFileSync } from 'node:fs';
import * as sdk from '../public/kaspa-rpc/kaspa.js';
import * as kc from '../lib/kusd/wasm/kusd_client_wasm.mjs';
import { toSdkTransaction } from '../lib/kusd/app/sdk-tx.mjs';

sdk.initSync({ module: readFileSync(new URL('../public/kaspa-rpc/kaspa_bg.wasm', import.meta.url)) });
kc.initSync({ module: readFileSync(new URL('../lib/kusd/wasm/kusd_client_wasm_bg.wasm', import.meta.url)) });

const secret = readFileSync(process.argv[2], 'utf8').trim();
const cents = Number(process.argv[3] || 100);
const RELAY = process.env.KUSD_RELAY_URL || 'https://kusd.kaspa-402.org/state';
// pins and gate from the committed snapshot; the relay is untrusted (the node checks the rest on submit)
const snapshot = JSON.parse(readFileSync(new URL('../public/kusd/snapshot.json', import.meta.url), 'utf8'));
const PINS = Object.fromEntries(['oracle', 'psm', 'budget', 'authority', 'surplus'].map((k) => [k, snapshot.covenants[k].covid]));
const bytes = (hex) => Array.from(Buffer.from(hex, 'hex'));
const live = (e) => ({ covid: bytes(e.covid), outpoint: e.outpoint, value: e.value, state: e.state });

const w = JSON.parse(kc.wallet(secret, true));
if (w.error) throw new Error(w.error);
console.log('wallet', w.address);

const relay = await (await fetch(RELAY)).json();
const p = relay.protocol;
for (const k of Object.keys(PINS)) if (p[k]?.covid !== PINS[k]) throw new Error(`relay ${k} is not under the pinned covenant`);
const protocol = Object.fromEntries(Object.keys(PINS).map((k) => [k, live(p[k])]));

const rpc = new sdk.RpcClient({ resolver: new sdk.Resolver(), networkId: 'testnet-10' });
await rpc.connect();
try {
  const { virtualDaaScore } = await rpc.getBlockDagInfo();
  const clock = Number(virtualDaaScore) - 10;
  const { entries } = await rpc.getUtxosByAddresses([w.address]);
  const coins = entries.map((u) => ({
    outpoint: { transactionId: u.outpoint.transactionId, index: u.outpoint.index },
    entry: { amount: Number(u.amount), scriptPublicKey: `000020${w.xonly}ac`, blockDaaScore: Number(u.blockDaaScore), isCoinbase: u.isCoinbase, covenantId: null },
  }));
  console.log('coins', coins.length, 'sompi', coins.reduce((s, c) => s + c.entry.amount, 0), 'clock', clock);
  const out = JSON.parse(kc.build(JSON.stringify({
    flow: 'swap_in', protocol, gate: [PINS.oracle, PINS.psm, PINS.surplus, PINS.budget],
    secret, testnet: true, coins, clock, params: { cents },
  })));
  if (out.error) throw new Error(`build refused: ${out.error}`);
  const tx = toSdkTransaction(out.tx, sdk);
  console.log('built', out.txid, 'sdk id', tx.id);
  const r = await rpc.submitTransaction({ transaction: tx, allowOrphan: false });
  console.log('ACCEPTED', r.transactionId);
  const hex = (a) => Buffer.from(a).toString('hex');
  const published = out.created.map((c) => ({ kind: c.kind, covid: hex(c.covid), outpoint: { transactionId: out.txid, index: c.index }, value: c.value, state: c.state }));
  const pub = await fetch(RELAY, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entries: published }) });
  console.log('relay', pub.status, (await pub.json()).results?.map((x) => (x.ok ? 'ok' : x.reason)).join(', '));
} finally {
  await rpc.disconnect();
}
