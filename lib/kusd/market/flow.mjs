// The market console follows the wallet's review sheet (components/kusd/app/ReviewSheet.jsx: status
// building → review → sending → done | error; close() → null). This reducer decides what that means for the
// reservation the console made before asking the wallet to sign, with k402's rule: void only when nothing can
// have been signed; once sending began, the money may have moved, so the row stays.
//
// pending: { id, quote, body, txid: string|null, sending: bool, finished: bool }

export function followSheet(p, sheet) {
  if (!p || p.finished) return { type: 'noop' };
  if (sheet === null) {
    if (p.txid) return { type: 'noop' };                                     // closed after a broadcast: already settled
    if (p.sending) return { type: 'unknown', reason: 'the review closed while the wallet was sending' };
    return { type: 'void', reason: null };                                   // closed before signing
  }
  switch (sheet.status) {
    case 'sending':
      return p.sending ? { type: 'noop' } : { type: 'sending' };
    case 'done':
      if (sheet.txid && !p.txid) return { type: 'settle', txid: String(sheet.txid).toLowerCase() };
      return { type: 'noop' };
    case 'error':
      return p.sending ? { type: 'unknown', reason: sheet.error ?? null } : { type: 'void', reason: sheet.error ?? null };
    default:
      return { type: 'noop' };                                               // building / review: wait
  }
}
