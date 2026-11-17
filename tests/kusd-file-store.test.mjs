// The relay's file store: one failed disk write must not stop later ones, and a corrupt file must not
// keep the service from starting.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openFileStore } from '../lib/kusd/file-store.mjs';

test('a failed write does not block later writes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kusd-fs-'));
  const path = join(dir, 'sub', 'store.json'); // parent missing: the first write fails
  const store = openFileStore(path);
  await assert.rejects(store.set('a', '1'));
  mkdirSync(join(dir, 'sub'));
  await store.set('b', '2');
  await store.flush();
  assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), { a: '1', b: '2' });
});

test('a corrupt store file is moved aside and the store starts empty', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kusd-fs-'));
  const path = join(dir, 'store.json');
  writeFileSync(path, '{"half": "writ');
  const store = openFileStore(path);
  assert.equal(await store.get('half'), null);
  assert.ok(readdirSync(dir).some((f) => f.startsWith('store.json.corrupt-')), readdirSync(dir).join(','));
  await store.set('x', '1');
  await store.flush();
  assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), { x: '1' });
});
