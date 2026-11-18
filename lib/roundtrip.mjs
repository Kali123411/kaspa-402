// One real kUSD round trip on testnet-10, recorded 2026-11-18 with the k402 payer, phase by phase (wall clock from the
// first request). The landing replays it; nothing in the replay is invented. Raw: docs/uiux/roundtrip-2026-11-18-kusd-summarize.json
export const RECORDING = {
  network: 'testnet-10',
  endpoint: 'https://summarize.kaspa-402.org/summarize',
  cents: 5,
  t_402: 0.348,
  t_sent: 7.357,
  t_200: 15.135,
  txid: 'd01fc924fd48e3fb8d6bc6f0eb2f60389613307bcb2d8d3af796a2e7146610c8',
  result_bytes: 284,
  recorded_at: '2026-11-18T19:59:56Z',
};

/** the replay runs this many times faster than the recording; the page says so */
export const REPLAY_SPEED = 4;

// half-up on the recording's millisecond stamps (15.135 → 15.14), not the float's 15.1349…
const s = (x) => `${(Math.round(Math.round(x * 1000) / 10) / 100).toFixed(2)} s`;
const shortTx = (tx) => `${tx.slice(0, 8)}…${tx.slice(-6)}`;

/** @returns {{at:string, t:number, text:string, sub:string, status?:'402'|'200'}[]} */
export function replayRows(rec = RECORDING) {
  const host = rec.endpoint.replace(/^https?:\/\//, '').split('/')[0];
  const path = '/' + rec.endpoint.split('/').slice(3).join('/');
  return [
    { at: s(0), t: 0, text: `POST ${path}  (unpaid)`, sub: `an agent asks ${host} for work, with no account and no key` },
    { at: s(rec.t_402), t: rec.t_402, status: '402', text: '402 Payment Required', sub: `the price is in the response: ${(rec.cents / 100).toFixed(2)} kUSD to the provider's key` },
    { at: s(rec.t_sent), t: rec.t_sent, text: 'payment broadcast', sub: `the agent builds a ${(rec.cents / 100).toFixed(2)} kUSD covenant box and sends it · tx ${shortTx(rec.txid)}` },
    { at: s(rec.t_200), t: rec.t_200, status: '200', text: 'POST again, with the proof → 200 OK', sub: `the provider verified the box on a node and did the work · ${rec.result_bytes} bytes back` },
  ];
}
