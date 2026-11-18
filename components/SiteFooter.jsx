import { EXTERNAL } from '../lib/brand.mjs';
import ExternalLink from './ExternalLink';

/** The one footer every page renders (UI/UX brief, Phase 1 E): the same links everywhere, machine endpoints first. */
export default function SiteFooter() {
  const ext = 'hover:text-teal-400';
  return (
    <footer className="mx-auto mt-16 max-w-5xl border-t border-gray-800 px-6 pb-10 pt-6 font-mono text-[12px] text-gray-500">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <a href="/get-started" className={ext}>get set up</a>
        <a href="/llms.txt" className={ext}>/llms.txt</a>
        <a href="/llms.json" className={ext}>/llms.json</a>
        <a href="/kusd" className={ext}>money · kUSD</a>
        <a href="/market" className={ext}>market</a>
        <a href="/validate" className={ext}>validate</a>
        <a href="/private" className={ext}>pay privately</a>
        <ExternalLink href={EXTERNAL.standard} className={ext}>standard</ExternalLink>
        <ExternalLink href={EXTERNAL.k402Repo} className={ext}>k402 code</ExternalLink>
        <ExternalLink href={EXTERNAL.sdk} className={ext}>SDK</ExternalLink>
        <ExternalLink href={EXTERNAL.siteRepo} className={ext}>this site</ExternalLink>
      </div>
      <p className="mt-3 text-[11.5px] text-gray-600">Mainnet listings on this site settle real KAS; nothing on this site is audited. Not financial advice.</p>
    </footer>
  );
}
