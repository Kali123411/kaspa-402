import { LAYERS } from '../lib/story';

/**
 * Three layers, one product (UI/UX brief, Phase 2 P1-5): kUSD (money) flows over k402 (rails, you are here) into the
 * market. Inline SVG, no motion, labels from the shared story data; links on each layer.
 */
export default function LayersDiagram() {
  const [money, rails, market] = LAYERS;
  const col = { x: [40, 300, 560], w: 200 };
  const box = (x, y, label, name, href, hot) => (
    <a href={href} key={name}>
      <rect x={x} y={y} width={col.w} height={78} rx={14} fill={hot ? 'rgba(45,212,191,0.10)' : 'rgba(255,255,255,0.03)'} stroke={hot ? '#2dd4bf' : '#374151'} strokeWidth={hot ? 1.5 : 1} />
      <text x={x + 16} y={y + 26} fill="#9ca3af" fontFamily="ui-monospace, monospace" fontSize="11" letterSpacing="1.5">{label.toUpperCase()}{hot ? ' · YOU ARE HERE' : ''}</text>
      <text x={x + 16} y={y + 54} fill={hot ? '#5eead4' : '#f3f4f6'} fontFamily="Geist, sans-serif" fontSize="18" fontWeight="700">{name}</text>
    </a>
  );
  return (
    <svg viewBox="0 0 800 200" role="img" aria-label={`Three layers: ${money.name} (money) flows over ${rails.name} (rails, you are here) into the ${market.name}.`} className="mt-5 w-full max-w-4xl text-gray-400">
      <title>Money flows over the rails into the market</title>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#2dd4bf" />
        </marker>
      </defs>
      {box(col.x[0], 40, money.role, money.name, money.url, false)}
      {box(col.x[1], 40, rails.role, 'k402', rails.url, true)}
      {box(col.x[2], 40, market.role, market.name, market.url, false)}
      {/* the money flows over the rails into the market */}
      <line x1={col.x[0] + col.w} y1={79} x2={col.x[1] - 4} y2={79} stroke="#2dd4bf" strokeWidth="1.5" markerEnd="url(#arrow)" />
      <line x1={col.x[1] + col.w} y1={79} x2={col.x[2] - 4} y2={79} stroke="#2dd4bf" strokeWidth="1.5" markerEnd="url(#arrow)" />
      <text x={col.x[0] + col.w + 50} y={28} textAnchor="middle" fill="#6b7280" fontFamily="ui-monospace, monospace" fontSize="10.5">priced in kUSD or KAS</text>
      <text x={col.x[1] + col.w + 50} y={28} textAnchor="middle" fill="#6b7280" fontFamily="ui-monospace, monospace" fontSize="10.5">HTTP 402 → pay → 200</text>
      {/* the chain under all three */}
      <rect x={40} y={146} width={720} height={34} rx={10} fill="rgba(255,255,255,0.02)" stroke="#1f2937" />
      <text x={400} y={168} textAnchor="middle" fill="#9ca3af" fontFamily="ui-monospace, monospace" fontSize="11.5" letterSpacing="1.5">KASPA L1 · COVENANTS · ≈1 S SETTLEMENT</text>
      <line x1={140} y1={118} x2={140} y2={146} stroke="#374151" strokeDasharray="3 3" />
      <line x1={400} y1={118} x2={400} y2={146} stroke="#374151" strokeDasharray="3 3" />
      <line x1={660} y1={118} x2={660} y2={146} stroke="#374151" strokeDasharray="3 3" />
    </svg>
  );
}
