// pages/validate.js — provider preflight. Paste your endpoint; we check it speaks k402 (returns a
// proper 402 challenge with a payable scheme and a well-formed pay destination) before you list it.
import Head from 'next/head';
import { useState } from 'react';

const ICON = { pass: '✓', warn: '!', fail: '✕' };
const TONE = {
  pass: 'text-teal-400 border-teal-400/40 bg-teal-400/5',
  warn: 'text-amber-400 border-amber-400/40 bg-amber-400/5',
  fail: 'text-rose-400 border-rose-400/40 bg-rose-400/5',
};

function Check({ c }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border font-mono text-[12px] ${TONE[c.level]}`}>{ICON[c.level]}</span>
      <div>
        <div className="text-[13.5px] font-semibold text-gray-200">{c.label}</div>
        <div className="font-mono text-[12px] leading-relaxed text-gray-400">{c.detail}</div>
      </div>
    </div>
  );
}

export default function Validate() {
  const [endpoint, setEndpoint] = useState('');
  const [payee, setPayee] = useState('');
  const [network, setNetwork] = useState('mainnet');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');

  async function run(e) {
    e?.preventDefault();
    if (!endpoint.trim() || busy) return;
    setBusy(true); setErr(''); setRes(null);
    try {
      const r = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint: endpoint.trim(), payeePubkey: payee.trim() || undefined, network }),
      });
      const d = await r.json();
      if (d.error) setErr(d.error); else setRes(d);
    } catch (e2) {
      setErr('validation request failed — check the URL and try again');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>Validate your service — k402 exchange</title>
        <meta name="description" content="Preflight your k402 endpoint before listing: check it returns a proper 402 challenge with a payable scheme and a valid pay destination." />
      </Head>
      <main className="mx-auto max-w-2xl px-6 py-10">
        <a href="/" className="font-mono text-[12.5px] text-gray-500 hover:text-teal-400">← exchange</a>

        <h1 className="mt-4 font-orbitron text-2xl font-bold tracking-tight text-gray-100">Validate your service</h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-gray-300">
          Preflight your endpoint before you list it. We send one <span className="font-mono text-gray-200">unpaid</span> request and
          check it speaks k402 — a proper <span className="font-mono text-gray-200">402</span> challenge, a payable scheme, and a
          well-formed pay destination — so agents don’t hit a dead listing. Nothing is charged and nothing is stored.
        </p>

        <form onSubmit={run} className="mt-7 flex flex-col gap-3">
          <label className="font-mono text-[11px] uppercase tracking-wider text-gray-500">Service endpoint (the paid URL)</label>
          <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} inputMode="url" spellCheck={false}
            placeholder="https://your-host/summarize"
            className="rounded-xl border border-teal-400/20 bg-gray-950/70 px-4 py-3 font-mono text-[13px] text-gray-100 outline-none placeholder:text-gray-600 focus:border-teal-400/60" />

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <label className="font-mono text-[11px] uppercase tracking-wider text-gray-500">Payee pubkey <span className="text-gray-600">(optional — checks the channel offer matches)</span></label>
              <input value={payee} onChange={(e) => setPayee(e.target.value)} spellCheck={false}
                placeholder="32-byte x-only hex"
                className="mt-2 w-full rounded-xl border border-teal-400/20 bg-gray-950/70 px-4 py-2.5 font-mono text-[12.5px] text-gray-100 outline-none placeholder:text-gray-600 focus:border-teal-400/60" />
            </div>
            <div>
              <label className="font-mono text-[11px] uppercase tracking-wider text-gray-500">Network</label>
              <select value={network} onChange={(e) => setNetwork(e.target.value)}
                className="mt-2 rounded-xl border border-teal-400/20 bg-gray-950/70 px-3 py-2.5 font-mono text-[12.5px] text-gray-100 outline-none focus:border-teal-400/60">
                <option value="mainnet">mainnet</option>
                <option value="testnet">testnet</option>
              </select>
            </div>
          </div>

          <button type="submit" disabled={busy || !endpoint.trim()}
            className="mt-1 self-start rounded-xl border border-teal-400/40 bg-teal-400/10 px-5 py-2.5 font-orbitron text-[13px] font-bold uppercase tracking-wide text-teal-400 transition hover:bg-teal-400/20 hover:shadow-glow-cyan disabled:opacity-40">
            {busy ? 'validating…' : 'Validate →'}
          </button>
        </form>

        {err ? <div className="mt-6 rounded-xl border border-rose-400/40 bg-rose-400/5 px-4 py-3 font-mono text-[13px] text-rose-300">{err}</div> : null}

        {res ? (
          <div className="mt-8">
            <div className={`flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 ${res.ok ? TONE.pass : TONE.fail}`}>
              <div>
                <div className="font-orbitron text-[15px] font-bold uppercase tracking-wide">{res.ok ? '✓ Ready to list' : '✕ Not ready'}</div>
                <div className="mt-0.5 font-mono text-[12px] opacity-80">
                  {res.ok ? 'endpoint speaks k402 and offers a payable scheme' : 'fix the failing checks below, then re-run'}
                  {res.k402_version ? ` · protocol ${res.k402_version}` : ''}
                  {res.schemes?.length ? ` · ${res.schemes.join(', ')}` : ''}
                </div>
              </div>
              {res.ok ? (
                <a href="/#list" className="shrink-0 rounded-lg border border-teal-400/50 bg-teal-400/10 px-4 py-2 font-mono text-[12.5px] font-semibold text-teal-400 hover:bg-teal-400/20">List it →</a>
              ) : null}
            </div>

            <div className="mt-5 divide-y divide-gray-800/70 rounded-2xl border border-gray-800 bg-gray-950/40 px-5 py-1">
              {res.checks.map((c) => <Check key={c.id} c={c} />)}
            </div>

            {res.offers?.length ? (
              <div className="mt-5">
                <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-gray-500">Offers seen in the challenge</div>
                <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-gray-950/40">
                  <table className="w-full border-collapse text-left font-mono text-[12px]">
                    <thead>
                      <tr className="border-b border-gray-800 text-[10.5px] uppercase tracking-wider text-gray-500">
                        <th className="px-4 py-2 font-normal">scheme</th>
                        <th className="px-4 py-2 font-normal">quote</th>
                        <th className="px-4 py-2 font-normal">pay to</th>
                      </tr>
                    </thead>
                    <tbody>
                      {res.offers.map((o, i) => (
                        <tr key={i} className="border-b border-gray-800/50 text-gray-300">
                          <td className="whitespace-nowrap px-4 py-2 text-teal-400">{o.scheme}</td>
                          <td className="px-4 py-2 text-gray-300">{o.quote || <span className="text-gray-600">—</span>}
                            {o.channel ? <div className="text-[11px] text-gray-500">channel {o.channel.min_kas}–{o.channel.max_kas} KAS</div> : null}
                          </td>
                          <td className="px-4 py-2 text-gray-500">{o.dest ? <span className="break-all">{o.dest.length > 40 ? o.dest.slice(0, 20) + '…' + o.dest.slice(-8) : o.dest}</span> : <span className="text-gray-600">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <p className="mt-10 border-t border-gray-800 pt-5 text-[13px] text-gray-400">
          New to listing? Read the <a href="https://github.com/Kali123411/k402/blob/main/PROVIDERS.md" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline">provider guide</a>,
          then <a href="/#list" className="text-teal-400 hover:underline">list your service</a>. The pay-gate should return a k402 <span className="font-mono">402</span> to any request without an <span className="font-mono">X-K402-Payment</span> header.
        </p>
      </main>
    </>
  );
}
