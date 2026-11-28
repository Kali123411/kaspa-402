# kUSD Whitepaper

Nov 27, 2026 · Mervin

## Summary

kUSD is a dollar-pegged token that lives entirely on Kaspa's base layer, backed by KAS locked in on-chain contracts rather than by a company's bank account. It is built for software agents first: an AI agent can hold it, price services in it, and pay for them per call over k402, without a bank, a card or a human approving each payment.

What makes it different is how much of it can be checked. Every rule that issues, burns or backs kUSD is enforced by Kaspa itself, the core rules are proved mathematically, and the whole system has run on Kaspa's testnet since November 2026.

kUSD is not live on mainnet. It is going to an independent security audit, and nothing here is an offer of any token or investment. This paper explains the idea for a general reader; the companion yellow paper specifies it in full.

## The problem

AI agents are starting to buy things for themselves: an API call, a dataset, an hour of GPU time, another agent's work. They need money that is stable enough to price in, cheap and fast enough to spend in small amounts, and usable by software without a person signing off.

Today's options each miss one of those:

- **Cards and bank transfers** need a human account holder, settle slowly and cost too much for a payment of a few cents.
- **KAS itself** is fast and cheap, but its price moves. An agent that budgets $10 for a task can find it worth $8 an hour later.
- **Dollar stablecoins** on other chains are stable, but they are issued by companies that can freeze balances, and reaching them from Kaspa means trusting a bridge.

Kaspa's Toccata upgrade, live on mainnet since June 30, 2026, added covenants: rules attached to coins that the network itself enforces. That makes it possible to build a dollar token whose issuance and backing are enforced by Kaspa's consensus, with no company or bridge in the middle. kUSD is that token.

## What kUSD is

One kUSD is designed to be worth one US dollar. It is created when someone borrows it against KAS, and destroyed when they pay it back.

- **A vault** is your own on-chain account holding KAS. You can borrow kUSD up to half the value of the KAS inside it (200 % collateral). You pay a one-time fee of 0.5 % when you borrow; there is no interest.
- **Repaying** burns the kUSD and lets you take your KAS back.
- **If KAS falls** far enough that a vault is below 170 % collateral, anyone can repay its debt and receive its KAS at a 10 % bonus. This is liquidation, and it is what keeps every kUSD backed by more than a dollar of KAS.
- **A swap module** (the PSM) lets anyone swap KAS for kUSD and back at the oracle price, up to limits set by how much backing it holds.

kUSD itself is an ordinary Kaspa token under the community KCC-20 standard, so wallets and other contracts can hold and move it like any other token. Its total supply is fixed forever at 5 billion; all of it is created once, held in reserve by the system, and released only when someone borrows it or swaps KAS for it.

## How an agent uses kUSD

k402 is a pay-per-call protocol for Kaspa, modelled on the web's long-reserved "402 Payment Required" status: a service quotes a price, the agent pays it on chain, and the service delivers. With kUSD, that price is in dollars, so an agent can budget, compare offers and keep accounts in the same unit people use.

![An agent pays for a result in one round trip, with no human approving it](whitepaper-k402-flow.svg)

The agent needs only a wallet holding kUSD and a little KAS for network fees. It never needs a bank account, a card, an API key or a human to approve each payment, and the service never has to trust the agent: it delivers after it sees the payment on chain.

Agents can also borrow kUSD against KAS they hold, or swap KAS for it through the swap module, and turn it back into KAS the same ways. Payment channels, which would let an agent make many small payments with one on-chain transaction at each end, are a proposed next step (KCC-0402) and not part of kUSD v1. People can use kUSD exactly the same way.

## What holds it near $1

kUSD stays near a dollar because there are always people who profit from pushing it back.

- **Above $1:** anyone can borrow kUSD against KAS, or swap KAS for it, and sell it for more than a dollar. New supply brings the price down.
- **Below $1:** vault owners can buy kUSD cheaply and use it to repay their debt at full value. Where the swap module holds backing, anyone can also redeem kUSD for a dollar's worth of KAS. Both remove supply and bring the price up.

**Prices.** The contracts need the KAS price, which comes from an oracle run by five operators. Every update needs at least three of them to agree, and the price the system uses can move only so fast: up by at most about 10 % an hour for borrowing, and down by at most about 25 % an hour for liquidations. That limits what even a group of dishonest operators could do. The system can also compare the operators' price with a price attested by Kaspa miners; at launch it records whether the two agree, without acting on it.

**Backstops.** Fees collected by the system go into three reserves that no one can move between: one covers liquidations where a vault's KAS no longer covers its debt, one pays the oracle operators, and one backs the swap module. Under the launch plan (below), the first and third are funded before the system opens.

**If the oracle stops.** If no price arrives for an hour, anyone can freeze borrowing and liquidation until a fresh price arrives. If none arrives for 30 days, anyone can settle the system for good at the last price, and every holder can then redeem kUSD for KAS from the vaults or the swap module, share and share alike. Getting out never depends on the team still being around.

## Why you can check it

Most stablecoins ask you to trust an issuer's reports. kUSD's rules are code that Kaspa's network enforces on every transaction, and that code has been checked in four independent ways before any audit.

| check | what it means | result |
| --- | --- | --- |
| Mathematical proofs | the key rules (supply never exceeds debt, vaults stay backed, prices move no faster than allowed, holders can always exit after settlement) are proved with the Lean proof assistant | 90 properties proved |
| Side-by-side testing | the proved model and the real contracts run the same 505,120 random steps and must agree on every one | 0 disagreements |
| Attack testing | 1.4 million random combinations of contract actions, plus hostile variants of every honest one, must all be refused unless they are honest | 0 accepted |
| Live testnet | the full system deployed on Kaspa's testnet and every action run for real | running since November 27, 2026 |

The testing found and fixed several real bugs along the way, including two ways funds could have been taken that no single contract got wrong on its own. That is what the checks are for.

Anyone can verify supply on chain without trusting an indexer: every kUSD and every vault is a Kaspa UTXO whose rules the network checks. Anyone with the code can rebuild the contracts, rerun the proofs and repeat the tests from scratch with one script. The audit package includes everything needed to do this.

## Who controls it

No one can change kUSD's code, print kUSD outside the rules, or touch anyone's vault. Governance can only adjust a short list of settings, such as borrowing limits and fees, inside hard limits written into the contracts.

- **Every increase waits 72 hours on chain,** where anyone can see it coming and leave first.
- **Decreases are immediate,** because lowering a limit only reduces risk.
- **Limits can at most double per step above their previous high,** with at least a week between such raises.
- **Two keys hold power:** a 2-of-3 governance group, and a single guardian key that can only reduce risk (pause for up to 72 hours, lower limits, cancel a pending change).

**The path to no keys.** Each governance power can be given up permanently, one at a time. The plan is for the keys to be held by the project's operating agent while the system is young, and renounced once it can run on its own, until there is nothing left to govern. After that, kUSD's settings are fixed and the system runs on its rules alone.

## Launch plan

kUSD will start small and grow only as fast as its backing does. The founder and at least one early backer plan to fund the system's reserves before it opens, so the safety nets work from the first day rather than filling slowly from fees.

**Starting limits.**

| setting | at launch |
| --- | --- |
| new kUSD per day | 10,000 |
| total borrowed from vaults | 100,000 |
| swap module capacity | 10,000 |
| borrowing fee | 0.5 %, one time |
| swap fee | 0.5 % |

Raising any of these takes a 72-hour on-chain notice and, to stay backed, matching growth in the reserves.

**Reserves funded before opening.** About $20,000 worth of KAS at launch limits: about $5,000 to the liquidation reserve, so liquidations that would otherwise lose money still happen, and about $15,000 to back the swap module, so kUSD can be redeemed for a dollar's worth of KAS from day one. These are donations to the protocol: they are not returned, and they give the donors no claim on the system, its fees or its governance.

**Investment.** The project intends to open to outside investors before mainnet, through a separate operating company, not through kUSD. kUSD has no owner revenue: there is no interest, and fees stay in the protocol's reserves. Any offer to investors will be made separately, on terms reviewed by counsel, and this paper is not one.

## Risks

kUSD can lose its peg, and money in it can be lost. These are the main ways, in plain words; the yellow paper lists all of them with measurements.

- **It isn't audited yet.** The checks above are thorough, but an independent audit is still ahead, and no amount of testing proves the absence of every bug.
- **A fast crash can outrun liquidations.** Prices the system uses move at most about 25 % an hour for liquidations, so in a sudden crash some vaults may fall below full backing before they can be liquidated. The liquidation reserve covers that loss only up to its size.
- **The oracle has to keep running.** If prices stop arriving and nobody freezes the system within about an hour, it keeps using the old price. A watchdog and a second independent price relay are planned for this.
- **Wallets need to be built for it.** Someone willing to spend about 16 KAS an hour can make price-dependent actions (borrowing, swapping, liquidating) fail for wallets that submit transactions the ordinary way. Wallets and liquidation bots that use Kaspa's replacement feature get through. That software has to exist before mainnet.
- **The peg is softest below $1.** Redeeming kUSD for a dollar's worth of KAS works only up to the swap module's backing; beyond that, the price below $1 depends on vault owners buying kUSD to repay.
- **Governance keys.** Until they are renounced, whoever holds two of the three governance keys can change settings within the hard limits, with 72 hours' notice. They cannot take funds from vaults or print kUSD outside the rules.
- **After a shutdown, kUSD is worth a fixed amount of KAS,** set at the last price, not a dollar.
- **Regulation.** Dollar stablecoins face new rules in the US and elsewhere, and how they apply to a system like this is not settled.

## Status and next steps

The contracts are finished and frozen for audit; what remains is the audit, the software around them, and the decisions that come before a mainnet launch.

| | status |
| --- | --- |
| Contracts, proofs and testing | done; frozen for audit on November 28, 2026 |
| Testnet deployment | live on Kaspa TN10 since November 27, 2026 |
| Independent security audit | next |
| Liquidation bot and wallet support | to build |
| Second price relay and watchdog | to set up |
| Reserve funding and governance key holders | to decide before mainnet |
| Legal review | before mainnet |
| Mainnet | no date; after all of the above |

## Important notice

This paper describes software under development. kUSD is not available on Kaspa mainnet, has not been audited, and should not be used with real value. Nothing in this paper is an offer to sell, or a solicitation to buy, any token, security or other investment, and nothing here is financial, legal or tax advice. kUSD is not issued by a bank or a regulated stablecoin issuer, is not insured, and is not guaranteed by anyone; its design aims to keep it near one US dollar, but it can trade below or above that. Figures describe the testnet design frozen for audit and may change. Where this paper and the technical specification differ, the specification governs.
