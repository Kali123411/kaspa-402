// The three-layer product map (money / rails / market), shown once per page with the current layer marked.
import Link from 'next/link';
import { CLAIM, LAYERS } from '../../lib/kusd/story.mjs';
import { H2, H3, MARK } from '../Ledger';

export default function ProductMap({ here, compact = false }) {
  return (
    <section aria-label="The three layers">
      {!compact && (
        <>
          <h2 className={H2}>Three layers, one product</h2>
          <p className="mt-2 max-w-[70ch] text-[15px] leading-relaxed text-gray-400">{CLAIM}</p>
        </>
      )}
      <div className={`grid gap-8 sm:grid-cols-3 ${compact ? '' : 'mt-5'}`}>
        {LAYERS.map((l) => {
          const current = l.key === here;
          const inner = (
            <>
              <div className={MARK}>{l.role}{current ? ' · you are here' : ''}</div>
              <div className={`mt-1 ${H3}`}>{l.name}</div>
              {!compact && <p className="mt-2 text-[14.5px] leading-relaxed text-gray-400">{l.what}</p>}
            </>
          );
          const cls = `block border-t py-4 ${current ? 'border-accent' : 'border-gray-800 hover:border-gray-500'}`;
          return l.href.startsWith('/')
            ? <Link key={l.key} href={l.href} className={cls} aria-current={current ? 'page' : undefined}>{inner}</Link>
            : <a key={l.key} href={l.href} className={cls} target="_blank" rel="noreferrer">{inner}</a>;
        })}
      </div>
    </section>
  );
}
