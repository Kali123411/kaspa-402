// Kaspa-402 Bridge frontend — network + contract configuration.
// Both legs are LIVE on mainnet: the EthKaspaEscrow on Ethereum L1, the wETH token + burn registry on Kaspa.
// The return leg (Kaspa->ETH) is proven end-to-end — a real wETH burn unlocked ETH via SP1 Groth16 (tx 0xc9f28b7e).
window.BRIDGE_CONFIG = {
  eth: {
    chainId: "0x1",               // Ethereum L1 mainnet — EthKaspaEscrow deployed 2026-07-26
    chainName: "Ethereum",
    escrow: "0x51328cC5995EDE52968A444d605659cFC3e3A571",
    sp1Verifier: "0xDF87326CF4942605d8166B0413832b235Ec6a87a",
    explorer: "https://etherscan.io",
    // minimal ABI — only what the frontend calls / reads
    escrowAbi: [
      "function lock(bytes32 recipient) external payable returns (uint64 id)",
      "function unlock(bytes calldata publicValues, bytes calldata proof) external",
      "function totalLocked() view returns (uint256)",
      "function depositCount() view returns (uint64)",
      "function trustedCheckpoint() view returns (bytes32)",
      "function minDepth() view returns (uint32)",
      "event Locked(uint64 indexed id, bytes32 indexed recipient, uint256 amount)",
      "event Unlocked(bytes32 indexed nonce, address indexed ethRecipient, uint256 amount)"
    ]
  },
  kaspa: {
    network: "kaspa_mainnet",     // KasWare network id
    apiBase: "https://api.kaspa.org",
    burnRegistryCovid: "1cca9cfec96e2f06da2a23d6363b511a9cafaf0d59da89003f0da24c0cc30bc9",
    wethTemplateHash:  "36205a78ae657a7f1db798f6c52925ca82aca7361df71ef6a8202ce05aa7ec5f",
    // mainnet covenants (2026-07-26): canonical KCC20 wETH + the mint-direction light client + authority
    wethCovid:         "a8b21d3050d2072e267ef1a31ffaf405955502b837710883193f8113ac146140",
    bridgeCovid:       "523af31d2064937c94a6c8535bdc2cbc8318c4d912e292c390965f9d86303eff",
    mintAuthorityCovid:"f3bc2b89943e83e2c2821ca3df9e5c359f73689fa0e230b836c1219ebe61295c",
    explorer: "https://explorer.kaspa.org"
  },
  // Minted wETH — canonical, proof-gated KCC20 notes (covid A), each 1:1 backed by a proven ETH deposit.
  // No external wallet indexes silverscript-KCC20 covenant notes yet, so the bridge surfaces its own mints
  // here and does a LIVE on-chain check that each note UTXO is still held (unspent) at its covenant address.
  weth: {
    tokenCovid:  "a8b21d3050d2072e267ef1a31ffaf405955502b837710883193f8113ac146140",
    minterCovid: "51277d92e2b3ed9f3b084ff99a8ef1e606289909031bb8dbfda08826a8f944ab",
    // Re-issued 2026-07-27 on silverscript 2a3961c (adds #143 template-hash hardening + #154 leader-entrypoint
    // hardening) so the note template matches the current canonical KCC20 standard the DEX validates against.
    // The prior token (covid 4b3be42e, template 8130334e) was on the pre-#143/#154 base; its notes are retired
    // (their ETH backing was already withdrawn via the return leg). This genesis note is operator-held.
    mints: [
      {
        amountEth: "0.0007", units: "700000000000000", reissue: true,
        recipient:     "d94d02625649d3bc428158fb2a42e3b53703e3fa19e67c6996e69ff79cb61f71",
        recipientAddr: "kaspa:qrv56qnz2eya80zzs9v0k2jzuw6nwqlrlgv7vlrfjmnflauukc0hzffhan3rm",
        noteAddr:  "kaspa:pzycdx74p5scx9vkcp2646c8j0u809gej4l5ny82la0k344qa73vcy87zfpy7",
        noteTxid:  "8e1b1640214608e37d5fee986e5f5b2a129bae6f4273d2170a45b10d39d499e4", noteIdx: 0,
        mintTxid:  "8e1b1640214608e37d5fee986e5f5b2a129bae6f4273d2170a45b10d39d499e4"
      }
    ]
  },
  // baked-in bridge fee (Kasplex-style flat fee). KAS-side leg = a 0.5-KAS fee output in the burn tx;
  // ETH-side leg = the escrow's immutable feeFlat (wei), taken on lock + unlock.
  fee: {
    flatKas: 0.5, ethFeeWei: "0", burnService: "http://localhost:8790",
    kaspaAddress: "kaspa:qz7v9j9dddsqams8tswzgvadau00drmjkv3ux7p2q24j4xrd5wyscdmnzdcd9",
    // x-only pubkey decoded from the fee address (version 0 P2PK) — the burn bin's FEE_PUBKEY
    feePubkey: "bcc2c8ad6b600eee075c1c2433adef1ef68f72b323c3782a02ab2a986da3890c",
  },
  // the off-chain proving/relayer endpoint (optional). If set, the frontend can poll bridge status; if null,
  // proving is done out-of-band (CLI) and the frontend just shows the on-chain deposit/burn it submitted.
  relayer: null,
  finality: { lambda: 50, beta: 0.33, k: 49, seconds: 4.9 }
};
