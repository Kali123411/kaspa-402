// components/RoutingCast.js — plays the recorded failover cast (lib/failoverCast.js) in a themed
// terminal window: an agent auto-routing across two independent providers and failing over live.
// Self-contained (no player lib); animates with requestAnimationFrame, loops, respects reduced-motion.
import { useEffect, useRef, useState } from 'react';
import { FAILOVER_CAST, CAST_DURATION } from '../lib/failoverCast';

const PAL = { 31: '#ff6b63', 32: '#43d18a', 36: '#4aa8ff', 245: '#8a94a2', 256: { 44: '#00f0ff', 245: '#8a94a2' } };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function ansiToHtml(s) {
  const re = /\x1b\[([0-9;]*)m/g;
  let out = '', last = 0, m, st = { bold: false, dim: false, color: null };
  const span = (txt) => {
    if (!txt) return '';
    let css = '';
    if (st.bold) css += 'font-weight:700;';
    if (st.dim) css += 'opacity:.55;';
    if (st.color) css += 'color:' + st.color + ';';
    return css ? `<span style="${css}">${esc(txt)}</span>` : esc(txt);
  };
  const apply = (code) => {
    const p = code.split(';');
    if (code === '' || p[0] === '0') { st = { bold: false, dim: false, color: null }; return; }
    if (p[0] === '38' && p[1] === '5') { st.color = PAL[256][p[2]] || st.color; return; }
    for (const c of p) { if (c === '1') st.bold = true; else if (c === '2') st.dim = true; else if (PAL[c]) st.color = PAL[c]; }
  };
  while ((m = re.exec(s))) { out += span(s.slice(last, m.index)); apply(m[1]); last = re.lastIndex; }
  return out + span(s.slice(last));
}

export default function RoutingCast() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  // start animating only once scrolled into view (saves cycles off-screen)
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { threshold: 0.25 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !visible) {
      if (reduce) el.innerHTML = ansiToHtml(FAILOVER_CAST.map((e) => e[1]).join(''));
      return;
    }
    let raf, start = null;
    const frame = (now) => {
      if (start === null) start = now;
      const elapsed = (now - start) / 1000;
      let buf = '';
      for (const [t, data] of FAILOVER_CAST) { if (t <= elapsed) buf += data; else break; }
      el.innerHTML = ansiToHtml(buf) + '<span class="rc-cursor"></span>';
      el.scrollTop = el.scrollHeight;
      if (elapsed >= CAST_DURATION + 2.6) start = null; // loop
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  return (
    <div className="glass overflow-hidden rounded-2xl border border-teal-400/20 shadow-glow-cyan">
      <div className="flex items-center gap-2 border-b border-teal-400/10 bg-gray-950/80 px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-[#ff5f56]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="ml-2 font-mono text-[12px] text-gray-500">agent — pay_best(&quot;summarize&quot;)</span>
        <span className="ml-auto font-mono text-[10.5px] tracking-[0.14em] text-teal-400">● REPLAY</span>
      </div>
      <pre ref={ref} className="m-0 h-[380px] overflow-hidden whitespace-pre-wrap break-words bg-gray-950/60 px-4 py-3.5 font-mono text-[12.5px] leading-relaxed text-gray-300" />
      <style jsx global>{`
        .rc-cursor { display:inline-block; width:7px; height:14px; margin-bottom:-2px; background:#00f0ff; animation:rcblink 1s steps(1) infinite; }
        @keyframes rcblink { 50% { opacity:0; } }
        @media (prefers-reduced-motion: reduce) { .rc-cursor { animation:none; } }
      `}</style>
    </div>
  );
}
