// Minimal Chrome DevTools driver for scripted page checks (scripts/kusd-app-e2e.mjs).
// CHROME = a chrome-headless-shell binary (default: the Playwright cache).
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const H = process.env.CHROME || process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
export async function openBrowser({ port = 9400 + Math.floor(Math.random() * 500), width = 390 } = {}) {
  // CHROME_ARGS: extra flags, e.g. --disable-features=LocalNetworkAccessChecks when the page under test talks to a LAN service
  const extra = (process.env.CHROME_ARGS || '').split(/\s+/).filter(Boolean);
  const profile = mkdtempSync(join(tmpdir(), 'kusd-e2e-'));   // removed on close: a run may seal a real key into the page's storage
  const p = spawn(H, ['--no-sandbox', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, ...extra, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env } });
  await new Promise((res) => p.stderr.on('data', (d) => { if (/ws:\/\//.test(String(d))) res(); }));
  let tgt;
  for (let i = 0; ; i++) {
    try { tgt = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (tgt.some((t) => t.type === 'page')) break; } catch (e) { if (i > 40) throw e; }
    await new Promise((r) => setTimeout(r, 250));
  }
  const ws = new WebSocket(tgt.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pend = {}; const logs = [];
  ws.onmessage = (m) => {
    const j = JSON.parse(m.data);
    if (j.id && pend[j.id]) { pend[j.id](j.result ?? j); delete pend[j.id]; }
    if (j.method === 'Runtime.consoleAPICalled') logs.push((j.params.type === 'error' ? 'ERROR ' : '') + j.params.args.map((a) => a.value ?? a.description).join(' '));
    if (j.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION ' + (j.params.exceptionDetails.exception?.description || j.params.exceptionDetails.text));
  };
  const send = (method, params = {}) => new Promise((r) => { pend[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
  const width_ = async (w) => send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 2, mobile: true });
  await width_(width);
  await send('Page.enable'); await send('Runtime.enable');
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (expression, timeoutMs = 30000) => {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) { if (await evaluate(expression).catch(() => false)) return true; await sleep(250); }
    throw new Error(`timed out waiting for ${expression}`);
  };
  // set a React-controlled input by placeholder, then click a button by its text
  const type = async (placeholder, value) => { await waitFor(`[...document.querySelectorAll('input')].some(i => i.placeholder === ${JSON.stringify(placeholder)})`, 60000); return typeInto(placeholder, value); };
  const typeInto = (placeholder, value) => evaluate(`(() => { const el = [...document.querySelectorAll('input')].find(i => i.placeholder === ${JSON.stringify(placeholder)}); if (!el) throw new Error('no input ' + ${JSON.stringify(placeholder)}); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  const click = async (text) => { const end = Date.now() + 60000; for (;;) { try { return await clickOnce(text); } catch (e) { if (Date.now() > end) throw e; await sleep(500); } } };
  const clickOnce = (text) => evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim().includes(${JSON.stringify(text)}) && !b.disabled); if (!b) throw new Error('no enabled button ' + ${JSON.stringify(text)}); b.click(); return true; })()`);
  const text = () => evaluate('document.body.innerText');
  // submit the form that holds the input with this placeholder
  const submit = (placeholder) => evaluate(`(() => { const el = [...document.querySelectorAll('input')].find(i => i.placeholder === ${JSON.stringify(placeholder)}); if (!el) throw new Error('no input ' + ${JSON.stringify(placeholder)}); el.form.requestSubmit(); return true; })()`);
  // click the button labelled `label` inside the smallest row whose text includes `rowText`
  const clickInRow = async (rowText, label) => { const end = Date.now() + 60000; for (;;) { try { return await clickInRowOnce(rowText, label); } catch (e) { if (Date.now() > end) throw e; await sleep(1000); } } };
  const clickInRowOnce = (rowText, label) => evaluate(`(() => { const rows = [...document.querySelectorAll('div')].filter(d => d.innerText.includes(${JSON.stringify(rowText)}) && [...d.querySelectorAll('button')].some(b => b.textContent.trim() === ${JSON.stringify(label)} && !b.disabled)); rows.sort((a, b) => a.innerText.length - b.innerText.length); const b = rows[0] && [...rows[0].querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)} && !b.disabled); if (!b) throw new Error('no ' + ${JSON.stringify(label)} + ' in a row with ' + ${JSON.stringify(rowText)}); b.click(); return true; })()`);
  const overflow = () => evaluate(`(() => { const vw = document.documentElement.clientWidth; return { vw, scrollWidth: document.documentElement.scrollWidth, wide: [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.right > vw + 1 && r.width > 0; }).slice(0, 8).map(e => e.tagName + '.' + String(e.className).slice(0, 60)) }; })()`);
  // resolves once the browser has exited and its profile is gone (callers that care about the profile await it)
  const close = () => new Promise((res) => {
    ws.close();
    p.once('exit', () => {
      for (let i = 0; i < 20; i++) { try { rmSync(profile, { recursive: true, force: true }); break; } catch { /* chrome still flushing */ } }
      res();
    });
    p.kill();
  });
  return { send, evaluate, waitFor, type, click, text, submit, clickInRow, overflow, setWidth: width_, sleep, close, logs,
    goto: async (url) => { await send('Page.navigate', { url }); await sleep(1500); } };
}
