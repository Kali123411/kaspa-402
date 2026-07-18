// pages/skill/[cap].js — human-facing manifest page for one capability.
// Shows what the service does, what to send/get, how to pay, and every live provider (cheapest
// first). Its machine twin is /skill/<cap>.md (the SKILL.md an agent ingests).
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { MCP_URL, GATEWAY, capInfo, categoryOf } from '../../lib/catalog';

function Block({ label, children }) {
  return (
    <div>
      <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wider text-teal-400">{label}</div>
      {children}
    </div>
  );
}

export default function SkillPage() {
  const router = useRouter();
  const cap = typeof router.query.cap === 'string' ? router.query.cap : '';
  const [providers, setProviders] = useState(null);

  useEffect(() => {
    fetch('/api/exchange')
      .then((r) => r.json())
      .then((d) => setProviders((d.providers || []).filter((p) => p.capability === cap).sort((a, b) => a.price_usd - b.price_usd)))
      .catch(() => setProviders([]));
  }, [cap]);

  const info = capInfo(cap);
  const cheapest = providers && providers.length ? Math.min(...providers.map((p) => p.price_usd)) : null;

  return (
    <>
      <Head>
        <title>{cap ? `${cap} — k402 skill` : 'k402 skill'}</title>
        <meta name="description" content={info.what} />
      </Head>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <a href="/" className="font-mono text-[12.5px] text-gray-500 hover:text-teal-400">← all services</a>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="font-orbitron text-2xl font-bold tracking-tight text-gray-100">{cap || '…'}</h1>
          <span className="rounded-md border border-teal-400/30 bg-teal-400/5 px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-teal-400">{cap ? categoryOf(cap) : ''}</span>
        </div>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-gray-300">{info.what}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12.5px] text-gray-500">
          <span>settled per call on Kaspa L1 — no account, no API key</span>
          <span className="text-gray-700">·</span>
          {providers == null ? <span>loading providers…</span>
            : providers.length ? <span className="text-teal-400">{providers.length} live{cheapest != null ? ` · from $${cheapest}/call` : ''}</span>
            : <span>no live providers right now</span>}
          <span className="text-gray-700">·</span>
          <a href={`/skill/${encodeURIComponent(cap)}.md`} className="text-gray-400 underline underline-offset-2 hover:text-teal-400">SKILL.md ↓</a>
        </div>

        {info.send ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Block label="you send">
              <pre className="overflow-x-auto rounded-lg border border-gray-800 bg-gray-950 px-3.5 py-3 font-mono text-[12px] leading-relaxed text-gray-300">{info.send}</pre>
            </Block>
            <Block label="you get">
              <pre className="overflow-x-auto rounded-lg border border-gray-800 bg-gray-950 px-3.5 py-3 font-mono text-[12px] leading-relaxed text-gray-300">{info.get}</pre>
            </Block>
          </div>
        ) : null}

        <h2 className="mt-10 font-orbitron text-[13px] font-bold uppercase tracking-[0.14em] text-teal-400">How to call</h2>
        <div className="mt-4 flex flex-col gap-3">
          {[
            ['1', 'MCP — the agent pays itself', 'easiest', `${MCP_URL ? `claude mcp add --transport http k402 ${MCP_URL}` : ''}\n# then: use the k402 "${cap}" service to ...`],
            ['2', 'Prepaid session', 'simplest in code', `curl -X POST ${GATEWAY}/onboard/request        # -> a Kaspa deposit address\n# fund once with KAS, then call the endpoint with header  X-Session: <session>`],
            ['3', 'Payment channel', 'trustless · high volume', `pip install k402\nproviders = await payer.discover("${cap}")\nr = await payer.pay(providers[0], "", { ... })   # covenant channel, pays per call`],
          ].map(([n, title, tag, code]) => (
            <div key={n} className="glass rounded-xl border border-teal-400/15 p-4">
              <div className="mb-2 flex items-center gap-2.5">
                <span className="grid h-5 w-5 place-items-center rounded-full border border-teal-400/40 font-mono text-[11px] text-teal-400">{n}</span>
                <span className="text-[13.5px] font-semibold text-gray-200">{title}</span>
                <span className="rounded border border-gray-700 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-gray-500">{tag}</span>
              </div>
              <pre className="overflow-x-auto rounded-lg border border-gray-800 bg-gray-950 px-3.5 py-2.5 font-mono text-[11.5px] leading-relaxed text-gray-300">{code}</pre>
            </div>
          ))}
        </div>

        <h2 className="mt-10 font-orbitron text-[13px] font-bold uppercase tracking-[0.14em] text-teal-400">Providers</h2>
        {providers == null ? (
          <p className="mt-3 font-mono text-[13px] text-gray-500">loading…</p>
        ) : providers.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-left font-mono text-[12.5px]">
              <thead>
                <tr className="border-b border-gray-700 text-[11px] uppercase tracking-wider text-gray-500">
                  <th className="py-2 pr-4 font-normal">price/call</th>
                  <th className="py-2 pr-4 font-normal">endpoint</th>
                  <th className="py-2 pr-4 font-normal">schemes</th>
                  <th className="py-2 pr-4 font-normal tabular-nums">rep (KAS)</th>
                  <th className="py-2 font-normal">payee</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p, i) => (
                  <tr key={p.payee_pubkey + i} className="border-b border-gray-800/60 text-gray-300">
                    <td className="py-2 pr-4 tabular-nums text-teal-400">${p.price_usd}</td>
                    <td className="py-2 pr-4 text-gray-400">{p.endpoint}</td>
                    <td className="py-2 pr-4 text-gray-500">{(p.schemes || []).join(', ')}</td>
                    <td className="py-2 pr-4 tabular-nums">{(p.reputation && p.reputation.settled_kas) || 0}</td>
                    <td className="py-2 text-gray-500">{String(p.payee_pubkey || '').slice(0, 10)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-[13.5px] text-gray-400">No providers are listing this capability right now. <a href="/#list" className="text-teal-400 hover:underline">List yours →</a></p>
        )}

        <p className="mt-10 border-t border-gray-800 pt-5 font-mono text-[12px] text-gray-500">
          Machine manifest: <a href={`/skill/${encodeURIComponent(cap)}.md`} className="text-teal-400 hover:underline">/skill/{cap}.md</a>
          <span className="mx-2 text-gray-700">·</span>
          Full catalog: <a href="/llms.txt" className="text-teal-400 hover:underline">/llms.txt</a> · <a href="/llms.json" className="text-teal-400 hover:underline">/llms.json</a>
        </p>
      </main>
    </>
  );
}
