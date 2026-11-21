// The 10 Oct 2025 crash, replayed through kUSD's oracle and vault rules (lib/kusd/stress.mjs, a port of
// kusd-framework tools/stress/oct10_replay.py). Drag the time slider through the night; compare the lines TN10
// enforced before 21 November 2026 with any other pair, by default the live 200 / 170 (kusd-framework #56).
import { useEffect, useMemo, useState } from 'react';
import data from '../../public/kusd/oct10.json';
import { series, scenario, oraclePath, vaults, replay } from '../../lib/kusd/stress.mjs';
import { MARK, H3 } from '../Ledger';

const LIVE = { minRatio: 175, liqRatio: 150 };
const MAINNET = { minRatio: 200, liqRatio: 170 };
const SCENARIOS = [
  { id: 'real', label: 'As it happened', kind: 'real', depth: 0, note: 'KAS fell 87% in an hour, then came most of the way back.' },
  { id: 'hold43', label: 'Stuck 43% down', kind: 'hold', depth: 0.43, note: 'The real night until the close first hit 43% down, then no bounce. On the night it held there for 22 minutes.' },
  { id: 'hold50', label: 'Stuck 50% down', kind: 'hold', depth: 0.5, note: 'The real night until 50% down, then no bounce. On the night it held there for 17 minutes.' },
  { id: 'gap35', label: '35% gap', kind: 'gap', depth: 0.35, note: 'Flat, then 35% lower faster than one oracle refresh, and it stays there.' },
];
const SCALE_MAX = 300; // the ratio bars run 0–300%
const hhmm = (ts) => new Date(ts * 1000).toISOString().slice(11, 16);
const usd = (n) => `$${n.toFixed(2)}`;
const pct = (r) => `${Math.round(r)}%`;
const at = (r) => `${(Math.min(Math.max(r, 0), SCALE_MAX) / SCALE_MAX) * 100}%`;

function Chart({ frames, t }) {
  const W = 600;
  const H = 180;
  const hi = Math.max(...frames.map((f) => Math.max(f.close, f.liq))) * 1.05;
  const x = (i) => (i / (frames.length - 1)) * W;
  const y = (p) => H - (p / hi) * H;
  const line = (key) => frames.map((f, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(f[key]).toFixed(1)}`).join('');
  const f = frames[t];
  return (
    <figure className="mt-6">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-48 w-full border border-gray-800 bg-panel" role="img" aria-label="KAS market price and the oracle's liquidation price through the night">
        <path d={line('close')} fill="none" stroke="#858A94" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <path d={line('liq')} fill="none" stroke="#D1FF4A" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <line x1={x(t)} x2={x(t)} y1="0" y2={H} stroke="#F2F3F5" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[12px] text-gray-500">
        <span><span className="text-gray-600">━</span> market <span className="text-gray-200">${f.close.toFixed(4)}</span></span>
        <span><span className="text-accent">━</span> oracle liquidation price <span className="text-gray-200">${f.liq.toFixed(4)}</span></span>
        <span>{hhmm(f.ts)} UTC</span>
      </figcaption>
    </figure>
  );
}

function Bar({ label, r, frame, lines }) {
  const f = frame;
  const status = f.state === 'liquidated'
    ? `closed ${hhmm(r.liquidated.ts)} · keeper ${r.liquidated.keeperPnl >= 0 ? '+' : ''}${usd(r.liquidated.keeperPnl)} · nothing short`
    : f.state === 'liquidatable'
      ? (f.underwater ? `liquidatable, but underwater: no keeper will take it · ${usd(r.debt - r.collateral * f.market)} short now` : 'liquidatable: waiting for a keeper')
      : (f.underwater ? `underwater at the market, but the oracle hasn't followed · ${usd(r.debt - r.collateral * f.market)} short if it stuck` : 'healthy');
  const closed = f.state === 'liquidated';
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 font-mono text-[12px]">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-500">{closed ? 'closed' : <>market {pct(f.ratioMarket)} · oracle {pct(f.ratioOracle)}</>}</span>
      </div>
      <div className="relative mt-1 h-4 border border-gray-800 bg-ground">
        {!closed && <div className={`absolute inset-y-0 left-0 ${f.underwater ? 'bg-gray-600' : f.state === 'liquidatable' ? 'bg-gray-400' : 'bg-accent'}`} style={{ width: at(f.ratioMarket) }} />}
        {!closed && <div className="absolute inset-y-[-3px] w-[2px] bg-gray-100" style={{ left: at(f.ratioOracle) }} title="ratio at the oracle's liquidation price" />}
        {[[100, 'insolvent'], [lines.liqRatio, 'liquidation'], [lines.minRatio, 'borrowing']].map(([v, n]) => (
          <div key={n} className="absolute inset-y-0 border-l border-dashed border-gray-500" style={{ left: at(v) }} title={`${n} line ${v}%`} />
        ))}
      </div>
      <div className={`mt-1 font-mono text-[12px] ${f.underwater && !closed ? 'text-gray-100' : 'text-gray-500'}`}>{status}</div>
    </div>
  );
}

function Panel({ title, sub, lines, path, t, children }) {
  const p0 = path[0].close;
  const v = vaults(p0, lines);
  const max = { ...v.max, ...replay(path, { ...v.max, liqRatio: lines.liqRatio }) };
  const line = { ...v.line, ...replay(path, { ...v.line, liqRatio: lines.liqRatio }) };
  const end = (r) => (r.liquidated ? `closed ${hhmm(r.liquidated.ts)}, nothing short` : r.shortUsd > 0.005 ? `never closed, ${usd(r.shortUsd)} short` : 'never closed, exactly solvent');
  return (
    <div className="border border-gray-800 bg-panel p-5">
      <div className={MARK}>{sub}</div>
      <h3 className={`${H3} mt-1`}>{title}</h3>
      {children}
      <Bar label={`Borrowed to the max (${lines.minRatio}%)`} r={max} frame={max.frames[t]} lines={lines} />
      <Bar label={`Sitting at the liquidation line (${lines.liqRatio}%)`} r={line} frame={line.frames[t]} lines={lines} />
      <div className="mt-4 border-t border-gray-800 pt-3 font-mono text-[12px] text-gray-500">
        <div>By 02:00: max borrow {end(max)}; at the line {end(line)}.</div>
        <div>Each vault: 10,000 KAS of collateral.</div>
      </div>
    </div>
  );
}

export default function CrashReplay() {
  const rows = useMemo(() => series(data), []);
  const [sid, setSid] = useState('real');
  const sc = SCENARIOS.find((s) => s.id === sid);
  const path = useMemo(() => oraclePath(scenario(rows, sc), { refreshMin: 5 }), [rows, sc]);
  const [t, setT] = useState(72); // 21:21, the low
  const [mine, setMine] = useState(MAINNET);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => setT((v) => (v >= path.length - 1 ? (setPlaying(false), v) : v + 1)), 60);
    return () => clearInterval(id);
  }, [playing, path.length]);
  const setLine = (k) => (e) => {
    const n = Number(e.target.value);
    setMine((m) => (k === 'minRatio' ? { minRatio: n, liqRatio: Math.min(m.liqRatio, n - 5) } : { liqRatio: n, minRatio: Math.max(m.minRatio, n + 5) }));
  };
  const isMainnet = mine.minRatio === MAINNET.minRatio && mine.liqRatio === MAINNET.liqRatio;
  return (
    <div>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Scenario">
        {SCENARIOS.map((s) => (
          <button key={s.id} type="button" onClick={() => { setSid(s.id); setPlaying(false); }} aria-pressed={sid === s.id}
            className={`border px-3 py-1.5 font-mono text-[13px] ${sid === s.id ? 'border-accent text-accent' : 'border-gray-800 text-gray-300 hover:border-gray-500'}`}>{s.label}</button>
        ))}
      </div>
      <p className="mt-3 text-[14px] text-gray-300">{sc.note}</p>

      <Chart frames={path} t={t} />
      <div className="mt-3 flex items-center gap-4">
        <button type="button" onClick={() => { if (t >= path.length - 1) setT(0); setPlaying((p) => !p); }} className="border border-gray-800 px-3 py-1.5 font-mono text-[13px] text-gray-200 hover:border-accent">{playing ? 'Pause' : 'Play'}</button>
        <input type="range" min="0" max={path.length - 1} value={t} onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }} aria-label="Time, UTC" className="w-full accent-[#D1FF4A]" />
        <span className="font-mono text-[13px] tabular-nums text-gray-200">{hhmm(path[t].ts)}</span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="175% / 150%" sub="TN10 until 21 November 2026" lines={LIVE} path={path} t={t} />
        <Panel title={`${mine.minRatio}% / ${mine.liqRatio}%`} sub={isMainnet ? 'Live on TN10 since 21 November 2026 (kusd-framework #56)' : 'Your lines'} lines={mine} path={path} t={t}>
          <label className="mt-4 block font-mono text-[12px] text-gray-500">Borrowing line <span className="text-gray-200">{mine.minRatio}%</span>
            <input type="range" min="125" max="300" step="5" value={mine.minRatio} onChange={setLine('minRatio')} aria-label="Borrowing line" className="mt-1 block w-full accent-[#D1FF4A]" />
          </label>
          <label className="mt-2 block font-mono text-[12px] text-gray-500">Liquidation line <span className="text-gray-200">{mine.liqRatio}%</span>
            <input type="range" min="110" max="295" step="5" value={mine.liqRatio} onChange={setLine('liqRatio')} aria-label="Liquidation line" className="mt-1 block w-full accent-[#D1FF4A]" />
          </label>
          {!isMainnet && <button type="button" onClick={() => setMine(MAINNET)} className="mt-2 font-mono text-[12px] text-gray-500 underline underline-offset-4 hover:text-accent">back to the live 200 / 170</button>}
        </Panel>
      </div>

      <p className="mt-6 text-[13px] leading-relaxed text-gray-500">
        Bars show each vault&apos;s collateral ratio at the market price. The white tick is its ratio at the oracle&apos;s
        liquidation price, which may fall at most 25% an hour, so a minutes-long wick never reaches the vaults. Dashed
        marks: 100% (insolvent), the liquidation line and the borrowing line. A keeper closes a vault one minute after
        it becomes liquidatable, if the 110% it receives is worth more than the debt it burns. Oracle refresh every
        5 minutes. Data: KuCoin KAS-USDT one-minute candles. Method and caveats: docs/STRESS-2025-10-10.md in
        kusd-framework.
      </p>
    </div>
  );
}
