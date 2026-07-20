// pages/validate.js — provider preflight. Paste your endpoint; we check it speaks x402 v2 (returns a
// 402 whose PAYMENT-REQUIRED header decodes to a valid PaymentRequired, validated by @kaspa-x402/core)
// with a recognized Kaspa scheme + supported network and a well-formed payTo, before you list it.
import Head from 'next/head';
import { useState } from 'react';

const ICON = { pass: '✓', warn: '!', fail: '✕' };
const TONE = {
  pass: 'text-teal-400 border-teal-400/40 bg-teal-400/5',
  warn: 'text-amber-400 border-amber-400/40 bg-amber-400/5',
  fail: 'text-rose-400 border-rose-400/40 bg-rose-400/5',
};
const short = (s) => (s && s.length > 40 ? s.slice(0, 20) + '…' + s.slice(-8) : s);

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
  const [network, setNetwork] = useState('kaspa:testnet-10');
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
        body: JSON.stringify({ endpoint: endpoint.trim(), network }),
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
        <title>Validate your service — Kaspa x402 marketplace</title>
        <meta name="description" content="Preflight your endpoint before listing: check it returns a valid x402 v2 402 (PAYMENT-REQUIRED) with a recognized Kaspa scheme and a valid payTo." />
      </Head>
      <main className="mx-auto max-w-2xl px-6 py-10">
        <a href="/" className="font-mono text-[12.5px] text-gray-500 hover:text-teal-400">← marketplace</a>

        <h1 className="mt-4 font-orbitron text-2xl font-bold tracking-tight text-gray-100">Validate your service</h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-gray-300">
          Preflight your endpoint before you list it. We send one <span className="font-mono text-gray-200">unpaid</span> request and
          check it speaks <span className="font-mono text-gray-200">x402 v2</span> — a <span className="font-mono text-gray-200">402</span> whose
          <span className="font-mono text-gray-200"> PAYMENT-REQUIRED</span> header decodes to a valid offer with a recognized Kaspa scheme and
          a well-formed <span className="font-mono text-gray-200">payTo</span> — so agents don’t hit a dead listing. Nothing is charged or stored.
        </p>

        <form onSubmit={run} className="mt-7 flex flex-col gap-3">
          <label className="font-mono text-[11px] uppercase tracking-wider text-gray-500">Service endpoint (the paid URL)</label>
          <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} inputMode="url" spellCheck={false}
            placeholder="https://your-host/run"
            className="rounded-xl border border-teal-400/20 bg-gray-950/70 px-4 py-3 font-mono text-[13px] text-gray-100 outline-none placeholder:text-gray-600 focus:border-teal-400/60" />

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="font-mono text-[11px] uppercase tracking-wider text-gray-500">Network you expect <span className="text-gray-600">(optional)</span></label>
              <select value={network} onChange={(e) => setNetwork(e.target.value)}
                className="mt-2 rounded-xl border border-teal-400/20 bg-gray-950/70 px-3 py-2.5 font-mono text-[12.5px] text-gray-100 outline-none focus:border-teal-400/60">
                <option value="kaspa:testnet-10">kaspa:testnet-10</option>
                <option value="kaspa:mainnet">kaspa:mainnet</option>
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
                  {res.ok ? 'endpoint speaks x402 v2 with a valid offer' : 'fix the failing checks below, then re-run'}
                  {res.x402Version ? ` · x402 v${res.x402Version}` : ''}
                  {res.networks?.length ? ` · ${res.networks.join(', ')}` : ''}
                </div>
              </div>
              {res.ok ? (
                <a href="/#list" className="shrink-0 rounded-lg border border-teal-400/50 bg-teal-400/10 px-4 py-2 font-mono text-[12.5px] font-semibold text-teal-400 hover:bg-teal-400/20">List it →</a>
              ) : null}
            </div>

            <div className="mt-5 divide-y divide-gray-800/70 rounded-2xl border border-gray-800 bg-gray-950/40 px-5 py-1">
              {res.checks.map((c) => <Check key={c.id} c={c} />)}
            </div>

            {res.requirements?.length ? (
              <div className="mt-5">
                <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-gray-500">Payment requirements in the offer</div>
                <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-gray-950/40">
                  <table className="w-full border-collapse text-left font-mono text-[12px]">
                    <thead>
                      <tr className="border-b border-gray-800 text-[10.5px] uppercase tracking-wider text-gray-500">
                        <th className="px-4 py-2 font-normal">scheme</th>
                        <th className="px-4 py-2 font-normal">network</th>
                        <th className="px-4 py-2 font-normal">amount</th>
                        <th className="px-4 py-2 font-normal">pay to</th>
                      </tr>
                    </thead>
                    <tbody>
                      {res.requirements.map((q, i) => (
                        <tr key={i} className="border-b border-gray-800/50 text-gray-300">
                          <td className="whitespace-nowrap px-4 py-2 text-teal-400">{q.scheme}
                            {q.profile ? <div className="text-[11px] text-gray-500">{q.profile}</div> : null}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 text-gray-400">{q.network}</td>
                          <td className="whitespace-nowrap px-4 py-2 text-gray-300">{q.amount_sompi != null ? `${q.amount_sompi} sompi` : <span className="text-gray-600">—</span>}
                            {q.kas != null ? <div className="text-[11px] text-gray-500">{q.kas} KAS</div> : null}
                          </td>
                          <td className="px-4 py-2 text-gray-500">{q.payTo ? <span className="break-all">{short(q.payTo)}</span> : <span className="text-gray-600">—</span>}</td>
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
          Built on the <a href="https://kaspa-x402.org" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline">Kaspa x402</a> standard.
          Your pay-gate should return a <span className="font-mono">402</span> with a <span className="font-mono">PAYMENT-REQUIRED</span> header to any request that has no <span className="font-mono">PAYMENT-SIGNATURE</span> — the
          <a href="https://www.npmjs.com/package/@kaspa-x402/server" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline"> @kaspa-x402/server</a> SDK does this for you.
        </p>
      </main>
    </>
  );
}
