// End-to-end run of /kusd/market on TN10 from a real (headless) browser: a funded wallet key is sealed into the
// page's keystore, then the page itself quotes, is refused over budget, pays one real call, sees it in the
// settlements feed, and is refused while frozen.
//
//   KUSD_KEY_FILE=~/.kusd-market/agent.key [APP=http://127.0.0.1:3999] [SHOTS=dir] node scripts/kusd-market-e2e.mjs [out.json]
//
// The key file is read here and sealed with a throwaway passphrase; it is never printed.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { openBrowser } from './cdp.mjs';
import { sealSecret } from '../lib/kusd/app/keystore.mjs';

const APP = process.env.APP || 'http://127.0.0.1:3999';
const KEY_FILE = process.env.KUSD_KEY_FILE;
if (!KEY_FILE) throw new Error('set KUSD_KEY_FILE to the agent wallet key (64 hex)');
const secret = readFileSync(KEY_FILE.replace(/^~/, process.env.HOME), 'utf8').trim().toLowerCase();
if (!/^[0-9a-f]{64}$/.test(secret)) throw new Error('the key file is not 64 hex characters');
const PASS = `e2e-${crypto.randomUUID()}`;   // throwaway: the sealed blob dies with the browser profile
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const log = [];
const note = (step, detail) => { log.push({ step, ...detail }); console.log(step, JSON.stringify(detail)); };

const b = await openBrowser({ width: 1200 });
const shot = async (name) => { if (!SHOTS) return; const r = await b.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${SHOTS}/${name}.png`, Buffer.from(r.data, 'base64')); };
const body = () => b.text();
const has = (re) => `${re}.test(document.body.innerText)`;

async function setup(policy) {
  const blob = await sealSecret(secret, PASS);
  await b.goto(`${APP}/market`);
  await b.evaluate(`localStorage.setItem('kusd.wallet.v1', ${JSON.stringify(JSON.stringify(blob))}); localStorage.setItem('kusd.market.policy.v1', ${JSON.stringify(JSON.stringify(policy))}); true`);
  await b.goto(`${APP}/market`);
  await b.waitFor(`document.body.innerText.includes('Protocol state verified')`, 120000);
  await b.type('passphrase', PASS);
  await b.click('Unlock');
  await b.waitFor(has(/wallet [0-9a-f]{8}…/), 30000);
}
const pick = async () => {
  await b.waitFor(`[...document.querySelectorAll('button')].some(x => x.textContent.includes('summarize') && x.textContent.includes('/call'))`, 60000);
  await b.evaluate(`[...document.querySelectorAll('button')].find(x => x.textContent.includes('summarize') && x.textContent.includes('/call')).click(); true`);
};
async function quoteAndPay() {
  await b.click('Quote');
  await b.waitFor(`document.body.innerText.includes('recomputed here')`, 60000);
  await b.waitFor(`[...document.querySelectorAll('button')].some(x => /^Pay \\d/.test(x.textContent.trim()) && !x.disabled)`, 60000);
  await b.evaluate(`[...document.querySelectorAll('button')].find(x => /^Pay \\d/.test(x.textContent.trim()) && !x.disabled).click(); true`);
}
const refusal = async (code) => {
  await b.waitFor(has(new RegExp(`refused · ${code}`, 'i')), 30000);
  const dialog = await b.evaluate(`Boolean(document.querySelector('[role=dialog]'))`);
  if (dialog) throw new Error(`refused ${code} but a review sheet opened`);
  const reason = (await body()).match(new RegExp(`refused · ${code}\\s*\\n([^\\n]+)`, 'i'))?.[1];
  note(`refused ${code}`, { reason, sheet: false });
};

try {
  // 1. over budget: a 1¢ lifetime policy refuses the 5¢ quote before any box is built
  await setup({ maxTotalCents: 1 });
  await pick();
  await quoteAndPay();
  await refusal('total');
  await shot('1-refused-total');

  // 2. a sane policy — first the kill switch (while the wallet can still afford the call), then the payment
  await setup({ maxPerCallCents: 10, maxTotalCents: 50, maxWindowCalls: 5, maxWindowFailures: 1, allowCapabilities: ['summarize'] });
  await b.click('Freeze (kill switch)');
  await b.waitFor(`document.body.innerText.includes('Every payment is refused')`, 10000);
  await pick();
  await quoteAndPay();
  await refusal('frozen');
  await shot('2-refused-frozen');
  await b.click('Unfreeze');
  await b.waitFor(`document.body.innerText.includes('Freezing refuses every payment')`, 10000);

  // 3. one real payment from the browser wallet
  await quoteAndPay();
  await b.waitFor(`(() => { const d = document.querySelector('[role=dialog]'); return d && /Sign & broadcast|Cancel/.test(d.innerText) && !d.innerText.includes('Verifying state'); })()`, 120000);
  const review = await b.evaluate(`document.querySelector('[role=dialog]').innerText`);
  if (!review.includes('Sign & broadcast')) throw new Error(`no review — ${review.replace(/\n+/g, ' | ')}`);
  note('review', { text: review.replace(/\n+/g, ' | ').slice(0, 400) });
  await shot('2-review');
  await b.click('Sign & broadcast');
  await b.waitFor(`(() => { const d = document.querySelector('[role=dialog]'); return d && /Accepted by the node|Sign & broadcast|Cancel/.test(d.innerText) && !d.innerText.includes('Broadcasting'); })()`, 120000);
  const done = await b.evaluate(`document.querySelector('[role=dialog]').innerText`);
  const txid = done.match(/[0-9a-f]{64}/)?.[0];
  if (!done.includes('Accepted by the node') || !txid) throw new Error(`broadcast: ${done.replace(/\n+/g, ' | ')}`);
  note('paid', { txid });
  await b.click('Done');
  await b.waitFor(has(/^(served|paid, not served)$/im), 180000);   // the result panel's own label, not the "unserved in window" meter
  const result = (await body()).match(/^(SERVED|PAID, NOT SERVED)$[\s\S]{0,700}?^box\s*\n?[^\n]*/im)?.[0];
  note('result', { text: (result || '').replace(/\n+/g, ' | ').slice(0, 500) });
  await shot('3-served');
  // the provider reports the box; the registry verifies it; the feed shows it
  await b.waitFor(`document.body.innerText.includes(${JSON.stringify(txid.slice(0, 12))})`, 240000);
  note('in the settlements feed', { txid: txid.slice(0, 12) });
  await shot('4-feed');

  const ledger = await b.evaluate(`(() => { const k = Object.keys(localStorage).find(k => k.startsWith('kusd.market.spend.v1:')); return k ? JSON.parse(localStorage.getItem(k)) : null; })()`);
  note('ledger', { rows: ledger?.rows?.map((r) => ({ cents: r.cents, state: r.state, http: r.http, txid: r.txid.slice(0, 12) })), frozen: ledger?.frozen });
  // any console.error (hydration mismatches land here) or uncaught exception fails the run
  const errors = b.logs.filter((l) => l.startsWith('EXCEPTION') || l.startsWith('ERROR'));
  note('console errors', { count: errors.length, first: errors[0]?.slice(0, 300) });
  if (errors.length) throw new Error(`${errors.length} console error(s): ${errors[0].slice(0, 200)}`);
} catch (e) {
  note('FAILED', { error: e.message, page: (await body().catch(() => '')).slice(0, 4000), exceptions: b.logs.filter((l) => l.startsWith('EXCEPTION')).slice(0, 5) });
  await shot('failed').catch(() => {});
  process.exitCode = 1;
} finally {
  if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(log, null, 2));
  await b.close();   // the profile held the sealed key: gone before the script ends
}
