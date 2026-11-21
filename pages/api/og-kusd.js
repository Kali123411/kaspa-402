// pages/api/og-kusd.js — the /kusd share card: 1200×630 on the site's graphite ground, the owner's kUSD mark
// (public/kusd/logo/kusd-mark.svg, embedded as a data URI: next/og cannot fetch relative paths) beside the claim.
// Same bundled Fraunces Light as /api/og; next.config traces the font and the logo into this function.
import { ImageResponse } from 'next/og';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const GROUND = '#16181D', TEXT = '#F2F3F5', MUTED = '#8B9099';
let cache = null;
function assets() {
  if (!cache) {
    const font = readFileSync(path.join(process.cwd(), 'lib/fonts/Fraunces-Light.woff'));
    const svg = readFileSync(path.join(process.cwd(), 'public/kusd/logo/kusd-mark.svg'));
    cache = { font, mark: `data:image/svg+xml;base64,${svg.toString('base64')}` };
  }
  return cache;
}

export default async function handler(req, res) {
  const { font, mark } = assets();
  const img = new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: 'flex', alignItems: 'center', background: GROUND, color: TEXT, fontFamily: 'Fraunces', padding: '0 80px', gap: 64 }}>
        <img src={mark} width={360} height={360} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 620 }}>
          <div style={{ fontSize: 112, letterSpacing: -4, lineHeight: 1 }}>kUSD</div>
          <div style={{ fontSize: 40, letterSpacing: -1.2, lineHeight: 1.15 }}>A dollar that lives inside Kaspa covenants, built for agents.</div>
          <div style={{ fontSize: 22, color: MUTED }}>testnet-10 · kaspa-402.org/kusd</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts: [{ name: 'Fraunces', data: font, weight: 300, style: 'normal' }] },
  );
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
  res.status(200).send(Buffer.from(await img.arrayBuffer()));
}
