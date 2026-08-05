// Kaspa-402 Bridge frontend — network + contract configuration.
// v1.1 STACK (CERTIFIED on mainnet 2026-08-04): ONE escrow handles BOTH legs — lock (ETH->Kaspa) and
// unlock (Kaspa->ETH) — and checkpoint freshness is PERMISSIONLESS (proof-gated updateCheckpoint,
// certified live: tx 0xfbab1edd…, 267k gas). Full certified loop: lock 0x859b0d94 -> mint 7d892be3 ->
// keyless burn 8f8c0d52 -> N=94002/K=49 finality proof -> updateCheckpoint -> unlock 0x990858ea (grace).
window.BRIDGE_CONFIG = {
  eth: {
    chainId: "0x1",               // Ethereum L1 mainnet
    chainName: "Ethereum",
    // The v1.1 witness-minimal EthKaspaEscrow (vkey 0x00572816…): deposits AND burn-proof unlocks.
    // Owner: 2-of-3 Safe 0xF522B33C… (no recurring owner duties — refresh is permissionless).
    escrow: "0xf71207ba86005832C38cdB34Fb9171de2B2538EA",
    unlockEscrow: "0xf71207ba86005832C38cdB34Fb9171de2B2538EA",   // same contract in v1.1
    sp1Verifier: "0x81867073A06386636E729d79B1a2596EE404B07a",
    vkey: "0x0057281633cc011bf2db6ba80d2cbabe9460d932be33b3623472cfe12de07d9c",
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
    // the certified v1.1 loop (surfaced on the page as provenance):
    provenLockTx:    "0x859b0d943ecfd045323d66e1540102233474b80e71577c5c51a4eb0a867b114b",
    provenMintTx:    "7d892be396d0c23fd0b97f7f68436ba4abcb173f6f68aabde7732cfae06e181b",
    provenBurnTx:    "8f8c0d526563d982e44a3693648207a60e3dc926e0e62584bd9f5c08767d476f",
    provenRefreshTx: "0xfbab1edde8befdadc411138b2ba8efea1e23bde54ab10bd5fcf74382d85ccce6",
    provenUnlockTx:  "0x990858ea2c8b620d7e4b289d1845eceec09695cb9672b1fc33985b7092fa9acc"
  },
  kaspa: {
    network: "kaspa_mainnet",     // KasWare network id
    apiBase: "https://api.kaspa.org",
    // v1.1 canonical Kaspa stack (token-covid-bound §7.8 registry; mainnet, 2026-08-04):
    burnRegistryCovid: "d75af3fac77ef3f9ff36c5f0a23b9502f31a944d41d496f8dc32f84cd09af9e4",
    wethCovid:         "4b65cbda0aa170563d1f3e5421445a1a2e507ff20dc11179b0d6b657ddb09728",
    permMinterCovid:   "0b9df0884251370e15bf13eab6ae4b7b5edd7da4d2a27a2e925be0d896433906",
    bridgeCovid:       "f0f7ab8c85ebcc3755c961926d8d05a3e6f3785a554d48cb49d64dc5b2ae274c",
    // canonical kcc20 note template + the registry's masked-state read params
    wethTemplateHash:  "36205a78ae657a7f1db798f6c52925ca82aca7361df71ef6a8202ce05aa7ec5f",
    wethMaskedTmpl:    "8278cbec0f4b2faa5b642161b45e4a8ca351bf7c82d217649ddc8ed44fbd8cfa",
    wethSuf: 1523,
    explorer: "https://explorer.kaspa.org"
  },
  // Minted wETH notes: the RELAYER is authoritative (GET {relayer}/notes — live chainstate). The baked
  // list stays EMPTY in v1.1; the page still live-checks each note's UTXO on-chain before showing "held".
  weth: {
    tokenCovid:  "4b65cbda0aa170563d1f3e5421445a1a2e507ff20dc11179b0d6b657ddb09728",
    minterCovid: "0b9df0884251370e15bf13eab6ae4b7b5edd7da4d2a27a2e925be0d896433906",
    mints: []
  },
  // v1.1 fee model: bps + floor ON UNLOCK ONLY (lock is fee-free; minted 1:1). No KAS-side flat fee.
  fee: {
    feeBps: 10, minFeeWei: "100000000000000", flatKas: 0, ethFeeWei: "0",
    burnService: "https://burn-api.kaspa-402.org",
    kaspaAddress: null, feePubkey: null
  },
  // The relayer drives everything hands-off: mints, permissionless checkpoint refresh, burial-gated
  // unlocks. Local dev: http://localhost:8802. Production hostname to be routed via the tunnel (M4).
  relayer: (location.hostname === "localhost" || location.hostname.startsWith("192.168."))
    ? "http://localhost:8802" : "https://bridge-api.kaspa-402.org",
  // burial policy (mirrors the escrow immutables; used for the claim progress bar)
  burial: { minDepth: 86400, minAnchors: 49, minWorkFloat: 1.8385e22, chainBlocksPerSec: 1.56 },
  finality: { lambda: 50, beta: 0.33, k: 49, seconds: 4.9 }
};
