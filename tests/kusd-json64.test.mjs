// Lossless JSON for covenant state: i64 fields beyond 2^53 (an unpostable MinerMedian box's anchor_daa is
// i64::MAX) must cross the relay, the page and the WebAssembly client digit for digit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseJson, stringifyJson } from '../lib/kusd/json64.mjs';

const MAX = '9223372036854775807';
const MIN = '-9223372036854775808';
const text = `{"anchor_daa":${MAX},"low":${MIN},"median":269,"neg":-5,"f":1.5,"e":1e3,"s":"${MAX}","q":"a\\"b ${MAX}","arr":[${MAX},2]}`;

for (const native of [true, false]) {
  const how = native ? 'native' : 'fallback';

  test(`unsafe_integers_parse_exactly_as_bigint_${how}`, () => {
    const v = parseJson(text, { native });
    assert.equal(v.anchor_daa, BigInt(MAX));
    assert.equal(v.low, BigInt(MIN));
    assert.equal(v.arr[0], BigInt(MAX));
    assert.equal(v.median, 269);
    assert.equal(v.neg, -5);
    assert.equal(v.f, 1.5);
    assert.equal(v.e, 1000);
    assert.equal(v.s, MAX, 'a string of digits stays a string');
    assert.equal(v.q, `a"b ${MAX}`);
  });

  test(`bigints_stringify_as_exact_digits_${how}`, () => {
    const out = stringifyJson({ anchor_daa: BigInt(MAX), low: BigInt(MIN), median: 269, s: MAX, nested: [{ x: BigInt(MAX) }] }, { native });
    assert.equal(out, `{"anchor_daa":${MAX},"low":${MIN},"median":269,"s":"${MAX}","nested":[{"x":${MAX}}]}`);
    assert.equal(stringifyJson(parseJson(text, { native }), { native }), text.replace('1e3', '1000'));
  });
}

test('safe_integers_stay_numbers', () => {
  const v = parseJson('{"a":9007199254740991,"b":-9007199254740991}');
  assert.equal(typeof v.a, 'number');
  assert.equal(typeof v.b, 'number');
});

// every hop that carries covenant state uses the lossless codec: the status route (server side), the app hook
// (browser: relay fetch and WebAssembly calls) and the /kusd page's status fetch
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('status_route_reads_and_writes_state_losslessly', () => {
  const s = src('pages/api/kusd/status.js');
  assert.match(s, /from '..\/..\/..\/lib\/kusd\/json64.mjs'/);
  assert.doesNotMatch(s, /r\.json\(\)/, 'a JavaScript number would round an i64 field');
  assert.doesNotMatch(s, /\.json\(\{/, 'res.json throws on a BigInt: the route must not 500');
  assert.match(s, /stringifyJson\(/);
});

test('app_hook_reads_relay_and_calls_wasm_losslessly', () => {
  const s = src('components/kusd/app/useKusd.js');
  assert.doesNotMatch(s, /r\.json\(\)/);
  assert.doesNotMatch(s, /fn\(JSON\.stringify\(req\)\)/);
  assert.match(s, /parseJson\(await r\.text\(\)\)/);
  assert.match(s, /fn\(stringifyJson\(req\)\)/);
});

test('kusd_page_says_when_the_miner_bound_is_off', () => {
  const s = src('pages/kusd.js');
  assert.match(s, /parseJson\(await r\.text\(\)\)|r\.text\(\)\)\.then\(parseJson\)|then\(\(t\) => parseJson\(t\)\)/);
  assert.match(s, /c\.miner\.state\.blocks === 0/);
  assert.match(s, /miner bound switched off/);
});
