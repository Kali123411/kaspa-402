// What a built transaction does, in words, for the review sheet the user signs from.
const PROTOCOL_LABEL = { psm: 'PSM reserve', oracle: 'oracle (read)', receipt: 'price receipt (read)', budget: 'mint budget', authority: 'kUSD authority', surplus: 'surplus (PSM fee)', factory: 'vault factory' };
const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const usd = (cents) => (cents / 100).toFixed(2);
const kas = (sompi) => String(sompi / 1e8);
const same = (a, b) => a.transactionId === b.transactionId && a.index === b.index;

function boxLabel(kind, state, owner) {
  if (PROTOCOL_LABEL[kind]) return PROTOCOL_LABEL[kind];
  const mine = toHex(state.owner) === owner;
  if (kind === 'holder') return mine ? `your kUSD box (${usd(state.amount)} kUSD)` : `kUSD box for ${toHex(state.owner).slice(0, 8)}… (${usd(state.amount)} kUSD)`;
  if (kind === 'vault') return `${mine ? 'your vault' : 'a vault'} (${kas(state.collateral)} KAS collateral, $${usd(Math.ceil(state.debt_mc / 1000))} debt as last settled)`;
  return kind;
}

/** `built`: the kusd-client build output; `request`: the build request it came from; `owner`: x-only hex. */
export function describeTx(built, { request, owner }) {
  const { protocol = {}, coins = [], params = {} } = request;
  const known = [
    ...Object.entries(protocol).filter(([kind]) => kind !== 'receipts').map(([kind, l]) => ({ outpoint: l.outpoint, sompi: l.value, what: PROTOCOL_LABEL[kind] })),
    ...(protocol.receipts || []).map((l) => ({ outpoint: l.outpoint, sompi: l.value, what: PROTOCOL_LABEL.receipt })),
    ...[params.holder, ...(params.holders || [])].filter(Boolean).map((l) => ({ outpoint: l.outpoint, sompi: l.value, what: boxLabel('holder', l.state, owner) })),
    ...[params.vault].filter(Boolean).map((l) => ({ outpoint: l.outpoint, sompi: l.value, what: boxLabel('vault', l.state, owner) })),
    ...coins.map((c) => ({ outpoint: c.outpoint, sompi: c.entry.amount, what: 'your KAS' })),
  ];
  const inputs = built.tx.inputs.map((i) => {
    const k = known.find((x) => same(x.outpoint, i.previousOutpoint));
    return k ? { what: k.what, sompi: k.sompi } : { what: 'an input this page did not choose', sompi: null };
  });
  const ownSpk = `000020${owner}ac`;
  const outputs = built.tx.outputs.map((o, index) => {
    const c = built.created.find((x) => x.index === index);
    if (c) return { what: boxLabel(c.kind, c.state, owner), sompi: o.value };
    return { what: o.scriptPublicKey === ownSpk ? 'your KAS change' : 'KAS to another address', sompi: o.value };
  });
  const known_ = inputs.every((i) => i.sompi !== null);
  const sum = (xs) => xs.reduce((s, x) => s + x.sompi, 0);
  // net for the user, from the transaction itself: spendable KAS (own coins in vs own change out) and kUSD
  const ownHolders = (list) => list.filter((h) => h && toHex(h.state.owner) === owner).reduce((s, h) => s + h.state.amount, 0);
  const kasIn = coins.filter((c) => built.tx.inputs.some((i) => same(i.previousOutpoint, c.outpoint))).reduce((s, c) => s + c.entry.amount, 0);
  const kasOut = built.tx.outputs.filter((o, index) => o.scriptPublicKey === ownSpk && !built.created.some((c) => c.index === index)).reduce((s, o) => s + o.value, 0);
  const spentHolders = [params.holder, ...(params.holders || [])].filter((h) => h && built.tx.inputs.some((i) => same(i.previousOutpoint, h.outpoint)));
  const kusdCents = ownHolders(built.created.filter((c) => c.kind === 'holder')) - ownHolders(spentHolders);
  return { inputs, outputs, feeSompi: known_ ? sum(inputs) - sum(outputs) : null, clock: built.tx.lockTime, net: { kasSompi: kasOut - kasIn, kusdCents } };
}
