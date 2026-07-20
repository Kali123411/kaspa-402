// pages/marketplace.js — the k402 service exchange: an open marketplace of agent-payable services,
// settled trustlessly over Kaspa payment channels. Live listings from the registry (via /api/exchange);
// providers onboard with the interactive builder (their key signs locally, never in the browser).
import Head from 'next/head';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MCP_URL, REGISTRY_POST, fmt, capInfo, CAT_ORDER, categoryOf } from '../lib/catalog';
import RoutingCast from '../components/RoutingCast';

function mapProvider(p) {
  const meta = p.meta || {};
  const rep = p.reputation || {};
  return {
    cap: p.capability,
    who: meta.provider || 'provider ' + String(p.payee_pubkey).slice(0, 6),
    model: meta.model || '',
    region: meta.region || p.network || '',
    price: p.price_usd,
    kas: rep.settled_kas || 0,
    closes: rep.closes || 0,
    schemes: p.schemes || [],
    stake: p.stake_kas || 0,
    payee: String(p.payee_pubkey || '').slice(0, 8),
    payeeFull: p.payee_pubkey,
    endpoint: p.endpoint || '',
    channelTerms: p.channel_terms || {},
    description: p.description || '',
  };
}
// the provider's own blurb if they wrote one, else the built-in capability description
const blurb = (p) => p.description || capInfo(p.cap).what;

function ReputationMeter({ p, maxKas }) {
  if (p.closes === 0) {
    return (
      <div className="inline-flex items-center gap-1.5 self-start rounded-full border border-neon-pink/40 bg-neon-pink/10 px-2.5 py-0.5 font-mono text-[11px] text-neon-pink">
        ◔ new · awaiting first settlement
      </div>
    );
  }
  const w = Math.max(4, Math.round((p.kas / maxKas) * 100));
  return (
    <div className="mt-0.5 flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[15px] text-teal-400 neon-text">
          <span className="mr-1.5 text-[10px] uppercase tracking-wider text-gray-500 [text-shadow:none]">settled</span>
          {fmt(p.kas)} KAS
        </span>
        <span className="font-mono text-xs text-gray-400 tabular-nums">{p.closes} settlements</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded border border-gray-700 bg-gray-950/70">
        <div className="h-full rounded bg-gradient-to-r from-neon-purple to-teal-400 shadow-glow-cyan" style={{ width: w + '%' }} />
      </div>
    </div>
  );
}

function ProviderCard({ p, maxKas, onUse, dead, deadDetail }) {
  return (
    <article title={dead ? `unreachable — ${deadDetail || 'no k402 response'}` : undefined}
      className={`glass card-hover flex flex-col gap-3 rounded-2xl border p-5 ${dead ? 'border-rose-400/20 opacity-60' : 'border-teal-400/15'}`}>
      <div className="flex items-baseline justify-between gap-2.5">
        <a href={`/skill/${encodeURIComponent(p.cap)}`}
          className="font-mono text-[16px] text-gray-100 underline-offset-4 transition hover:text-teal-300 hover:underline"
          title="Open the service manifest (SKILL.md)">{p.cap}</a>
        <span className="whitespace-nowrap font-mono text-[15px] text-teal-400 tabular-nums">
          ${p.price}
          <small className="text-[11px] text-gray-500">/call</small>
        </span>
      </div>
      <div className="-mt-1 text-[13px] text-gray-400">
        {p.who}
        <span className="mx-1.5 text-gray-600">·</span>
        {p.model || 'model'}
        <span className="mx-1.5 text-gray-600">·</span>
        {p.region}
      </div>
      <p className="text-[13px] leading-snug text-gray-300">{blurb(p)}</p>
      <ReputationMeter p={p} maxKas={maxKas} />
      <div className="mt-auto flex items-center justify-between gap-2.5 border-t border-gray-700/60 pt-3">
        <div className="flex flex-wrap gap-1.5">
          {dead ? (
            <span className="rounded-md border border-rose-400/40 bg-rose-400/5 px-2 py-0.5 font-mono text-[11px] text-rose-300">unreachable</span>
          ) : null}
          {p.schemes.map((s) => (
            <span key={s} className="rounded-md border border-gray-700 bg-gray-950/50 px-2 py-0.5 font-mono text-[11px] text-gray-400">{s}</span>
          ))}
          {p.stake ? (
            <span className="rounded-md border border-kaspa/35 bg-gray-950/50 px-2 py-0.5 font-mono text-[11px] text-kaspa">staked {p.stake} KAS</span>
          ) : null}
        </div>
        {onUse ? (
          <button onClick={() => onUse(p)}
            className="shrink-0 rounded-lg border border-teal-400/40 bg-teal-400/5 px-3.5 py-1.5 font-mono text-[12.5px] font-semibold text-teal-400 transition hover:bg-teal-400/15 hover:shadow-glow-cyan">
            Use →
          </button>
        ) : null}
      </div>
      <div className="font-mono text-[11.5px] text-gray-600">payee {p.payee}…</div>
    </article>
  );
}

const FIELD = 'w-full rounded-lg border border-gray-700 bg-gray-900/80 px-3 py-2 font-mono text-[13px] text-gray-100 outline-none transition focus:border-teal-400 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.1)]';
const LABEL = 'font-mono text-[10.5px] uppercase tracking-wider text-gray-500';

function CopyBtn({ text }) {
  const [c, setC] = useState(false);
  return (
    <button onClick={() => navigator.clipboard.writeText(text).then(() => { setC(true); setTimeout(() => setC(false), 1400); })}
      className="rounded border border-teal-400/35 px-2.5 py-1 font-mono text-[11px] text-teal-400 hover:bg-teal-400/10">{c ? 'copied ✓' : 'copy'}</button>
  );
}

function Method({ n, title, tag, body, code }) {
  return (
    <div className="rounded-xl border border-teal-400/15 bg-gray-950/50 p-4">
      <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
        <span className="rounded bg-teal-400 px-1.5 font-orbitron text-xs font-bold text-gray-950">{n}</span>
        <span className="font-orbitron text-[13px] font-bold uppercase tracking-wide text-gray-100">{title}</span>
        {tag ? <span className="rounded-full border border-teal-400/30 px-2 py-px font-mono text-[10px] uppercase tracking-widest text-teal-400">{tag}</span> : null}
      </div>
      <p className="mb-2.5 text-[13px] text-gray-400">{body}</p>
      <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-950">
        <div className="flex justify-end border-b border-gray-800 px-2 py-1.5"><CopyBtn text={code} /></div>
        <pre className="overflow-x-auto px-3.5 py-3 font-mono text-[11.5px] leading-relaxed text-gray-200">{code}</pre>
      </div>
    </div>
  );
}

// The "how do I actually use this?" panel: three concrete ways to call a specific listed service,
// pre-filled with its endpoint / payee / price. Opened by the "Use →" button on each card.
function UseModal({ p, onClose }) {
  let base = 'https://x402-compute.68cxgfyr0.workers.dev';
  try { base = new URL(p.endpoint).origin; } catch (e) { /* keep default */ }
  const mcpCode = `claude mcp add --transport http k402 ${MCP_URL}\n# then tell your agent:  use the k402 "${p.cap}" service to ...`;
  const sessionCode = `# 1) open a prepaid session (once) — returns a Kaspa deposit address\ncurl -X POST ${base}/onboard/request\n\n# 2) fund that address with KAS, then call the service (metered per token):\ncurl -X POST ${p.endpoint || base + '/<endpoint>'} \\\n  -H "X-Session: <your-session>" -H "content-type: application/json" \\\n  -d '{ ...request... }'`;
  const channelCode = `pip install k402\nfrom k402 import ChannelPayer, SubprocessChannelOpener, NodeBackend\n\npayer = ChannelPayer(payer_privkey=KEY, opener=SubprocessChannelOpener(bin, cwd),\n                     backend=NodeBackend("ws://your-node:17110"),\n                     registry_url="${base}")\nproviders = await payer.discover("${p.cap}")   # find this + similar providers\nr = await payer.pay(providers[0], "", {...})   # opens a channel to the payee, pays per call`;
  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8">
      <div onClick={(e) => e.stopPropagation()} className="glass my-4 w-full max-w-2xl rounded-2xl border border-teal-400/25 p-6 shadow-glow-cyan">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[17px] text-gray-100">{p.cap}</div>
            <div className="mt-1 text-[13px] text-gray-400">{p.who} · <span className="text-teal-400">${p.price}/call</span> · <a href={`/skill/${encodeURIComponent(p.cap)}`} className="text-gray-400 underline underline-offset-2 hover:text-teal-400">manifest</a></div>
          </div>
          <button onClick={onClose} aria-label="Close" className="font-mono text-lg leading-none text-gray-500 hover:text-teal-400">✕</button>
        </div>
        <div className="mb-4 mt-4 rounded-xl border border-gray-800 bg-gray-950/50 p-4">
          <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wider text-gray-500">What this does</div>
          <p className="text-[13.5px] text-gray-300">{blurb(p)}</p>
          {capInfo(p.cap).send ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div><div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-teal-400">you send</div>
                <pre className="overflow-x-auto rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 font-mono text-[11px] leading-relaxed text-gray-300">{capInfo(p.cap).send}</pre></div>
              <div><div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-teal-400">you get</div>
                <pre className="overflow-x-auto rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 font-mono text-[11px] leading-relaxed text-gray-300">{capInfo(p.cap).get}</pre></div>
            </div>
          ) : null}
        </div>
        <p className="mb-4 text-[13.5px] text-gray-400">Paid <b className="text-gray-200">per call in KAS</b> — no account, no API key. Fund once and meter against it, or open a trustless channel. Pick a way:</p>
        <div className="flex flex-col gap-3">
          <Method n="1" title="Ask an agent" tag="easiest" body="Add the hosted MCP server; your agent discovers this service and pays for it itself — no code." code={mcpCode} />
          <Method n="2" title="Prepaid session" tag="simplest in code" body="Open a session, fund it once with KAS, then call the endpoint with an X-Session header. Metered per token." code={sessionCode} />
          <Method n="3" title="Payment channel" tag="trustless · high volume" body="Open a covenant channel straight to this provider and pay per call with signed vouchers — no custodian." code={channelCode} />
        </div>
        <p className="mt-5 text-[12px] text-gray-500">New to this? <button onClick={() => { onClose(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-teal-400 hover:underline">Try a call free at the top</button> — no wallet — or read the <a href="https://github.com/Kali123411/k402/blob/main/PROVIDERS.md" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline">full guide</a>.</p>
      </div>
    </div>
  );
}

function ListingBuilder() {
  const [f, setF] = useState({
    cap: 'summarize', ep: 'https://your-host/summarize', price: '0.002',
    model: 'qwen2.5:7b', region: 'eu-west', name: 'my-node', pub: '',
    desc: 'Fast 7B summariser — send text or a URL, get a short summary back.',
  });
  const [schemes, setSchemes] = useState({ 'kaspa-channel': true, 'kaspa-utxo': true, 'kaspa-session': false });
  const [copied, setCopied] = useState(false);
  const upd = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const active = Object.keys(schemes).filter((s) => schemes[s]);

  const preview = {
    cap: f.cap, who: f.name, model: f.model, region: f.region,
    price: parseFloat(f.price) || 0, kas: 0, closes: 0,
    schemes: active, stake: 0, payee: (f.pub || 'yourpubkey').slice(0, 8),
    description: f.desc,
  };
  const code = `# pip install k402
from k402 import Listing
import httpx

listing = Listing(
  capability="${f.cap}",
  endpoint="${f.ep}",
  payee_pubkey="${f.pub || 'YOUR_PAYEE_PUBKEY'}",
  price_usd=${parseFloat(f.price) || 0},
  schemes=[${active.map((s) => `"${s}"`).join(', ')}],
${f.desc ? `  description="${f.desc.replace(/"/g, '\\"')}",\n` : ''}  meta={"model": "${f.model}", "region": "${f.region}"},
).sign(YOUR_PAYEE_KEY)   # signs locally; key never leaves your machine

httpx.post("${REGISTRY_POST}", json=listing.to_dict())`;

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };

  return (
    <div className="grid items-start gap-4 md:grid-cols-2">
      <div className="glass rounded-2xl border border-teal-400/15 p-5">
        <h3 className="mb-1 font-orbitron text-sm font-bold uppercase tracking-wider">Service details</h3>
        <p className="mb-4 text-[12.5px] text-gray-400">Everything here is public listing data. The preview updates as you type.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 flex flex-col gap-1.5"><label className={LABEL}>Capability</label>
            <input className={FIELD} value={f.cap} onChange={upd('cap')} list="caps" />
            <datalist id="caps">{['summarize','llm:reason','llm:code','zk-prove','embed','extract','classify','covenant:compile','chain:balance','read'].map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div className="col-span-2 flex flex-col gap-1.5"><label className={LABEL}>Endpoint URL</label><input className={FIELD} value={f.ep} onChange={upd('ep')} /></div>
          <div className="flex flex-col gap-1.5"><label className={LABEL}>Price (USD / call)</label><input className={FIELD} type="number" step="0.0001" value={f.price} onChange={upd('price')} /></div>
          <div className="flex flex-col gap-1.5"><label className={LABEL}>Model / label</label><input className={FIELD} value={f.model} onChange={upd('model')} /></div>
          <div className="flex flex-col gap-1.5"><label className={LABEL}>Region</label><input className={FIELD} value={f.region} onChange={upd('region')} /></div>
          <div className="flex flex-col gap-1.5"><label className={LABEL}>Provider name</label><input className={FIELD} value={f.name} onChange={upd('name')} /></div>
          <div className="col-span-2 flex flex-col gap-1.5"><label className={LABEL}>Description — what you offer</label>
            <textarea className={FIELD + ' resize-y'} rows={2} value={f.desc} onChange={upd('desc')} placeholder="One or two lines: what the service does, what you send and get back." /></div>
          <div className="col-span-2 flex flex-col gap-1.5"><label className={LABEL}>Payee pubkey (x-only hex)</label>
            <input className={FIELD} value={f.pub} onChange={upd('pub')} placeholder="derive: k402.payer_pubkey_from_privkey(key)" /></div>
          <div className="col-span-2 flex flex-col gap-1.5"><label className={LABEL}>Schemes accepted</label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(schemes).map((s) => (
                <button key={s} type="button" onClick={() => setSchemes({ ...schemes, [s]: !schemes[s] })}
                  className={`rounded-lg border px-3 py-2 font-mono text-xs transition ${schemes[s] ? 'border-teal-400/40 bg-teal-400/10 text-teal-400 shadow-glow-cyan' : 'border-gray-700 text-gray-400'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="sticky top-24 flex flex-col gap-3">
        <p className={LABEL}>Live preview — how agents will see you</p>
        <ProviderCard p={preview} maxKas={1} />
        <p className={LABEL}>Generated command — run locally</p>
        <div className="overflow-hidden rounded-2xl border border-teal-400/15 bg-gray-950/70">
          <div className="flex items-center justify-between border-b border-gray-700 px-3.5 py-2.5">
            <span className="font-mono text-[11px] text-gray-400">python · your machine</span>
            <button onClick={copy} className="rounded border border-teal-400/35 px-2.5 py-1 font-mono text-[11.5px] text-teal-400 hover:bg-teal-400/10">{copied ? 'copied ✓' : 'copy'}</button>
          </div>
          <pre className="overflow-x-auto px-3.5 py-3.5 font-mono text-[12px] leading-relaxed text-gray-200">{code}</pre>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-teal-400/15 bg-gray-900/60 px-3.5 py-3 text-[12.5px] text-gray-400">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-teal-400"><rect x="3" y="7" width="10" height="6.5" rx="1.5" /><path d="M5 7V5a3 3 0 0 1 6 0v2" /></svg>
          Your private key never leaves your machine — the listing is signed locally and only the signature is published.
        </div>
      </div>
    </div>
  );
}

function TrialWidget() {
  const [prompt, setPrompt] = useState('What consensus protocol does Kaspa use, and why does it matter?');
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [session, setSession] = useState(null);

  async function run() {
    setBusy(true); setErr(''); setOut('');
    try {
      let s = session;
      if (!s) {
        const o = await (await fetch('/api/trial/open', { method: 'POST' })).json();
        if (!o.session) throw new Error(o.error || 'could not start a free trial');
        s = o.session; setSession(s);
      }
      const r = await (await fetch('/api/trial/call', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ session: s, prompt }),
      })).json();
      if (r.text) setOut(r.text);
      else { setErr(r.error || 'call failed'); if (r.trialExhausted) setSession(null); }
    } catch (e) { setErr(String(e.message || e)); }
    setBusy(false);
  }

  return (
    <div className="glass rounded-2xl border border-teal-400/20 p-6 shadow-glow-cyan">
      <div className="mb-1 flex flex-wrap items-center gap-2.5">
        <h3 className="font-orbitron text-lg font-bold uppercase tracking-wide">Try it live — free</h3>
        <span className="rounded-full border border-neon-purple/40 bg-neon-purple/15 px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-widest text-neon-purple">testnet · tKAS · no wallet</span>
      </div>
      <p className="mb-4 max-w-[62ch] text-[13.5px] text-gray-400">
        See the pay-per-call loop work with no setup: we grant a small tKAS credit and meter a real call
        to the <span className="text-teal-400">kaspa-expert</span> model — RAG-grounded on current Kaspa
        knowledge, so ask it anything about Kaspa. This is a testnet demo; no real value moves. For real
        usage on mainnet, open a funded session and pay in KAS.
      </p>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2}
        className="w-full resize-y rounded-lg border border-gray-700 bg-gray-900/80 px-3 py-2.5 font-mono text-[13px] text-gray-100 outline-none focus:border-teal-400 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.1)]" />
      <div className="mt-3 flex items-center gap-3">
        <button onClick={run} disabled={busy}
          className="btn-kaspa rounded-lg px-4 py-2 font-orbitron text-[12.5px] font-bold uppercase tracking-wide text-[#04121a] disabled:opacity-60">
          {busy ? 'running…' : 'Run free →'}
        </button>
        <span className="font-mono text-[11.5px] text-gray-500">kaspa-expert · RAG-grounded · metered in tKAS</span>
      </div>
      {out && (
        <div className="mt-4 rounded-lg border border-teal-400/20 bg-gray-950/70 p-4 text-[14px] leading-relaxed text-gray-200">
          {out}
          <div className="mt-3 border-t border-gray-700/60 pt-2 font-mono text-[11px] text-teal-400">
            ✓ settled a free testnet call · <a href="https://x402-compute.68cxgfyr0.workers.dev/onboard" className="underline hover:text-teal-300" target="_blank" rel="noopener noreferrer">open a mainnet session</a> to do this for real
          </div>
        </div>
      )}
      {err && (
        <div className="mt-4 rounded-lg border border-neon-pink/30 bg-neon-pink/5 p-3.5 font-mono text-[12.5px] text-neon-pink">
          {err}
        </div>
      )}
    </div>
  );
}

// Auto-playing hero demo: types a prompt -> runs it -> streams the answer -> reveals "settled on
// Kaspa" -> fades and loops. Native React, driven by a useEffect timeline; respects reduced-motion.
function DemoLoop() {
  const win = useRef(null), input = useRef(null), ans = useRef(null), anstext = useRef(null);
  const settle = useRef(null), run = useRef(null), spin = useRef(null), amt = useRef(null);
  useEffect(() => {
    let cancelled = false;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const PROMPT = 'What consensus does Kaspa use, and why is it fast?';
    const ANSWER = 'Kaspa uses GHOSTDAG — a blockDAG generalization of Nakamoto consensus. Instead of one chain, it orders many blocks in parallel, reaching ~1-second finality at 10 blocks per second.';
    const caret = '<span class="inline-block w-[7px] h-[15px] align-[-2px] bg-teal-400 animate-pulse" style="box-shadow:0 0 8px #ffffff"></span>';
    const showAns = (on) => { const e = ans.current; if (!e) return; e.style.maxHeight = on ? '260px' : '0px'; e.style.paddingTop = on ? '13px' : '0px'; e.style.paddingBottom = on ? '13px' : '0px'; };
    const setAmt = (kas, usd) => { if (amt.current) amt.current.innerHTML = kas.toFixed(3) + ' KAS <small class="text-gray-500">· $' + usd.toFixed(4) + '</small>'; };
    async function type(el, text, sp) { for (let i = 0; i <= text.length && !cancelled; i++) { el.innerHTML = text.slice(0, i) + caret; await sleep(sp); } if (!cancelled && el) el.textContent = text; }
    function countAmt() { return new Promise((res) => { const K = 0.021, U = 0.0006, dur = 700; let t0 = null; const tick = (ts) => { if (cancelled) return res(); t0 ??= ts; const k = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - k, 3); setAmt(K * e, U * e); k < 1 ? requestAnimationFrame(tick) : res(); }; requestAnimationFrame(tick); }); }
    function reset() { if (cancelled || !input.current) return; input.current.textContent = ''; anstext.current.textContent = ''; showAns(false); settle.current.style.opacity = '0'; settle.current.style.transform = 'translateY(8px)'; spin.current.style.display = 'none'; setAmt(0, 0); win.current.style.opacity = '1'; }
    async function loop() {
      if (reduce) { input.current.textContent = PROMPT; showAns(true); anstext.current.textContent = ANSWER; settle.current.style.opacity = '1'; settle.current.style.transform = 'none'; setAmt(0.021, 0.0006); return; }
      while (!cancelled) {
        reset(); await sleep(700);
        await type(input.current, PROMPT, 42); await sleep(450);
        spin.current.style.display = 'inline-block'; await sleep(950); spin.current.style.display = 'none';
        showAns(true); await sleep(200);
        await type(anstext.current, ANSWER, 16); await sleep(500);
        settle.current.style.opacity = '1'; settle.current.style.transform = 'none'; await countAmt();
        await sleep(4200);
        win.current.style.opacity = '0'; await sleep(650);
      }
    }
    loop();
    return () => { cancelled = true; };
  }, []);
  return (
    <div ref={win} className="glass overflow-hidden rounded-2xl border border-teal-400/15 shadow-glow-cyan transition-opacity duration-500" style={{ background: 'rgba(14,14,14,0.85)' }}>
      <div className="flex items-center gap-2.5 border-b border-gray-700/60 px-3.5 py-2.5" style={{ background: 'rgba(20,20,20,0.6)' }}>
        <span className="flex gap-1.5">
          <i className="block h-2.5 w-2.5 rounded-full" style={{ background: '#ff5f57' }} />
          <i className="block h-2.5 w-2.5 rounded-full" style={{ background: '#febc2e' }} />
          <i className="block h-2.5 w-2.5 rounded-full" style={{ background: '#28c840' }} />
        </span>
        <span className="flex flex-1 items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-950/60 px-2.5 py-1 font-mono text-xs text-gray-400">🔒 <b className="font-normal text-teal-400">kaspa-402.org</b></span>
      </div>
      <div className="p-5">
        <div className="mb-1.5 flex items-center gap-2.5">
          <h3 className="font-orbitron text-[14px] font-bold uppercase tracking-wide">Try it live — free</h3>
          <span className="rounded-full border border-neon-purple/40 bg-neon-purple/15 px-2 py-px font-mono text-[10px] uppercase tracking-widest text-neon-purple">testnet · no wallet</span>
        </div>
        <p className="mb-3.5 text-[12.5px] text-gray-400">A real model call, metered in tKAS. No account, no API key.</p>
        <div ref={input} className="min-h-[42px] rounded-lg border border-gray-700 bg-gray-900/80 px-3 py-2.5 font-mono text-[13px] leading-relaxed text-gray-100" />
        <div className="mt-3 flex items-center gap-3">
          <span ref={run} className="btn-kaspa inline-flex items-center gap-2 rounded-lg px-4 py-2 font-orbitron text-[11.5px] font-bold uppercase tracking-wide text-[#04121a]">
            <span ref={spin} className="h-3 w-3 animate-spin rounded-full border-2 border-[#04121a]/40 border-t-[#04121a]" style={{ display: 'none' }} />
            Run free →
          </span>
          <span className="font-mono text-[11px] text-gray-500">kaspa-expert · metered per token</span>
        </div>
        <div ref={ans} className="mt-4 overflow-hidden rounded-lg border border-teal-400/15 bg-gray-950/70 px-3.5 transition-all duration-300" style={{ maxHeight: 0 }}>
          <div ref={anstext} className="text-[14px] leading-relaxed text-gray-200" />
        </div>
        <div ref={settle} className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-kaspa/30 bg-kaspa/5 px-3.5 py-2.5 transition-all duration-500" style={{ opacity: 0, transform: 'translateY(8px)' }}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-kaspa text-[12px] font-bold text-[#04121a] shadow-glow-kaspa">✓</span>
          <span className="font-mono text-[12.5px] text-kaspa">settled per call · Kaspa L1 covenant</span>
          <span ref={amt} className="ml-auto font-mono text-[13px] text-teal-400 neon-text" />
          <span className="w-full font-mono text-[11px] text-gray-500">no custodian · no facilitator · you paid exactly for the tokens you used</span>
        </div>
      </div>
    </div>
  );
}

export default function Marketplace() {
  const [raw, setRaw] = useState([]);
  const [q, setQ] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRep, setMinRep] = useState('');
  const [sort, setSort] = useState('rep');
  const [used, setUsed] = useState(null);
  const [kasCount, setKasCount] = useState(0);
  const [health, setHealth] = useState(null);
  const [hideDead, setHideDead] = useState(false);

  useEffect(() => {
    fetch('/api/exchange')
      .then((r) => r.json())
      .then((d) => setRaw((d.providers || []).map(mapProvider)))
      .catch(() => setRaw([]));
    // liveness sweep (cached at the edge); dead endpoints get dimmed + sorted last
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setHealth(d))
      .catch(() => {});
  }, []);

  // unknown/unchecked endpoints are treated as alive so a health blip never hides a real listing
  const healthOf = (p) => (health && health.endpoints && health.endpoints[p.endpoint]) || null;
  const aliveOf = (p) => { const h = healthOf(p); return h ? h.alive : true; };

  const totalKas = useMemo(() => raw.reduce((s, p) => s + p.kas, 0), [raw]);
  const providerCount = useMemo(() => new Set(raw.map((p) => p.payeeFull)).size, [raw]);
  const maxKas = useMemo(() => Math.max(1, ...raw.map((p) => p.kas)), [raw]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setKasCount(totalKas); return; }
    let t0 = null; const dur = 1100; let raf;
    const tick = (ts) => { t0 ??= ts; const k = Math.min(1, (ts - t0) / dur); setKasCount(totalKas * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [totalKas]);

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase(); const mp = parseFloat(maxPrice) || Infinity; const mr = parseFloat(minRep) || 0;
    return raw
      .filter((p) => (!ql || p.cap.includes(ql) || p.who.toLowerCase().includes(ql) || (p.model || '').toLowerCase().includes(ql)) && p.price <= mp && p.kas >= mr)
      .sort((a, b) => (sort === 'price' ? a.price - b.price : sort === 'new' ? a.closes - b.closes : b.kas - a.kas));
  }, [raw, q, maxPrice, minRep, sort]);

  const deadInView = list.reduce((n, p) => n + (aliveOf(p) ? 0 : 1), 0);
  const checkedAgo = health?.checked_at ? Math.max(0, Math.round((Date.now() - health.checked_at) / 60000)) : null;
  // group by category only in the default view; a chosen sort or a search flattens into one ranked list
  const grouped = sort === 'rep' && !q.trim();

  return (
    <>
      <Head>
        <title>k402 service exchange — agent-payable services on Kaspa</title>
        <meta name="description" content="An open marketplace of agent-payable services — LLM inference, chain data, zero-knowledge proofs — settled trustlessly over Kaspa payment channels. No accounts, no API keys." />
        <meta property="og:title" content="k402 service exchange" />
        <meta property="og:description" content="The marketplace for agent-payable services, settled on Kaspa L1. Browse, list a service, or try a call free." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://kaspa-402.org" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="canonical" href="https://kaspa-402.org" />
      </Head>

      <main className="mx-auto max-w-6xl px-6 pb-20">
        {/* hero */}
        <section className="pt-16 pb-8">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="mb-5 font-mono text-xs uppercase tracking-[0.28em] text-teal-400">k402 service exchange · settled on kaspa L1</p>
              <h1 className="mb-5 max-w-[17ch] font-orbitron text-4xl font-bold uppercase leading-tight tracking-tight text-balance sm:text-5xl">
                The marketplace for <span className="gradient-text-kaspa">agent-payable</span> services
              </h1>
              <p className="mb-8 max-w-[60ch] text-[17px] leading-relaxed text-gray-400">
                Discover a provider, open a payment channel straight to it, and settle per call — LLM inference,
                chain data, zero-knowledge proofs, covenant tooling. <b className="font-semibold text-gray-100">The registry never holds funds.</b>{' '}
                Reputation is settled volume, verified on-chain.
              </p>
              <div className="flex flex-wrap gap-3">
                <a href="#browse" className="btn-kaspa rounded-lg px-4 py-2.5 font-orbitron text-[12.5px] font-bold uppercase tracking-wide text-[#04121a]">Browse services</a>
                <a href="#list" className="rounded-lg border border-gray-700 bg-gray-900/60 px-4 py-2.5 font-orbitron text-[12.5px] font-bold uppercase tracking-wide text-gray-100 transition hover:border-teal-400 hover:text-teal-400">List your service →</a>
              </div>
            </div>
            <DemoLoop />
          </div>
          <div className="mt-10 grid grid-cols-2 overflow-hidden rounded-2xl border border-teal-400/15 sm:grid-cols-4" style={{ gap: '1px', background: 'rgba(255,255,255,0.14)' }}>
            {[
              ['Services listed', raw.length],
              ['Settled to date', <span key="k"><span className="tabular-nums">{fmt(kasCount)}</span> <span className="text-teal-400 neon-text">KAS</span></span>],
              ['Providers', providerCount],
              ['Finality', <span key="f">~1<small className="ml-1 font-mono text-xs font-normal text-gray-400">SEC · L1</small></span>],
            ].map(([k, v], i) => (
              <div key={i} className="bg-gray-900/60 px-5 py-5 backdrop-blur">
                <div className="mb-2 font-mono text-[11.5px] uppercase tracking-wide text-gray-500">{k}</div>
                <div className="font-orbitron text-[25px] font-bold tabular-nums">{v}</div>
              </div>
            ))}
          </div>
        </section>

        {/* try it free */}
        <section className="pt-10">
          <TrialWidget />
        </section>

        {/* agents route + fail over */}
        <section className="pt-14">
          <div className="grid items-center gap-7 lg:grid-cols-2">
            <div>
              <span className="rounded-full border border-teal-400/25 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-teal-400">agents route themselves</span>
              <h2 className="mt-4 font-orbitron text-[22px] font-bold uppercase tracking-tight">One call. The agent picks — and fails over.</h2>
              <p className="mt-3 max-w-[54ch] text-sm leading-relaxed text-gray-400">
                Independent providers — different keys, different hosts — list the same service.
                <span className="text-gray-200"> pay_best</span> discovers them, pays the cheapest reputable one, and
                <span className="text-gray-200"> fails over</span> the moment it drops. A cheap preflight skips dead
                endpoints before opening an on-chain channel, so a payer never burns KAS on a provider that&apos;s down.
              </p>
              <pre className="mt-4 overflow-x-auto rounded-xl border border-gray-800 bg-gray-950/70 px-4 py-3 font-mono text-[12px] leading-relaxed text-gray-300">{`pip install k402
res = await payer.pay_best("summarize", policy="cheapest")
print(res.response.json(), "via", res.provider["payee_pubkey"][:8])`}</pre>
            </div>
            <RoutingCast />
          </div>
        </section>

        {/* browse */}
        <section id="browse" className="pt-12">
          <div className="mb-5 flex items-end justify-between gap-3">
            <div><h2 className="font-orbitron text-[22px] font-bold uppercase tracking-tight">Browse services</h2>
              <p className="mt-1.5 text-sm text-gray-400">Grouped by category by default; pick a sort or search to rank them all in one list. Hit “Use →” on any service to see how to call it.</p></div>
            <span className="rounded-full border border-teal-400/25 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-teal-400">live market</span>
          </div>
          <div className="mb-5 flex flex-wrap items-center gap-2.5">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="capability — summarize · llm:reason · zk-prove …" className={FIELD + ' flex-1 min-w-[200px]'} />
            <input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} type="number" step="0.001" placeholder="max $/call" className={FIELD + ' w-32'} />
            <input value={minRep} onChange={(e) => setMinRep(e.target.value)} type="number" step="1" placeholder="min rep KAS" className={FIELD + ' w-32'} />
            <select value={sort} onChange={(e) => setSort(e.target.value)} className={FIELD + ' w-40 cursor-pointer'}>
              <option value="rep">sort · reputation</option><option value="price">sort · price ↑</option><option value="new">sort · newest</option>
            </select>
            <span className="ml-auto font-mono text-[12.5px] text-gray-400"><b className="text-teal-400">{list.length}</b> of {raw.length} services</span>
          </div>
          {deadInView > 0 ? (
            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] text-gray-500">
              <span className="text-rose-300"><b>{deadInView}</b> unreachable</span>
              {checkedAgo != null ? <span className="text-gray-600">· checked {checkedAgo === 0 ? 'just now' : `${checkedAgo}m ago`}</span> : null}
              <button onClick={() => setHideDead((v) => !v)} className="text-teal-400 hover:underline">{hideDead ? 'show them' : 'hide them'}</button>
            </div>
          ) : null}
          {list.length ? (
            grouped ? (
              // default directory view — grouped by category, each ranked by reputation
              <div className="flex flex-col gap-8">
                {CAT_ORDER.map((cat) => {
                  let items = list.filter((p) => categoryOf(p.cap) === cat);
                  if (hideDead) items = items.filter(aliveOf);
                  if (!items.length) return null;
                  items = [...items].sort((a, b) => Number(aliveOf(b)) - Number(aliveOf(a))); // dead last, order otherwise preserved
                  return (
                    <div key={cat}>
                      <div className="mb-3 flex items-center gap-3">
                        <h3 className="font-orbitron text-[13px] font-bold uppercase tracking-[0.14em] text-teal-400">{cat}</h3>
                        <span className="font-mono text-[11px] text-gray-500">{items.length}</span>
                        <div className="h-px flex-1 bg-teal-400/15" />
                      </div>
                      <div className="grid gap-3.5 md:grid-cols-2">
                        {items.map((p, i) => <ProviderCard key={p.payeeFull + p.cap + i} p={p} maxKas={maxKas} onUse={setUsed} dead={!aliveOf(p)} deadDetail={healthOf(p)?.detail} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // a sort or search is active — flatten to a single ranked list so the ranking is visible
              <div className="grid gap-3.5 md:grid-cols-2">
                {(hideDead ? list.filter(aliveOf) : [...list])
                  .sort((a, b) => Number(aliveOf(b)) - Number(aliveOf(a)))
                  .map((p, i) => <ProviderCard key={p.payeeFull + p.cap + i} p={p} maxKas={maxKas} onUse={setUsed} dead={!aliveOf(p)} deadDetail={healthOf(p)?.detail} />)}
              </div>
            )
          ) : (
            <div className="py-12 text-center font-mono text-gray-400">no services match — widen the filters, or list yours below.</div>
          )}
        </section>

        {/* list a service */}
        <section id="list" className="pt-14">
          <div className="mb-5 flex items-end justify-between gap-3">
            <div><h2 className="font-orbitron text-[22px] font-bold uppercase tracking-tight">List your service in about a minute</h2>
              <p className="mt-1.5 max-w-[70ch] text-sm text-gray-400">Fill the form, copy the generated command, run it locally. Your key signs the listing on your machine — it never touches this page or the registry.</p></div>
            <span className="rounded-full border border-teal-400/25 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-teal-400">onboarding</span>
          </div>
          <div className="mb-5 flex flex-wrap gap-2.5">
            {[['1', 'Describe it', 'Name a capability, your endpoint, and a price. Pick the payment schemes you accept.'],
              ['2', 'Sign locally', 'Run the generated one-liner. Your payee key signs the listing — proving you control the address that gets paid.'],
              ['3', "You're live", 'Your card appears in the market instantly. As agents pay and channels close, your reputation accrues, chain-verified.']].map(([n, t, d]) => (
              <div key={n} className="glass min-w-[210px] flex-1 rounded-xl border border-teal-400/15 p-4">
                <b className="flex items-center font-orbitron text-[12.5px] font-bold uppercase tracking-wide">
                  <span className="mr-2.5 rounded-md bg-teal-400 px-2 py-px font-mono text-xs text-gray-950 shadow-glow-cyan">{n}</span>{t}</b>
                <p className="mt-2.5 text-[13px] leading-snug text-gray-400">{d}</p>
              </div>
            ))}
          </div>
          <a href="/validate" className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-teal-400/20 bg-teal-400/5 px-4 py-3 transition hover:border-teal-400/50 hover:shadow-glow-cyan">
            <span className="text-[13px] text-gray-300"><b className="text-teal-400">Preflight first →</b> check your endpoint returns a proper k402 challenge before you list — no dead listings.</span>
            <span className="shrink-0 font-mono text-[12.5px] text-teal-400">Validate</span>
          </a>
          <ListingBuilder />
        </section>

        {/* connect an agent */}
        <section className="mt-14 border-t border-teal-400/15 pt-9">
          <h2 className="mb-6 font-mono text-[12.5px] uppercase tracking-[0.18em] text-gray-400">Connect an agent</h2>
          <p className="mb-4 max-w-[64ch] text-sm text-gray-400">One command wires up the hosted MCP endpoint, and your agent discovers and pays for any listed service — no install, no API key.</p>
          <div className="overflow-x-auto rounded-2xl border border-teal-400/15 bg-gray-950/70 px-4 py-4 font-mono text-[12.5px] leading-relaxed text-gray-200">
            <span className="text-gray-500"># one-liner — adds the k402 MCP server, or prints config for any agent</span><br />
            npx kaspa-402<br />
            <br />
            <span className="text-gray-500"># or add it directly in Claude Code</span><br />
            claude mcp add --transport http k402 {MCP_URL}
          </div>
          <p className="mt-3 text-[13px] text-gray-400">
            Or point any agent at the machine-readable catalog — the whole marketplace (how to pay, the
            discovery API, every service) in one fetch:{' '}
            <a href="/llms.txt" className="font-mono text-teal-400 hover:underline">/llms.txt</a>
            {' '}·{' '}
            <a href="/llms.json" className="font-mono text-teal-400 hover:underline">/llms.json</a>.
            Each service also has a manifest at{' '}
            <span className="font-mono text-gray-300">/skill/&lt;capability&gt;.md</span>.
          </p>
        </section>

        {/* footer */}
        <footer className="mt-16 border-t border-teal-400/15 pt-8">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {[
              ['Agent catalog (llms.txt)', '/llms.txt'],
              ['Catalog JSON', '/llms.json'],
              ['npx kaspa-402', 'https://github.com/Kali123411/kaspa-402-cli'],
              ['Validate a service', '/validate'],
              ['Protocol', 'https://github.com/Kali123411/k402/blob/main/PROTOCOL.md'],
              ['Provider guide', 'https://github.com/Kali123411/k402/blob/main/PROVIDERS.md'],
              ['Python package', 'https://pypi.org/project/k402/'],
              ['GitHub', 'https://github.com/Kali123411/k402'],
            ].map(([label, href]) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                className="font-mono text-[13px] text-gray-400 transition hover:text-teal-400">{label}</a>
            ))}
            <span className="ml-auto font-mono text-[11.5px] text-gray-600">MCP: x402-compute.68cxgfyr0.workers.dev/mcp</span>
          </div>
          <p className="mt-6 max-w-[78ch] text-[12px] leading-relaxed text-gray-600">
            Prototype. The channel covenant is unaudited and channel sizes are capped, so the scheme is experimental —
            don&apos;t put in more than you can lose. Prices are USD-pegged and re-quoted; reputation reflects settled volume
            verified on-chain. The free trial settles in testnet tKAS (no real value); all other functionality is mainnet.
          </p>
        </footer>
      </main>
      {used ? <UseModal p={used} onClose={() => setUsed(null)} /> : null}
    </>
  );
}
