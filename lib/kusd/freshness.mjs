// The freshness badge's words (UI/UX brief, Phase 1 C). A `state` is what the page could establish about the data it
// shows; `source` is where it looked; the meaning says what "verified" is on this site: the box's address recomputed
// from its claimed state and found unspent on a TN10 node — never a server's say-so.
export const FRESHNESS_MEANING = {
  verified: 'Verified: this browser recomputed each box\'s address from the state shown and found that output unspent on a TN10 node.',
  unverified: 'Not verified: the values come from a published snapshot; nothing has checked them against a node yet, so treat them as a reading, not proof.',
  checking: 'Checking: the page is asking a TN10 node whether each box is still unspent; values are the last export until it answers.',
  moved: 'Moved: at least one box has been spent since this snapshot was exported, so some values here are behind the chain.',
  unreachable: 'Unreachable: the node or API did not answer, so the page shows its archived snapshot and cannot vouch for it.',
  partial: 'Partial: some boxes were confirmed unspent on a node, others could not be checked.',
};

const stamp = (iso) => `${String(iso).replace('T', ' ').slice(0, 16)} UTC`;

export function freshnessText({ state, source, ageSeconds, at }) {
  const age = ageSeconds != null ? `${ageSeconds}s ago` : at ? `from ${stamp(at)}` : '';
  switch (state) {
    case 'verified': return `verified against ${source}${age ? ` · ${age}` : ''}`;
    case 'unverified': return `not verified · ${source}${age ? ` ${age}` : ''}`;
    case 'checking': return `checking ${source}…`;
    case 'moved': return `chain has moved past this snapshot${at ? ` · exported ${stamp(at)}` : ''}`;
    case 'unreachable': return `${source} unreachable · showing the archived snapshot`;
    case 'partial': return `some boxes could not be checked${age ? ` · ${age}` : ''}`;
    default: return `${source}`;
  }
}

export const FRESHNESS_TONE = {
  verified: 'border-accent text-accent',
  unverified: 'border-dashed border-gray-500 text-gray-200',
  checking: 'border-gray-700 text-gray-400',
  moved: 'border-dashed border-gray-300 text-gray-100',
  unreachable: 'border-gray-600 text-gray-400',
  partial: 'border-dashed border-gray-500 text-gray-200',
};
