// The interactive 402 demo's words (UI/UX brief, Phase 2 P0-3): one unpaid request to a listed service, shown as the
// terminal transcript an agent would see. Nothing is paid by the page; the last line says what an agent does next.
export function decodeOffer(b64) {
  try {
    const j = JSON.parse(Buffer.from(String(b64), 'base64').toString('utf8'));
    return j && Array.isArray(j.accepts) ? j : null;
  } catch {
    return null;
  }
}

const kas = (amount) => `${(Number(amount) / 1e8).toFixed(8).replace(/0+$/, '').replace(/\.$/, '')} KAS`;

export function transcript({ url, status, latencyMs, paymentRequired }) {
  const lines = [`$ curl -si "${url}"`];
  if (status === 402) {
    lines.push(`HTTP/2 402 Payment Required   (${latencyMs} ms)`);
    if (paymentRequired) {
      lines.push(`payment-required: ${String(paymentRequired).slice(0, 48)}…`);
      const offer = decodeOffer(paymentRequired);
      if (offer) {
        lines.push('# decoded: accepts[] =');
        for (const a of offer.accepts) {
          const amt = a.asset === 'KAS' || !a.asset ? kas(a.amount) : `${a.amount} ${a.asset.slice(0, 8)}…`;
          lines.push(`#   ${a.scheme} · ${a.network} · ${amt} → ${a.payTo}`);
        }
      } else {
        lines.push('# (the offer did not decode as x402 v2 JSON)');
      }
    } else {
      lines.push('# 402 without a payment-required header: not an x402 v2 paywall');
    }
    lines.push('# an agent now pays one accepts[] entry on Kaspa L1 and retries with PAYMENT-SIGNATURE → HTTP 200 (≈1 s)');
  } else if (status == null) {
    lines.push('# no response: the service did not answer within 9 s');
  } else {
    lines.push(`HTTP/2 ${status}   (${latencyMs} ms)`);
    lines.push('# no paywall: an unpaid request was served (or refused) without a 402');
  }
  return lines;
}
