// Smoke check of the three kUSD surfaces from a real headless browser: each page renders its headline copy,
// the market board shows live listings from the registry (a cross-origin fetch, so CORS is exercised), and no
// console error or exception is thrown. Wallet flows are covered by kusd-market-e2e.mjs.
//
//   [APP=http://localhost:3999] node scripts/kusd-pages-smoke.mjs
import { openBrowser } from './cdp.mjs';

const APP = process.env.APP || 'http://localhost:3999';
const b = await openBrowser({ width: 1200 });
const failures = [];
try {
  const pages = [
    { path: '/kusd', expect: [/kUSD/, /Kaspa Agent Market/, /research software/i] },
    { path: '/kusd/app', expect: [/kUSD/, /wallet/i] },
    { path: '/market', expect: [/Kaspa Agent Market/, /summarize/, /\/call/] },
    { path: '/kusd/market', expect: [/Kaspa Agent Market/] },          // the old path redirects
  ];
  for (const p of pages) {
    const before = b.logs.length;
    await b.goto(`${APP}${p.path}`);
    for (const re of p.expect) {
      try { await b.waitFor(`${re.source ? `(${re.toString()}).test(document.body.innerText)` : 'false'}`, 45000); }
      catch { failures.push(`${p.path}: missing ${re}`); }
    }
    const url = await b.evaluate('location.pathname');
    const errs = b.logs.slice(before).filter((l) => /^ERROR|^EXCEPTION/.test(l) && !/favicon/.test(l));
    if (errs.length) failures.push(`${p.path}: ${errs.join(' | ').slice(0, 300)}`);
    const o = await b.overflow();
    if (o.scrollWidth > o.vw + 1) failures.push(`${p.path}: horizontal overflow ${o.scrollWidth} > ${o.vw} ${o.wide.join(',')}`);
    console.log(`${p.path} -> ${url}  ${errs.length ? 'ERRORS' : 'clean'}`);
  }
} finally {
  await b.close();
}
if (failures.length) { console.log('FAIL\n' + failures.join('\n')); process.exit(1); }
console.log('OK: three pages render, listings load, no console errors');
