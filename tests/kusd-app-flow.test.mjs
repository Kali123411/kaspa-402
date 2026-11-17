// Building, reviewing and broadcasting a flow: what the review sheet shows, and the one rebuild when
// someone else spent a shared protocol box first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as kc from '../lib/kusd/wasm/kusd_client_wasm.mjs';
import { describeTx } from '../lib/kusd/app/review.mjs';
import { runFlow, relayEntries } from '../lib/kusd/app/flow.mjs';

kc.initSync({ module: readFileSync(new URL('../lib/kusd/wasm/kusd_client_wasm_bg.wasm', import.meta.url)) });
const golden = JSON.parse(readFileSync(new URL('./fixtures/kusd-golden.json', import.meta.url), 'utf8'));
const buildWasm = (req) => {
  const out = JSON.parse(kc.build(JSON.stringify(req)));
  if (out.error) throw new Error(out.error);
  return out;
};

test('describe_swap_in', () => {
  const req = golden.cases.swap_in.request;
  const owner = JSON.parse(kc.wallet(req.secret, true)).xonly;
  const built = buildWasm(req);
  const d = describeTx(built, { request: req, owner });
  const kasIn = 15267180000;
  const psmIn = d.inputs.find((i) => i.what === 'PSM reserve');
  const psmOut = d.outputs.find((o) => o.what === 'PSM reserve');
  assert.equal(psmOut.sompi - psmIn.sompi, kasIn);
  assert.ok(d.outputs.some((o) => o.what === 'your kUSD box (4.00 kUSD)'));
  assert.ok(d.outputs.some((o) => o.what === 'your KAS change'));
  assert.ok(d.inputs.some((i) => i.what === 'oracle (read)'));
  assert.ok(d.inputs.some((i) => i.what === 'your KAS'));
  assert.equal(d.feeSompi, 10_000_000);
  assert.equal(d.clock, req.clock);
  const sum = (xs) => xs.reduce((s, x) => s + x.sompi, 0);
  assert.equal(sum(d.inputs) - sum(d.outputs), d.feeSompi);
});

test('describe_send names the recipient', () => {
  const req = golden.cases.send.request;
  const owner = JSON.parse(kc.wallet(req.secret, true)).xonly;
  const d = describeTx(buildWasm(req), { request: req, owner });
  assert.ok(d.outputs.some((o) => /^kUSD box for [0-9a-f]{8}… \(\d+\.\d\d kUSD\)$/.test(o.what)), JSON.stringify(d.outputs));
});

function harness({ rejections = [], publishError } = {}) {
  const calls = { build: 0, state: 0, submit: 0, published: [] };
  const base = golden.cases.swap_in.request;
  const ctx = { protocol: base.protocol, gate: base.gate, coins: base.coins, clock: base.clock, testnet: true };
  return {
    calls,
    opts: {
      flow: 'swap_in',
      params: { cents: 400 },
      secret: base.secret,
      getState: async () => { calls.state++; return { ...ctx, clock: ctx.clock + calls.state }; },
      build: (req) => { calls.build++; return buildWasm(req); },
      submit: async (built) => {
        calls.submit++;
        const r = rejections.shift();
        if (r) throw new Error(r);
        return built.txid;
      },
      publish: async (entries) => { if (publishError) throw new Error(publishError); calls.published.push(entries); },
    },
  };
}

test('spent_input_rebuilds_once', async () => {
  // a shared box moved: rebuilt once against fresh state and handed back for a new review, not broadcast
  const h = harness({ rejections: ['transaction input #0 is already spent by transaction 1a2b in the mempool'] });
  const { ContentionError } = await import('../lib/kusd/app/flow.mjs');
  const err = await runFlow(h.opts).catch((x) => x);
  assert.ok(err instanceof ContentionError);
  assert.equal(h.calls.build, 2);
  assert.equal(h.calls.submit, 1);
  const second = buildWasm({ ...golden.cases.swap_in.request, clock: golden.cases.swap_in.request.clock + 2 });
  assert.equal(err.built.txid, second.txid);
  assert.equal(h.calls.published.length, 0);
});

test('second_failure_surfaces', async () => {
  // the re-reviewed transaction, if it also loses the race, comes back again rather than looping
  const h = harness({ rejections: ['transaction input #0 is already spent', 'transaction input #1 is already spent (again)'] });
  const { ContentionError } = await import('../lib/kusd/app/flow.mjs');
  const first = await runFlow(h.opts).catch((x) => x);
  const again = await runFlow({ ...h.opts, prebuilt: first.built }).catch((x) => x);
  assert.ok(again instanceof ContentionError);
  assert.equal(h.calls.submit, 2);
  assert.match(String(again.cause.message), /\(again\)/);
});

test('other_rejection_not_retried', async () => {
  const h = harness({ rejections: ['transaction is not finalized'] });
  await assert.rejects(runFlow(h.opts), /not finalized/);
  assert.equal(h.calls.build, 1);
});

test('a builder refusal is not retried', async () => {
  const h = harness();
  h.opts.params = { cents: 40_000_000_001 }; // over MAX_SWAP
  await assert.rejects(runFlow(h.opts));
  assert.equal(h.calls.submit, 0);
});

test('publish_failure_does_not_fail_the_flow', async () => {
  const h = harness({ publishError: 'relay down' });
  const r = await runFlow(h.opts);
  assert.match(r.txid, /^[0-9a-f]{64}$/);
});

test('relay entries carry the txid and hex covids', () => {
  const built = buildWasm(golden.cases.swap_in.request);
  const e = relayEntries(built);
  assert.equal(e.length, built.created.length);
  assert.deepEqual(e[0].outpoint, { transactionId: built.txid, index: built.created[0].index });
  assert.match(e[0].covid, /^[0-9a-f]{64}$/);
});

test('publish retries the entries the relay could not verify yet', async () => {
  const { publishWithRetry } = await import('../lib/kusd/app/flow.mjs');
  const entries = [{ kind: 'psm' }, { kind: 'oracle' }, { kind: 'holder' }];
  const answers = [
    { results: [{ ok: true }, { ok: false, reason: 'could not verify: transaction not accepted yet' }, { ok: false, reason: 'covid is not the pinned authority covenant' }] },
    { results: [{ ok: true }] },
  ];
  const posted = [];
  const r = await publishWithRetry(entries, async (batch) => { posted.push(batch.map((e) => e.kind)); return answers.shift(); }, { sleep: async () => {} });
  assert.deepEqual(posted, [['psm', 'oracle', 'holder'], ['oracle']]);
  assert.deepEqual(r, { published: 2, refused: 1, unverified: 0 });
});

test('publish gives up after its attempts', async () => {
  const { publishWithRetry } = await import('../lib/kusd/app/flow.mjs');
  let posts = 0;
  const r = await publishWithRetry([{ kind: 'psm' }], async () => { posts++; return { results: [{ ok: false, reason: 'could not verify: lag' }] }; }, { attempts: 4, sleep: async () => {} });
  assert.equal(posts, 4);
  assert.deepEqual(r, { published: 0, refused: 0, unverified: 1 });
});
