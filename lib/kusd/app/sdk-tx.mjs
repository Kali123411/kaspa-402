// Hand a kusd-client transaction (consensus JSON from the WASM `build`) to the Kaspa WASM SDK, which the
// browser submits through. Built with the SDK's own constructor so every field the txid covers —
// compute budgets, covenant bindings, lock time — carries over exactly (the tests check the txid).
const HEX = /^[0-9a-f]*$/;

function spk(hex) {
  if (typeof hex !== 'string' || hex.length < 4 || hex.length % 2 || !HEX.test(hex)) {
    throw new Error(`malformed scriptPublicKey '${String(hex).slice(0, 16)}'`);
  }
  return { version: parseInt(hex.slice(0, 4), 16), script: hex.slice(4) };
}

/** `sdk` is the initialised Kaspa WASM SDK module (public/kaspa-rpc/kaspa.js). */
export function toSdkTransaction(tx, sdk) {
  return new sdk.Transaction({
    version: tx.version,
    inputs: tx.inputs.map((i) => ({
      previousOutpoint: { transactionId: i.previousOutpoint.transactionId, index: i.previousOutpoint.index },
      signatureScript: i.signatureScript,
      sequence: BigInt(i.sequence),
      sigOpCount: 0,
      computeBudget: i.computeBudget,
    })),
    outputs: tx.outputs.map((o) => ({
      value: BigInt(o.value),
      scriptPublicKey: spk(o.scriptPublicKey),
      ...(o.covenant ? { covenant: new sdk.CovenantBinding(o.covenant.authorizingInput, new sdk.Hash(o.covenant.covenantId)) } : {}),
    })),
    lockTime: BigInt(tx.lockTime),
    subnetworkId: tx.subnetworkId,
    gas: BigInt(tx.gas),
    payload: tx.payload,
  });
}
