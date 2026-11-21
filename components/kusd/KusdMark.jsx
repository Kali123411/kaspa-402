// The kUSD logo (owner's set, 2026-11-21: the dollar drawn as a chain path threading three blocks). Below 32 px the
// simplified drawing (one block, heavier strokes) is used, as the set intends. Plain <img>: the SVGs are static files.
import Head from 'next/head';

const LOGO = '/kusd/logo';

export default function KusdMark({ size = 24, className = '', alt = 'kUSD' }) {
  const src = size < 32 ? `${LOGO}/kusd-mark-small-24.svg` : `${LOGO}/kusd-mark.svg`;
  return <img src={src} width={size} height={size} alt={alt} className={`inline-block shrink-0 ${className}`} />;
}

/** The kUSD favicon and touch icon for kUSD pages: `key="icon"` replaces the site's 402 favicon set in _app. */
export function KusdIcons() {
  return (
    <Head>
      <link rel="icon" href={`${LOGO}/kusd-mark-favicon-16.svg`} type="image/svg+xml" key="icon" />
      <link rel="alternate icon" href={`${LOGO}/kusd-favicon-32.png`} type="image/png" key="icon-png" />
      <link rel="apple-touch-icon" href={`${LOGO}/kusd-app-icon-1024.png`} key="apple-touch-icon" />
    </Head>
  );
}
