// pages/validate.js — provider preflight. Paste your endpoint; we check it speaks x402 v2 (returns a
// 402 whose PAYMENT-REQUIRED header decodes to a valid PaymentRequired, validated by @kaspa-x402/core)
// with a recognized Kaspa scheme + supported network and a well-formed payTo, before you list it.
import Head from 'next/head';
import Term from '../components/Term';
import { EXTERNAL } from '../lib/brand.mjs';
import ExternalLink from '../components/ExternalLink';
import { useState } from 'react';
import { BUTTON, FIELD, H1, H2, LINK, MARK, PAGE, Section, notice } from '../components/Ledger';

const ICON = { pass: '✓', warn: '!', fail: '✕' };
const TONE = { pass: 'text-accent', warn: 'text-gray-300', fail: 'text-gray-200' };
const short = (s) => (s && s.length > 40 ? s.slice(0, 20) + '…' + s.slice(-8) : s);

/** one check: glyph, label, detail — a ruled row */
function Check({ c }) {
  return (
    <div className="grid grid-cols-[20px_minmax(0,1fr)] gap-3 border-b border-gray-800 py-2.5">
      <span className={`font-mono text-[13px] ${TONE[c.level]}`} aria-label={c.level}>{ICON[c.level]}</span>
      <div>
        <div className="text-[14.5px] text-gray-100">{c.label}</div>
        <div className="font-mono text-[12px] leading-relaxed text-gray-400">{c.detail}</div>
      </div>
    </div>
  );
}

export default function Validate() {
  const [endpoint, setEndpoint] = useState('');
  const [network, setNetwork] = useState('');
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
        <title>Validate your service — k402</title>
        <meta name="description" content="Preflight your endpoint before listing: check it returns a valid x402 v2 402 (PAYMENT-REQUIRED) with a recognized Kaspa scheme and a valid payTo." />
      </Head>
      <main className={`${PAGE} py-12 lg:py-16`}>
        <Section mark="0" top={false} note={<><a href="/" className={LINK}>← the directory</a><div className="mt-2">Nothing is charged or stored: the probe is one unpaid GET sent from this site&apos;s server (your browser never contacts your host), nothing in the response is kept, and the result is shown only to you.</div></>}>
          <h1 className={H1}>Validate your service</h1>
          <p className="mt-5 max-w-[62ch] text-[16px] leading-relaxed text-gray-300">
            Preflight your endpoint before you list it. We send one <span className="font-mono text-gray-200">unpaid</span> request and
            check it speaks <Term id="x402-v2"><span className="font-mono text-gray-200">x402 v2</span></Term> — a <span className="font-mono text-gray-200">402</span> whose
            <Term id="payment-required"><span className="font-mono text-gray-200"> PAYMENT-REQUIRED</span></Term> header decodes to a valid offer with a recognized Kaspa <Term id="scheme">scheme</Term> and
            a well-formed <Term id="payto"><span className="font-mono text-gray-200">payTo</span></Term> — so agents don’t hit a dead listing.
          </p>
        </Section>

        <Section mark="1" note="The probe. One unpaid request, from this site's server." className="mt-12">
          <form onSubmit={run} className="flex max-w-[760px] flex-col gap-3">
            <label htmlFor="v-endpoint" className={MARK}>Service endpoint (the paid URL)</label>
            <input id="v-endpoint" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} inputMode="url" spellCheck={false}
              placeholder="https://your-host/run   (the URL an agent calls, which answers 402 unpaid)"
              className={`${FIELD} w-full py-3`} />
            <button type="button" onClick={() => setEndpoint('https://kaspa-402-ask.kaspadev.workers.dev/exact')} className={`self-start font-mono text-[12px] text-gray-500 ${LINK}`}>try a listed example</button>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="v-net" className={MARK}>Network you expect <span className="text-gray-600">(optional)</span></label>
                <select id="v-net" value={network} onChange={(e) => setNetwork(e.target.value)} className={`${FIELD} mt-2`}>
                  <option value="">any network</option>
                  <option value="kaspa:testnet-10">kaspa:testnet-10</option>
                  <option value="kaspa:mainnet">kaspa:mainnet</option>
                </select>
              </div>
            </div>
            <button type="submit" disabled={busy || !endpoint.trim()} className={`mt-1 self-start ${BUTTON} disabled:opacity-40`}>
              {busy ? 'validating…' : 'Validate'}
            </button>
          </form>

          {err ? <div className={`mt-6 max-w-[760px] font-mono text-[13px] ${notice}`}>{err}</div> : null}

          {res ? (
            <div className="mt-8 max-w-[760px]">
              <div className="flex flex-wrap items-baseline justify-between gap-4 border-t border-gray-100 pt-4">
                <div>
                  <div className={`${H2} ${res.ok ? 'text-accent' : ''}`}>{res.ok ? 'Ready to list' : 'Not ready'}</div>
                  <div className="mt-1 font-mono text-[12.5px] text-gray-500">
                    {res.ok ? 'endpoint speaks x402 v2 with a valid offer' : 'fix the failing checks below, then re-run'}
                    {res.x402Version ? ` · x402 v${res.x402Version}` : ''}
                    {res.networks?.length ? ` · ${res.networks.join(', ')}` : ''}
                  </div>
                </div>
                {res.ok ? <a href="/list" className={BUTTON}>List it</a> : null}
              </div>
              <div className="mt-4 border-t border-gray-100">
                {res.checks.map((c) => <Check key={c.id} c={c} />)}
              </div>
              {res.ok ? (
                <p className="mt-3 text-[14px] text-gray-400">Validation lists nothing by itself. Next: <a href="/list" className={LINK}>submit it on /list</a> — the directory runs this same probe once more and lists it as soon as it passes.</p>
              ) : null}
              {res.requirements?.length ? (
                <div className="mt-6">
                  <div className={`mb-2 ${MARK}`}>payment requirements in the offer</div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left font-mono text-[12.5px]">
                      <thead>
                        <tr className="border-b border-gray-100 text-[11.5px] text-gray-500">
                          <th className="py-2 pr-4 font-normal">scheme</th>
                          <th className="py-2 pr-4 font-normal">network</th>
                          <th className="py-2 pr-4 font-normal">amount</th>
                          <th className="py-2 font-normal">pay to</th>
                        </tr>
                      </thead>
                      <tbody>
                        {res.requirements.map((q, i) => (
                          <tr key={i} className="border-b border-gray-800 text-gray-300">
                            <td className="whitespace-nowrap py-2 pr-4 text-accent">{q.scheme}
                              {q.profile ? <div className="text-[11px] text-gray-500">{q.profile}</div> : null}
                            </td>
                            <td className="whitespace-nowrap py-2 pr-4 text-gray-400">{q.network}</td>
                            <td className="whitespace-nowrap py-2 pr-4 text-gray-300">{q.amount_sompi != null ? `${q.amount_sompi} sompi` : <span className="text-gray-600">—</span>}
                              {q.kas != null ? <div className="text-[11px] text-gray-500">{q.kas} KAS</div> : null}
                            </td>
                            <td className="py-2 text-gray-500">{q.payTo ? <span className="break-all">{short(q.payTo)}</span> : <span className="text-gray-600">—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {!res ? (
            <div className="mt-8 max-w-[760px]">
              <div className={`mb-2 ${MARK}`}>What a pass looks like</div>
              <div className="border-t border-gray-100">
                {[['Endpoint URL', 'public https URL'], ['Reachable', 'responded in 240 ms (HTTP 402)'], ['Returns 402', 'HTTP 402 Payment Required to an unpaid request'], ['Speaks x402 v2', 'PAYMENT-REQUIRED decodes to a valid offer'], ['Payment terms', 'exact · kaspa:mainnet · 1.1 KAS → kaspa:qzws…pde4']].map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[20px_minmax(0,1fr)] gap-3 border-b border-gray-800 py-2.5"><span className="font-mono text-[13px] text-accent" aria-hidden>✓</span><div><div className="font-mono text-[13px] text-gray-200">{k}</div><div className="font-mono text-[11.5px] text-gray-500">{v}</div></div></div>
                ))}
              </div>
            </div>
          ) : null}
        </Section>

        <Section mark="2" note="Common failures and their fixes." className="mt-12">
          <details className="max-w-[760px]">
            <summary className={`cursor-pointer ${MARK}`}>Common failures and their fixes</summary>
            <dl className="mt-3 space-y-3 text-[14px] leading-relaxed">
              {[
                ['Returns 200 to an unpaid request', 'There is no pay-gate on that URL. Wrap the handler with @kaspa-x402/server (KAS) or K402(kusd=…) (kUSD) so a request without PAYMENT-SIGNATURE gets a 402.'],
                ['402 without a PAYMENT-REQUIRED header', 'The offer must ride in the response header named PAYMENT-REQUIRED (any case), not in the body. Behind a proxy or CORS layer, make sure the header is passed through and exposed.'],
                ['Header does not decode', 'PAYMENT-REQUIRED is base64 of a JSON PaymentRequired with x402Version 2 and an accepts[] array. A raw JSON string or a truncated header fails here.'],
                ['Unknown scheme or network', 'Each accepts[] entry needs scheme exact or batch-settlement and network kaspa:mainnet or kaspa:testnet-10 (kusd-utxo for kUSD listings on the market). Typos such as kaspa:testnet10 fail.'],
                ['payTo malformed', 'payTo is a bech32 Kaspa address on the same network as the entry: kaspa: for mainnet, kaspatest: for testnet-10. A mismatch between the two is the most common cause.'],
                ['Endpoint not reachable', 'The URL must be public (no localhost or private ranges), answer TLS correctly and reply within 9 seconds. Try the same curl -si from another machine.'],
              ].map(([k, v]) => (
                <div key={k} className="border-t border-gray-800 pt-3"><dt className="font-mono text-gray-200">{k}</dt><dd className="mt-0.5 text-gray-400">{v}</dd></div>
              ))}
            </dl>
          </details>
          <p className="mt-8 max-w-[70ch] border-t border-gray-800 pt-5 text-[14px] leading-relaxed text-gray-400">
            Built on k402, the <ExternalLink href={EXTERNAL.standard}>Kaspa x402 v2 standard</ExternalLink>.
            Your pay-gate should return a <span className="font-mono">402</span> with a <span className="font-mono">PAYMENT-REQUIRED</span> header to any request that has no <span className="font-mono">PAYMENT-SIGNATURE</span> — the
            <a href="https://www.npmjs.com/package/@kaspa-x402/server" target="_blank" rel="noopener noreferrer" className={LINK}> @kaspa-x402/server</a> SDK does this for you.
          </p>
        </Section>
      </main>
    </>
  );
}
