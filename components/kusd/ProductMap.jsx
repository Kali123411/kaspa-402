// The three-layer product map (money / rails / market), shown once per page with the current layer marked.
import Link from 'next/link';
import { CLAIM, LAYERS } from '../../lib/kusd/story.mjs';

export default function ProductMap({ here, compact = false }) {
  return (
    <section aria-label="The three layers" className={compact ? '' : 'max-w-5xl mx-auto px-4 sm:px-6 py-10'}>
      {!compact && (
        <>
          <h2 className="font-orbitron text-2xl font-bold text-white">Three layers, one product</h2>
          <p className="mt-2 max-w-3xl text-sm text-gray-400">{CLAIM}</p>
        </>
      )}
      <div className={`grid gap-3 sm:grid-cols-3 ${compact ? '' : 'mt-5'}`}>
        {LAYERS.map((l) => {
          const current = l.key === here;
          const inner = (
            <>
              <div className="text-[11px] uppercase tracking-wider text-gray-500">{l.role}{current ? ' · you are here' : ''}</div>
              <div className="mt-1 font-semibold text-gray-100">{l.name}</div>
              {!compact && <p className="mt-1 text-xs leading-relaxed text-gray-400">{l.what}</p>}
            </>
          );
          const cls = `block rounded-xl border p-4 ${current ? 'border-neon-purple bg-neon-purple/10' : 'border-gray-800 bg-gray-900/60 hover:border-gray-600'}`;
          return l.href.startsWith('/')
            ? <Link key={l.key} href={l.href} className={cls} aria-current={current ? 'page' : undefined}>{inner}</Link>
            : <a key={l.key} href={l.href} className={cls} target="_blank" rel="noreferrer">{inner}</a>;
        })}
      </div>
    </section>
  );
}
