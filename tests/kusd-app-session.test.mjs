// The wallet session shared by /kusd/app and /kusd/market: the idle lock is what the page promises (15 minutes),
// and the app page uses the hook rather than its own copy of the logic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IDLE_LOCK_MS } from '../components/kusd/app/useWalletSession.js';

test('the open key leaves memory after 15 idle minutes, on both pages', () => {
  assert.equal(IDLE_LOCK_MS, 15 * 60 * 1000);
  for (const f of ['pages/kusd/app.js', 'pages/market.js']) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.match(src, /useWalletSession\(k\)/, `${f} uses the shared session`);
    assert.doesNotMatch(src, /IDLE_LOCK_MS|setInterval\(check/, `${f} carries no copy of the idle lock`);
  }
});
