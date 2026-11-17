// What the market console does as the wallet's review sheet moves, as a pure reducer: the reservation is voided
// only when nothing can have been signed, kept (and presented) once a broadcast happened, and kept as "unknown"
// when the wallet failed after it started sending — the money may have moved.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { followSheet } from '../lib/kusd/market/flow.mjs';

const pending = (over = {}) => ({ id: 7, quote: { cents: 5 }, body: {}, txid: null, sending: false, ...over });

test('no pending flow, or a sheet that is not ours: nothing to do', () => {
  assert.deepEqual(followSheet(null, { status: 'done', txid: 'aa' }), { type: 'noop' });
  assert.deepEqual(followSheet(pending(), { status: 'building' }), { type: 'noop' });
  assert.deepEqual(followSheet(pending(), { status: 'review' }), { type: 'noop' });
});

test('closing the sheet before signing voids the reservation', () => {
  assert.deepEqual(followSheet(pending(), null), { type: 'void', reason: null });
});

test('the wallet refused to build (error before sending): void, and say so', () => {
  assert.deepEqual(followSheet(pending(), { status: 'error', error: 'not enough kUSD' }), { type: 'void', reason: 'not enough kUSD' });
});

test('once the sheet is sending, the flow remembers it', () => {
  assert.deepEqual(followSheet(pending(), { status: 'sending' }), { type: 'sending' });
});

test('an error after sending began keeps the row: the money may have moved', () => {
  const a = followSheet(pending({ sending: true }), { status: 'error', error: 'websocket closed' });
  assert.deepEqual(a, { type: 'unknown', reason: 'websocket closed' });
  // and closing that sheet afterwards does not void anything
  assert.deepEqual(followSheet(pending({ sending: true, finished: true }), null), { type: 'noop' });
});

test('a broadcast settles the reservation with the txid and presents the proof — once', () => {
  assert.deepEqual(followSheet(pending({ sending: true }), { status: 'done', txid: 'D3'.repeat(32) }), { type: 'settle', txid: 'd3'.repeat(32) });
  assert.deepEqual(followSheet(pending({ txid: 'd3'.repeat(32) }), { status: 'done', txid: 'd3'.repeat(32) }), { type: 'noop' }, 'already settled');
  assert.deepEqual(followSheet(pending({ txid: 'd3'.repeat(32) }), null), { type: 'noop' }, 'closing after a broadcast voids nothing');
});
