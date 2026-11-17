// The wallet's spendable coins in kusd-client form, from Kaspa SDK UTXO entries (getUtxosByAddresses).
const spkHex = (s) => s.version.toString(16).padStart(4, '0') + s.script;

/** `ownSpk`: the wallet's P2PK script in client hex (`000020<xonly>ac`). Covenant boxes are never coins. */
export function coinsFromUtxos(utxos, ownSpk) {
  return utxos
    .filter((u) => !(u.entry?.covenantId ?? u.covenantId) && spkHex(u.scriptPublicKey) === ownSpk)
    .map((u) => ({
      outpoint: { transactionId: u.outpoint.transactionId, index: u.outpoint.index },
      entry: { amount: Number(u.amount), scriptPublicKey: ownSpk, blockDaaScore: Number(u.blockDaaScore), isCoinbase: u.isCoinbase, covenantId: null },
    }));
}
