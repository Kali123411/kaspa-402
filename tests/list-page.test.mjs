// Phase 2 P1-7: the "List your service" form lives on its own page; the landing keeps a short pointer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the form moved to /list and the landing points at it', () => {
  const idx = read('pages/index.js');
  assert.ok(!idx.includes('function SubmitForm') && !idx.includes('<SubmitForm'), 'no form on the landing page');
  assert.ok(idx.includes('href="/list"'), 'the landing links to /list');
  assert.ok(!idx.includes('href="#list"'), 'no dangling #list anchors');
  const page = read('pages/list.js');
  assert.ok(page.includes('<SubmitForm') && page.includes('<title>List your service — k402</title>'));
  const form = read('components/SubmitForm.jsx');
  assert.ok(form.includes("'/api/registry/submit'") && form.includes('<Term id="x402-v2"'), 'the form kept its probe copy and tooltips');
});
