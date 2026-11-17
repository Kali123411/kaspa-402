// End-to-end run of /kusd/app on TN10 from real (headless) browsers: two fresh wallets, every flow,
// each transaction built, signed and broadcast by the page itself.
//
//   KUSD_FUND_BIN=<tn10_deploy with STAGE=fund> [KUSD_PAUSE_HEARTBEAT=1] [APP=http://127.0.0.1:3999] \
//     node scripts/kusd-app-e2e.mjs [out.json]
//
// Funding pays each new wallet from the deploy wallet (STAGE=fund); with KUSD_PAUSE_HEARTBEAT=1 the
// oracle heartbeat timer is paused for those payments and always restarted.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { openBrowser } from './cdp.mjs';

const APP = process.env.APP || 'http://127.0.0.1:3999';
const FUND_BIN = process.env.KUSD_FUND_BIN;
if (!FUND_BIN) throw new Error('set KUSD_FUND_BIN to a tn10_deploy binary with STAGE=fund');
const log = [];
const note = (step, detail) => { log.push({ step, ...detail }); console.log(step, JSON.stringify(detail)); };

function fund(address, sompi) {
  const pause = process.env.KUSD_PAUSE_HEARTBEAT === '1';
  if (pause) execFileSync('systemctl', ['--user', 'stop', 'kusd-oracle-heartbeat.timer']);
  try {
    const out = execFileSync(FUND_BIN, [], { env: { ...process.env, STAGE: 'fund', TO: address, AMOUNT: String(sompi) }, encoding: 'utf8' });
    const txid = out.match(/FUND: ACCEPTED ([0-9a-f]{64})/)?.[1];
    if (!txid) throw new Error('funding not accepted');
    return txid;
  } finally {
    if (pause) execFileSync('systemctl', ['--user', 'start', 'kusd-oracle-heartbeat.timer']);
  }
}

const tab = (b, name) => b.evaluate(`[...document.querySelectorAll('nav button')].find(x => x.textContent.trim() === ${JSON.stringify(name)}).click()`);

async function newWallet(b, passphrase) {
  await b.goto(`${APP}/kusd/app`);
  await b.waitFor(`document.body.innerText.includes('Protocol state verified')`, 120000);
  await b.type('passphrase (8+ characters)', passphrase);
  await b.type('passphrase again', passphrase);
  await b.click('Create wallet');
  await b.waitFor(`/kaspatest:[a-z0-9]{60,}/.test(document.body.innerText)`, 30000);
  return (await b.text()).match(/kaspatest:[a-z0-9]{60,}/)[0];
}

/** Open a review (via `begin`), sign and broadcast it, and return the txid the page reports. */
async function act(b, name, begin) {
  await begin();
  await b.waitFor(`(() => { const d = document.querySelector('[role=dialog]'); return d && /Sign & broadcast|Cancel|Done/.test(d.innerText) && !d.innerText.includes('Verifying state'); })()`, 90000);
  const review = await b.evaluate(`document.querySelector('[role=dialog]').innerText`);
  if (!review.includes('Sign & broadcast')) throw new Error(`${name}: no review — ${review.replace(/\n+/g, ' | ')}`);
  let rebuilt = false;
  let done;
  for (let tap = 0; ; tap++) {
    await b.click('Sign & broadcast');
    await b.waitFor(`(() => { const d = document.querySelector('[role=dialog]'); return d && /Accepted by the node|Sign & broadcast|Cancel/.test(d.innerText) && !d.innerText.includes('Broadcasting'); })()`, 120000);
    done = await b.evaluate(`document.querySelector('[role=dialog]').innerText`);
    // a shared box moved: the page shows the rebuilt transaction for a second tap
    if (done.includes('was rebuilt') && done.includes('Sign & broadcast') && tap < 2) { rebuilt = true; continue; }
    break;
  }
  const txid = done.match(/[0-9a-f]{64}/)?.[0];
  if (!done.includes('Accepted by the node') || !txid) throw new Error(`${name}: ${done.replace(/\n+/g, ' | ')}`);
  note(name, { txid, rebuilt });
  await b.click('Done');
  return txid;
}

const a = await openBrowser({ width: 390 });
const bb = await openBrowser({ width: 375 });
try {
  const addrA = await newWallet(a, 'wallet A passphrase');
  const addrB = await newWallet(bb, 'wallet B passphrase');
  note('wallets', { A: addrA, B: addrB });
  note('fund A', { txid: fund(addrA, 700 * 1e8) });
  // the next payment must not pick the deploy-wallet coin the first one is still spending
  await a.waitFor(`document.body.innerText.includes('700 KAS')`, 120000);
  note('fund B', { txid: fund(addrB, 50 * 1e8) });
  await bb.waitFor(`document.body.innerText.includes('50 KAS')`, 120000);

  await tab(a, 'Swap');
  await act(a, 'A buys $4.00', async () => { await a.type('kUSD to buy, e.g. 5.00', '4.00'); await a.submit('kUSD to buy, e.g. 5.00'); });
  await tab(a, 'Vault');
  await act(a, 'A opens a 300 KAS vault', async () => { await a.type('KAS to lock, at least 2', '300'); await a.submit('KAS to lock, at least 2'); });
  await a.waitFor(`document.body.innerText.includes('Vault · 300 KAS')`, 60000);
  await act(a, 'A borrows $3.00', async () => { await a.type('kUSD to borrow', '3.00'); await a.submit('kUSD to borrow'); });
  await act(a, 'A adds 50 KAS', async () => { await a.type('KAS to add', '50'); await a.submit('KAS to add'); });
  await a.waitFor(`document.body.innerText.includes('Vault · 350 KAS')`, 60000);
  await act(a, 'A withdraws 50 KAS', async () => { await a.type('KAS to withdraw', '50'); await a.submit('KAS to withdraw'); });
  await a.waitFor(`document.body.innerText.includes('Vault · 300 KAS')`, 60000);

  await tab(a, 'Wallet');
  await a.waitFor(`document.body.innerText.includes('7.00 kUSD')`, 60000);
  await act(a, 'A sends $1.00 to B', async () => { await a.type('kaspatest: address, or me', addrB); await a.type('kUSD to send', '1.00'); await a.submit('kUSD to send'); });
  await a.waitFor(`document.body.innerText.includes('6.00 kUSD')`, 60000);
  await act(a, 'A splits off a $2.00 box', async () => { await a.type('kaspatest: address, or me', 'me'); await a.type('kUSD to send', '2.00'); await a.submit('kUSD to send'); });
  // the send spent only the $4 box ($3 change), so A now holds $3 + $2 + $1
  await a.waitFor(`document.body.innerText.includes('3 boxes')`, 60000);

  await tab(a, 'Swap');
  await act(a, 'A redeems a $3.00 box', () => a.clickInRow('3.00 kUSD', 'Redeem'));
  await tab(a, 'Vault');
  await a.waitFor(`document.body.innerText.includes('2.00 kUSD')`, 60000);
  await act(a, 'A repays $2.00 (partial)', () => a.clickInRow('2.00 kUSD', 'Repay'));
  await a.waitFor(`/Debt\\s*1\\.00 kUSD/.test(document.body.innerText)`, 60000);

  await bb.waitFor(`document.body.innerText.includes('1.00 kUSD')`, 90000);
  await act(bb, 'B sends $1.00 back to A', async () => { await bb.type('kaspatest: address, or me', addrA); await bb.type('kUSD to send', '1.00'); await bb.submit('kUSD to send'); });

  await a.waitFor(`document.body.innerText.includes('repays all')`, 90000);
  await act(a, 'A repays the last $1.00 and releases the collateral', () => a.clickInRow('repays all', 'Repay'));
  await a.waitFor(`document.body.innerText.includes('Close vault')`, 60000);
  await act(a, 'A closes the vault', () => a.click('Close vault'));

  await tab(a, 'Activity');
  await a.sleep(500);
  const activity = await a.evaluate(`[...document.querySelectorAll('li')].map(l => l.innerText.replace(/\\n+/g, ' | '))`);
  note('A activity', { entries: activity.length });
  const overflow = {};
  for (const t of ['Wallet', 'Swap', 'Vault', 'Activity']) {
    await tab(a, t);
    for (const w of [320, 375, 390]) { await a.setWidth(w); await a.sleep(300); overflow[`${t}-${w}`] = (await a.overflow()).wide.length; }
  }
  note('overflow (elements past the edge)', overflow);
  const relay = await (await fetch('https://kusd.kaspa-402.org/state')).json();
  note('relay protocol', Object.fromEntries(Object.entries(relay.protocol).map(([k, e]) => [k, e.outpoint.transactionId.slice(0, 8)])));
} catch (e) {
  note('FAILED', { error: e.message, A: (await a.text().catch(() => '')).slice(0, 600) });
  process.exitCode = 1;
} finally {
  if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(log, null, 2));
  a.close();
  bb.close();
}
