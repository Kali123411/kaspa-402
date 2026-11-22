// Quotes and vault figures, mirroring kusd-client math.rs / the covenants exactly (integer math, prices
// in 1e-4 USD per KAS). BigInt inside: collateral × price passes 2^53.
const MIN_RATIO = 200n; // borrowing and withdrawing stop here (vault.ag MIN_RATIO, at the mint price)
export const LIQ_RATIO = 170; // liquidatable under this (vault.ag LIQ_RATIO, at the liquidation price)
const MAX_DEBT = 40_000_000_000n;
// a vault with debt holds at least 5 KAS, enough to pay a full liquidation (vault.ag MIN_COLLATERAL)
export const MIN_COLLATERAL = 500_000_000;
// stability fee (oracle.ag / vault.ag): the oracle's rate index, 1e9 = 1.0; a vault's debt is kept in
// milli-cents (debt_mc) with the index it was settled at (index_at), and what it owes now is that debt
// rebased to the current index, rounded up to the cent only when it is paid
export const INDEX_SCALE = 1_000_000_000;
const MC = 1000n;
export const MIN_DEBT = 100;
// a repayment box may hold this many cents above the debt and still clear the vault (kusd-client REPAY_SLACK);
// more is refused by the builder, so a wrong box is never burned whole
export const REPAY_SLACK = 5;
const SURGE_TOP_BPS = 250n; // psm.ag: the swap-in rate at an empty mint budget
const big = BigInt;

const usdCentsOf = (sompi, price) => ((big(sompi) / 100n) * big(price)) / 100_000_000n;
const sompiOf = (cents, price) => ((big(cents) * 1_000_000n) / big(price)) * 10_000n;
const sompiOfCeil = (cents, price) => ((big(cents) * 1_000_000n + big(price) - 1n) / big(price)) * 10_000n;
const ratio = (collateral, debt, price) => (debt > 0 ? Number((usdCentsOf(collateral, price) * 100n) / big(debt)) : null);

/** vault.ag owed_mc: `debtMc` settled at `indexAt`, rebased to `index`, rounded up to the milli-cent. */
export function owedMc(debtMc, indexAt, index) {
  const [d, a, i] = [debtMc, indexAt, index].map(big);
  const q = d / a;
  const r = d % a;
  return Number(q * i + (r * i + a - 1n) / a);
}
/** vault.ag owed_cents: whole cents, rounded up. */
export const owedCents = (mc) => Number((big(mc) + MC - 1n) / MC);
/** What `vault` ({debt_mc, index_at}) owes now, in cents, against `oracle` ({index}). */
export function vaultOwed(vault, oracle) {
  if (!vault.debt_mc) return 0;
  return owedCents(owedMc(vault.debt_mc, vault.index_at, oracle.index ?? INDEX_SCALE));
}
/**
 * How a kUSD box of `boxCents` repays `vault`: all of it (up to REPAY_SLACK cents of excess, kept by the
 * protocol), part of it, or not at all (`tooBig`: split it first).
 */
export function repayPlan(vault, oracle, boxCents) {
  const mc = owedMc(vault.debt_mc, vault.index_at, oracle.index ?? INDEX_SCALE);
  const owed = owedCents(mc);
  if (boxCents > owed + REPAY_SLACK) return { owed, full: false, excess: boxCents - owed, remaining: 0, tooBig: true };
  if (boxCents >= owed) return { owed, full: true, excess: boxCents - owed, remaining: 0 };
  return { owed, full: false, excess: 0, remaining: owedCents(mc - boxCents * 1000) };
}

// The PSM fee switch (psm.ag swap_out_fee): fee = kas * spread_bps / 10000, to the surplus box.
const psmFee = (sompi, spreadBps) => (big(sompi) * big(spreadBps)) / 10_000n;

// psm.ag surge_fee (swap_in_fee): spread_bps while at least half the day's budget is left, then rising in a
// straight line to 2.5% at empty; each cent pays the average rate over the span it uses (milli-bps).
function psmFeeIn(sompi, cents, spreadBps, limit, avail) {
  const [kas, c, s, L, A] = [sompi, cents, spreadBps, limit, avail].map(big);
  const x1 = A < L / 2n ? A : L / 2n;
  const hi = A - x1 < c ? A - x1 : c;
  const lo = c - hi;
  const climb = SURGE_TOP_BPS > s ? SURGE_TOP_BPS - s : 0n;
  const surge = lo > 0n ? (climb * (L - x1 - (A - c)) * 1000n) / L : 0n;
  const eff = (c * s * 1000n + lo * surge) / c;
  const units = kas / 10_000n;
  return units * (eff / 1000n) + (units * (eff % 1000n)) / 1000n;
}

/**
 * KAS → kUSD through the PSM at the mint price: `sompi` to the reserve, `fee` to the surplus, `total` paid.
 * `budget` ({limit, avail}: the day's mint budget, refilled, before this buy) prices the rising part of the fee.
 */
export function swapInQuote(cents, oracle, spreadBps = 0, budget = null) {
  const sompi = sompiOfCeil(cents, oracle.mint);
  const fee = spreadBps && budget && cents > 0 && budget.limit > 0 ? psmFeeIn(sompi, cents, spreadBps, budget.limit, budget.avail) : psmFee(sompi, spreadBps);
  return { sompi: Number(sompi), fee: Number(fee), total: Number(sompi + fee), price: oracle.mint };
}
/**
 * Cents' worth a redemption of `cents` pays (psm.ag swap_out): all of them while the reserve, valued at the
 * liquidation price, covers everything the PSM issued; otherwise every redeemer's equal share.
 */
export function redemptionCents(cents, minted, reserveSompi, liqPrice) {
  const reserveUsd = usdCentsOf(reserveSompi, liqPrice);
  const c = big(cents);
  if (reserveUsd >= big(minted)) return Number(c);
  return Number((c * ((reserveUsd * 10_000n) / big(minted))) / 10_000n);
}

/**
 * kUSD → KAS through the PSM at the liquidation price: `sompi` gross, `fee` to the surplus, `net` received. With the
 * PSM box (`psm`: {value, state}) a short reserve pays pro rata: `paidCents` and `coveragePct` say how much.
 */
export function swapOutQuote(cents, oracle, spreadBps = 0, psm = null) {
  let paidCents = cents;
  let coveragePct = 100;
  if (psm && psm.state.minted > 0) {
    const reserve = Number(psm.value) - TOMBSTONE;
    paidCents = redemptionCents(cents, psm.state.minted, reserve, oracle.liq);
    coveragePct = Math.min(100, Math.floor(Number((usdCentsOf(reserve, oracle.liq) * 100n) / big(psm.state.minted))));
  }
  const sompi = sompiOf(paidCents, oracle.liq);
  const fee = psmFee(sompi, spreadBps);
  return { sompi: Number(sompi), fee: Number(fee), net: Number(sompi - fee), price: oracle.liq, paidCents, coveragePct };
}

/** Cents the vault-debt ceiling still has room for (budget.ag: vault_ceiling − vault_debt), or null without a budget. */
export function vaultCeilingRoom(budget) {
  if (!budget || budget.vault_ceiling == null || budget.vault_debt == null) return null;
  return Math.max(0, budget.vault_ceiling - budget.vault_debt);
}

/**
 * `vault` is a vault state ({collateral, debt_mc, index_at}); `oracle` an oracle state; `budget` (optional) the budget
 * state, whose vault-debt ceiling also caps the next mint. Figures are at what is owed now.
 */
export function vaultView(vault, oracle, budget) {
  const { collateral } = vault;
  const debt = vaultOwed(vault, oracle);
  const usdAtMint = usdCentsOf(collateral, oracle.mint);
  const capacity = (usdAtMint * 100n) / MIN_RATIO;
  const room = vaultCeilingRoom(budget);
  const caps = [capacity - big(debt), MAX_DEBT - big(debt)];
  if (room !== null) caps.push(big(room));
  const maxMint = caps.reduce((a, b) => (a < b ? a : b));
  let liquidatesBelow = null;
  if (debt > 0) {
    // the lowest liquidation price at which usd_cents_of(collateral, p) * 100 >= debt * LIQ_RATIO
    const needCents = (big(debt) * big(LIQ_RATIO) + 99n) / 100n;
    const perUnit = big(collateral) / 100n;
    liquidatesBelow = perUnit === 0n ? null : Number((needCents * 100_000_000n + perUnit - 1n) / perUnit);
  }
  return {
    owedCents: debt,
    ratioAtMint: ratio(collateral, debt, oracle.mint),
    ratioAtLiq: ratio(collateral, debt, oracle.liq),
    liquidatesBelow,
    maxMintCents: Number(maxMint > 0n ? maxMint : 0n),
  };
}

const DAY_DAA = 864_000n;

/** The mint budget refilled at `clock` (budget.ag budget_refill), in cents; 0 before its last refill. */
export function budgetAvail(protocol, clock) {
  const b = protocol.budget.state;
  if (clock < b.last) return 0;
  const elapsed = [big(clock) - big(b.last), DAY_DAA].reduce((x, y) => (x < y ? x : y));
  const refilled = big(b.available) + (big(b.limit) * elapsed) / DAY_DAA;
  return Number(refilled < big(b.limit) ? refilled : big(b.limit));
}

/** The swap-in fee rate (bps) for the next cent bought at `clock`: the spread above half the budget, rising below. */
export function swapInRate(protocol, clock) {
  const s = big(protocol.psm.state.spread);
  if (s === 0n) return 0;
  const L = big(protocol.budget.state.limit);
  const A = big(budgetAvail(protocol, clock));
  if (L <= 0n || 2n * A >= L) return Number(s);
  const climb = SURGE_TOP_BPS > s ? SURGE_TOP_BPS - s : 0n;
  return Number(s + (climb * (L - 2n * A)) / L);
}

/**
 * How much KAS → kUSD the protocol accepts at build clock `clock` (virtual DAA − 10): the PSM's room under
 * its ceiling, the refilled mint budget and the authority's unissued supply — the builder's own checks.
 */
export function swapInLimits(protocol, clock) {
  const psm = protocol.psm.state;
  const budgetCents = budgetAvail(protocol, clock);
  // the ceiling, and since the hardening the share cap: floor + share_bps of the budget's vault debt (psm.ag swap_in)
  let psmHeadroomCents = psm.ceiling - psm.minted;
  if (psm.share_bps != null && psm.floor != null) {
    const cap = psm.floor + Math.floor((psm.share_bps * (protocol.budget.state.vault_debt ?? 0)) / 10_000);
    psmHeadroomCents = Math.min(psmHeadroomCents, cap - psm.minted);
  }
  psmHeadroomCents = Math.max(0, psmHeadroomCents);
  const issuableCents = Math.max(0, protocol.authority.state.amount);
  return { psmHeadroomCents, budgetCents, issuableCents, maxCents: Math.min(psmHeadroomCents, budgetCents, issuableCents) };
}

// a new holder box carries 1.5 KAS: the 1 KAS every kUSD box keeps plus its own fee (kusd-client HOLDER_VALUE)
const HOLDER_VALUE = 150_000_000;
const TOMBSTONE = 100_000_000;
const FEE = 10_000_000;
// kusd-client coins::PER_INPUT_FEE: each coin a flow spends adds this to the fee (the node's relay floor grows with
// inputs). The estimate counts one coin; the WASM builder charges the exact count and refuses if the wallet is short.
const PER_INPUT_FEE = 150_000;

/**
 * KAS (sompi) a flow takes from the wallet's coins — the amount kusd-client's coin selection must cover. A buy
 * priced at build clock `clock` pays the budget's rising fee; without a clock, the flat spread.
 */
export function fundingNeed(flow, params, protocol, clock = null) {
  switch (flow) {
    case 'swap_in': {
      const budget = clock === null ? null : { limit: protocol.budget.state.limit, avail: budgetAvail(protocol, clock) };
      return swapInQuote(params.cents, protocol.oracle.state, protocol.psm.state.spread, budget).total + HOLDER_VALUE + FEE + PER_INPUT_FEE;
    }
    case 'open_vault': return params.collateral + TOMBSTONE + FEE + PER_INPUT_FEE;
    case 'adjust': return FEE + PER_INPUT_FEE + Math.max(params.delta, 0);
    case 'mint': return HOLDER_VALUE + FEE + PER_INPUT_FEE;
    default: return 0;
  }
}

/** Refuse before building when the wallet's coins can't cover `need` sompi. */
export function checkFunds(coins, need) {
  const have = coins.reduce((s, c) => s + c.entry.amount, 0);
  const kas = (s) => `${(s / 1e8).toLocaleString('en-US', { maximumFractionDigits: 8 })} KAS`;
  if (have < need) throw new Error(`this needs ${kas(need)} including fees; you have ${kas(have)}`);
}

// Borrowing stops at 200% and liquidation waits for 170%, so a maximum borrow has 15% of room. The app
// still aims at 250% and asks before going under 225%: a liquidation costs about 13% of the debt.
export const SAFE_RATIO = 250;
export const CONFIRM_BELOW = 225;

/** kUSD (cents) this vault can borrow and stay at SAFE_RATIO at the mint price. */
export function safeBorrowCents(vault, oracle, budget) {
  const capacity = (usdCentsOf(vault.collateral, oracle.mint) * 100n) / big(SAFE_RATIO);
  const room = Number(capacity) - vaultOwed(vault, oracle);
  return Math.max(0, Math.min(room, vaultView(vault, oracle, budget).maxMintCents));
}

/** After borrowing `cents` more: the ratio, the liquidation threshold and how far KAS may fall (%) first. */
export function borrowRisk(vault, oracle, cents) {
  // the vault after minting `cents`: the debt so far rebased at the index, plus the mint, settled now
  const index = oracle.index ?? INDEX_SCALE;
  const after = vaultView({ ...vault, debt_mc: (vault.debt_mc ? owedMc(vault.debt_mc, vault.index_at, index) : 0) + cents * 1000, index_at: index }, oracle);
  const below = after.liquidatesBelow;
  const drop = below === null ? 100 : Math.max(0, Math.floor(((oracle.liq - below) * 1000) / oracle.liq) / 10);
  return { ratioAfter: after.ratioAtMint, liquidatesBelow: below, dropPct: drop, needsConfirm: after.ratioAtMint !== null && after.ratioAtMint < CONFIRM_BELOW };
}
