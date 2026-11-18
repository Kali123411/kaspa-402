import { externalLabel } from '../lib/brand.mjs';

/** A link that leaves the site: marked ↗ with its destination domain, opened in a new tab. */
export default function ExternalLink({ href, children, className = 'text-teal-400 hover:underline', domainClassName = 'text-gray-500' }) {
  const domain = externalLabel(href);
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <span aria-hidden="true"> ↗</span>
      <span className={`ml-1 font-mono text-[0.8em] ${domainClassName}`}>{domain}</span>
      <span className="sr-only"> (opens {domain})</span>
    </a>
  );
}
