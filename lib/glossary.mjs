// The site's one glossary (UI/UX brief, Phase 1 B): every term the pages use without defining it. `<Term id>` shows the
// `short` line as a tooltip on hover/focus at a term's first use on a page; /glossary lists everything. Keep `short`
// to one plain sentence; put the detail in `long`.
export const GLOSSARY = [
  { id: 'covenant', term: 'covenant', short: 'A Kaspa output whose script enforces rules on how it can be spent; kUSD, its vaults and the market are built from them.', long: 'Kaspa L1 covenants (KIP-10 style script, Argent compiled) let an output carry state and insist that whoever spends it recreates a successor with the state the rules allow. Every kUSD box is a covenant output.' },
  { id: 'box', term: 'box', short: 'One covenant output holding state: a kUSD balance, a vault, the oracle, the peg module.', long: 'kUSD has no account balances; your kUSD is a set of boxes your key can spend. Paying creates a new box for the payee.' },
  { id: 'psm', term: 'PSM', short: 'Peg stability module: swaps KAS for kUSD and back at the oracle price, with a small fee.', long: 'The PSM holds a KAS reserve; swap_in mints kUSD against KAS at the mint price, swap_out redeems at the liquidation price. Governance sets its ceiling and fee.' },
  { id: 'token-authority', term: 'token authority', short: 'The covenant that holds all unissued kUSD and alone can issue more.', long: 'Issuance happens only by spending the authority through the PSM or a vault; the amount it still holds is the unissued supply.' },
  { id: 'surplus-pot', term: 'surplus pot', short: 'Where protocol revenue lands: PSM fees, origination fees and the 3% liquidation share.', long: 'A governance-controlled box; spending it is a 2-of-3 governance transaction recorded on the page.' },
  { id: 'origination-fee', term: 'origination fee', short: 'A one-time fee on each borrow, paid in KAS from the vault\'s collateral to the surplus pot; there is no interest.', long: 'Governance sets it, at most 2% of the amount borrowed (0.5% to start). The price receipt a borrow reads carries the rate in force, and a vault owes exactly what it borrowed until it repays.' },
  { id: 'mint-price', term: 'mint price', short: 'The price the PSM and vaults mint at: the oracle price, allowed to rise at most 10% per hour, so one manipulated hour cannot mint cheap kUSD.' },
  { id: 'liq-price', term: 'liquidation price', short: 'The price vaults are judged at for liquidation and redemption: the oracle price, allowed to fall at most 25% per hour.' },
  { id: 'lock-time', term: 'lock time', short: 'A transaction field the network enforces: it cannot be included before that DAA score, so it proves a lower bound on time.', long: 'The oracle and the budget read time from the transaction\'s own lock time instead of trusting a clock input.' },
  { id: 'script-hash', term: 'script hash', short: 'What a covenant address is: a hash of the script and its state. Recompute it to check a claimed state.', long: 'The page and the relay recompute every box\'s address from the state they claim and compare it with the chain.' },
  { id: 'compute-mass', term: 'compute mass', short: 'Kaspa\'s measure of how much script work a transaction does; capped at 500,000 per transaction.', long: 'Covenant transactions pay fees by compute mass; the metering table shows each flow\'s mass against the cap.' },
  { id: 'miner-median', term: 'miner median', short: 'The KAS/USD price Kaspa miners voted in their blocks, proven over a 6,000-block window and posted on chain.', long: 'Stage 2 of the oracle: when the miner median is fresh and at least half the blocks voted, every price refresh is clamped to within 5% of it.' },
  { id: 'kvot', term: 'KVOT', short: 'The 13-byte price vote a miner puts in a block\'s coinbase payload.', long: '"KVOT", a version byte and the USD/KAS price in millionths. Any pool can add it; the window prover reads them all.' },
  { id: 'stage', term: 'Stage 1 / Stage 2', short: 'Stage 1: five signed operator prints, median of three. Stage 2: the same, clamped to the miner median.', long: 'The retired deployments on this page are earlier stages kept as evidence; the live family is Stage 2.' },
  { id: 'spendpolicy', term: 'SpendPolicy', short: 'The operator\'s limits an agent pays inside: per-call ceiling, budgets, call caps, allowed capabilities, a kill switch.', long: 'Set per browser (or per agent process); the agent cannot exceed it, and the freeze switch stops all payments at once.' },
  { id: 'sliding-window', term: 'sliding window', short: 'A budget that counts spending over the last N minutes, so bursts are capped as well as totals.' },
  { id: 'unserved', term: 'served / unserved', short: 'A payment the provider answered (served) or took without answering (unserved); unserved payments stop an agent\'s policy.' },
  { id: 'x402-v2', term: 'x402 v2', short: 'The HTTP 402 payment protocol k402 implements: the server names how to pay, the client pays and retries with proof.', long: 'k402 is short for Kaspa x402 v2. The standard is published at kaspa-x402.org; KCC-0402 is the Kaspa convention number.' },
  { id: 'payment-required', term: 'PAYMENT-REQUIRED', short: 'The 402 response header carrying the ways to pay (scheme, network, amount, payTo) as base64 JSON.' },
  { id: 'payto', term: 'payTo', short: 'The address (KAS) or key (kUSD) a payment must reach for the resource to be served.' },
  { id: 'scheme', term: 'scheme', short: 'How a payment is made: `exact` (one transaction), `batch-settlement` (vouchers), `kusd-utxo` (a kUSD box).' },
  { id: 'sompi', term: 'sompi', short: 'The smallest unit of KAS: 100,000,000 sompi = 1 KAS.' },
  { id: 'groth16', term: 'Groth16', short: 'A zero-knowledge proof system with tiny proofs that Kaspa scripts can verify on chain.' },
  { id: 'trusted-setup', term: 'trusted setup', short: 'The one-time ceremony a Groth16 circuit needs; if a single party ran it, that party could forge proofs.' },
  { id: 'shielded-pool', term: 'shielded pool', short: 'A covenant that holds deposits as commitments so a withdrawal cannot be linked to the deposit that funded it.' },
  { id: 'anonymity-set', term: 'anonymity set', short: 'Everyone a withdrawal could have come from: the deposits in the pool at the time.' },
  { id: 'proof-of-innocence', term: 'proof-of-innocence', short: 'A proof that a note belongs to an approved set, so a pool can screen deposits without learning which one is spent.' },
];

export const byId = Object.fromEntries(GLOSSARY.map((g) => [g.id, g]));
