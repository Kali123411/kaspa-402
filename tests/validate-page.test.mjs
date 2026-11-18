// Phase 3 /validate: an example to try, what a pass looks like, common failures with fixes, what happens next, and
// where the probe comes from.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s = readFileSync(new URL('../pages/validate.js', import.meta.url), 'utf8');

test('the network field is really optional and the endpoint has a one-click example', () => {
  assert.ok(/<option value="">any network<\/option>/.test(s), 'an "any network" default');
  assert.ok(s.includes("useState('')") || s.includes('useState("")'), 'network starts empty');
  assert.ok(s.includes('kaspa-402-ask.kaspadev.workers.dev/exact') && s.includes('try a listed example'), 'example button');
});

test('a pass is shown before you run, common failures carry their fixes, and the next step is explicit', () => {
  assert.ok(s.includes('What a pass looks like'));
  assert.ok(s.includes('<details') && s.includes('Common failures'), 'accordion');
  for (const f of ['200 to an unpaid request', 'PAYMENT-REQUIRED', 'does not decode', 'scheme', 'payTo', 'not reachable']) assert.ok(s.includes(f), `failure: ${f}`);
  assert.ok(s.includes('lists nothing by itself') && s.includes('href="/list"'), 'what happens after a pass');
  assert.ok(!s.includes('href="/#list"'), 'no stale anchor');
});

test('nothing charged or stored is explained, not asserted', () => {
  assert.ok(s.includes('this site&apos;s server') && s.includes('never contacts your host') && s.includes('nothing in the response is kept'));
});
