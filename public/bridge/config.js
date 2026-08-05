// Kaspa-402 Bridge frontend — network + contract configuration.
// v1.2 STACK (CERTIFIED on mainnet 2026-08-05). Two properties this version proves on-chain:
//   1. Checkpoint freshness is PERMISSIONLESS — the escrow's Kaspa trust anchor advances by proof alone
//      (updateCheckpoint 0x7288617e…), with no owner key and no multisig ceremony.
//   2. Proving is PERMISSIONLESSLY PAID — the prover's payout address is committed INSIDE the proof and
//      bound into its Fiat-Shamir transcript, so the unlock fee goes to whoever produced the proof rather
//      than to whoever relays it (ProverPaid 8e13 wei in unlock 0x955458ba…). Front-running it is futile.
// Certified loop: lock 0x18d2bf47 -> mint cf159952 -> keyless burn db50a9e6 -> N=94002/K=49 finality proof
//   -> updateCheckpoint 0x7288617e -> unlock 0x955458ba (verified through the prevCheckpoint grace slot).
window.BRIDGE_CONFIG = {
  eth: {
    chainId: "0x1",               // Ethereum L1 mainnet
    chainName: "Ethereum",
    // The v1.2 witness-minimal EthKaspaEscrow (vkey 0x00a612ae…): deposits AND burn-proof unlocks.
    // Owner: 2-of-3 Safe 0xF522B33C… (no recurring owner duties — refresh is permissionless).
    escrow: "0x55C4A294d6359d66d77618235D167fb56F6F0e28",
    unlockEscrow: "0x55C4A294d6359d66d77618235D167fb56F6F0e28",   // same contract (one escrow serves both legs)
    sp1Verifier: "0x81867073A06386636E729d79B1a2596EE404B07a",
    vkey: "0x00a612aea242e315bc69d2f52f11c02536f584a0c19be1ac9298b60fa883cc03",
    explorer: "https://etherscan.io",
    rpc: "https://ethereum-rpc.publicnode.com",
    escrowAbi: [
      "function lock(bytes32 recipient) external payable returns (uint64 id)",
      "function unlock(bytes calldata publicValues, bytes calldata proof) external",
      "function updateCheckpoint(bytes calldata publicValues, bytes calldata proof) external",
      "function totalLocked() view returns (uint256)",
      "function depositCount() view returns (uint64)",
      "function trustedCheckpoint() view returns (bytes32)",
      "function prevCheckpoint() view returns (bytes32)",
      "function kaspaLightClientVKey() view returns (bytes32)",
      "function minDepth() view returns (uint32)",
      "function minAnchors() view returns (uint32)",
      "function minWork() view returns (uint256)",
      "function feeBps() view returns (uint256)",
      "function minFee() view returns (uint256)",
      "function unlocked(bytes32) view returns (bool)",
      "event Locked(uint64 indexed id, bytes32 indexed recipient, uint256 amount)",
      "event Unlocked(bytes32 indexed nonce, address indexed ethRecipient, uint256 amount)",
      "event CheckpointRefreshed(bytes32 indexed oldCheckpoint, bytes32 indexed newCheckpoint, uint32 advanceDepth)"
    ],
    // the certified v1.2 loop (surfaced on the page as provenance):
    provenLockTx:    "0x18d2bf479f15a26ce17c4151ae16817e396b50039dad8a64846ef68f81235316",
    provenMintTx:    "cf159952e5af547586de83a03c690722dc95abcd654d7e52b24ccb404b6c9090",
    provenBurnTx:    "db50a9e625c0cea805fb40001134c34458aa606f3cadef82ffb2a654c9348c42",
    provenRefreshTx: "0x7288617ee3d081af923266535c84eab608dfe39d4f0f83e7af1b8b05a2137440",
    provenUnlockTx:  "0x955458ba1900e005a17e038c730db9f354e5a7b2f5bffb3a249f7631a551571c"
  },
  kaspa: {
    network: "kaspa_mainnet",     // KasWare network id
    apiBase: "https://api.kaspa.org",
    // v1.2 canonical Kaspa stack (token-covid-bound §7.8 registry; mainnet, 2026-08-05):
    burnRegistryCovid: "f0566d36143e41eb634ccc7f98b290fd7cb0b53068d2e0d2c7b4adae8dcfe1ba",
    wethCovid:         "2651f0bc87fe917723b17a11500da31edb6a4fe41509f76ae43863fe1ae16996",
    permMinterCovid:   "19e3a670babddbc8c890f4ff53e5562e3b0c058a0d7251ee7844035d214ef0e1",
    bridgeCovid:       "f0f7ab8c85ebcc3755c961926d8d05a3e6f3785a554d48cb49d64dc5b2ae274c",
    // canonical kcc20 note template + the registry's masked-state read params
    wethTemplateHash:  "36205a78ae657a7f1db798f6c52925ca82aca7361df71ef6a8202ce05aa7ec5f",
    wethMaskedTmpl:    "8278cbec0f4b2faa5b642161b45e4a8ca351bf7c82d217649ddc8ed44fbd8cfa",
    wethSuf: 1523,
    explorer: "https://explorer.kaspa.org"
  },
  // Minted wETH notes: the RELAYER is authoritative (GET {relayer}/notes — live chainstate). The baked
  // list stays EMPTY; the page still live-checks each note's UTXO on-chain before showing "held".
  weth: {
    tokenCovid:  "2651f0bc87fe917723b17a11500da31edb6a4fe41509f76ae43863fe1ae16996",
    minterCovid: "19e3a670babddbc8c890f4ff53e5562e3b0c058a0d7251ee7844035d214ef0e1",
    mints: []
  },
  // Fee model: bps + floor ON UNLOCK ONLY (lock is fee-free; minted 1:1). proverBps of it goes to the
  // address the proof names; the remainder accrues to the protocol. No KAS-side flat fee.
  fee: {
    proverBps: 8000,   // share of the unlock fee paid to the address named IN the proof
    feeBps: 10, minFeeWei: "100000000000000", flatKas: 0, ethFeeWei: "0",
    burnService: "https://burn-api.kaspa-402.org",
    kaspaAddress: null, feePubkey: null
  },
  // The relayer drives everything hands-off: mints, permissionless checkpoint refresh, burial-gated
  // unlocks. Local dev: http://localhost:8802. Production: bridge-api.kaspa-402.org (tunnel).
  relayer: (location.hostname === "localhost" || location.hostname.startsWith("192.168."))
    ? "http://localhost:8802" : "https://bridge-api.kaspa-402.org",
  // burial policy (mirrors the escrow immutables; used for the claim progress bar)
  burial: { minDepth: 86400, minAnchors: 49, minWorkFloat: 1.8385e22, chainBlocksPerSec: 1.56 },
  finality: { lambda: 50, beta: 0.33, k: 49, seconds: 4.9 }
};
