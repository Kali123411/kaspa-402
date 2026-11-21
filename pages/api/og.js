// pages/api/og.js — the share card (identity design, E1's mark): a 1200×630 charcoal card with one acid "402" and the claim.
// Rendered on request with next/og from the bundled Fraunces Light (lib/fonts, a static WOFF instance; SIL Open Font License). Satori needs a font file and cannot read the variable TTF.
import { ImageResponse } from 'next/og';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const GROUND = '#16181D', TEXT = '#F2F3F5', MUTED = '#8B9099', ACCENT = '#D1FF4A';
let fontData = null;
function fraunces() {
  if (!fontData) fontData = readFileSync(path.join(process.cwd(), 'lib/fonts/Fraunces-Light.woff'));
  return fontData;
}
// the owner's k402 symbol (public/k402/logo), embedded as a data URI: next/og cannot fetch relative paths
let symbolData = null;
function symbol() {
  if (!symbolData) symbolData = `data:image/svg+xml;base64,${readFileSync(path.join(process.cwd(), 'public/k402/logo/k402-symbol-white.svg')).toString('base64')}`;
  return symbolData;
}

export default async function handler(req, res) {
  const font = fraunces();
  const img = new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: 'flex', flexDirection: 'column', background: GROUND, color: TEXT, fontFamily: 'Fraunces', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 40, top: -70, fontSize: 560, lineHeight: 1, letterSpacing: -34, color: ACCENT }}>402</div>
        <div style={{ position: 'absolute', left: 64, bottom: 56, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 44, letterSpacing: -1.5, lineHeight: 1.1, maxWidth: 820 }}>Payment Required is not an error. It is the price list.</div>
          <div style={{ fontSize: 22, color: MUTED }}>k402 — agents pay services per call on Kaspa L1 · kaspa-402.org</div>
        </div>
        <div style={{ position: 'absolute', right: 64, top: 44, display: 'flex', alignItems: 'center', gap: 12, fontSize: 40, letterSpacing: -1.5 }}><img src={symbol()} width={46} height={46} />k402</div>
      </div>
    ),
    { width: 1200, height: 630, fonts: [{ name: 'Fraunces', data: font, weight: 300, style: 'normal' }] },
  );
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
  res.status(200).send(Buffer.from(await img.arrayBuffer()));
}
