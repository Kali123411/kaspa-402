// One brand, one domain story (UI/UX brief, Phase 1 A). The protocol and the site are **k402** — short for Kaspa
// x402 v2, the standard it implements; the expansion appears once per page, other identifiers (x402 v2, KCC-0402, the
// kx402 npm payer) are explained where they are used, never used interchangeably with the brand.
export const BRAND = 'k402';
export const BRAND_EXPANSION = 'Kaspa x402 v2';
export const BRAND_LINE = `${BRAND} (${BRAND_EXPANSION})`;
export const SITE_NAME = 'kaspa-402.org';

// Shown once per page, under the header (Phase 1 E): prominent honesty reads as legitimate in crypto.
export const DISCLAIMER_BANNER = 'Testnet research software — unaudited, not for real value.';

// Where links leave the site.
export const EXTERNAL = {
  standard: 'https://kaspa-x402.org',
  sdk: 'https://github.com/elldeeone/kaspa-x402',
  k402Repo: 'https://github.com/kaspa-402/k402',
  siteRepo: 'https://github.com/kaspa-402/kaspa-402',
  kx402: 'https://www.npmjs.com/package/kx402',
};

/** The destination domain an external link is marked with ("↗ kaspa-x402.org"). */
export function externalLabel(href) {
  return new URL(href).hostname.replace(/^www\./, '');
}
