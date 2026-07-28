// Kaspa-402 Bridge frontend — network + contract configuration.
// Live on Kaspa mainnet: the wETH KCC20 token, the proof-gated mint, and the value-absorption burn registry.
// Mint (ETH->Kaspa) is end-to-end on mainnet: a real ETH deposit -> SP1 Helios proof -> canonical wETH note
//   (reference mint tx bea05e92742c2ad475925e499a91541ef459601bca51952e67fbc1a1ee902e12).
// Return leg (Kaspa->ETH): the wETH burn + exact-value registry absorb is live on mainnet (reference burn tx
//   d1938ddf41ac4e3019515c846ac76cb91df3ccb7cc1a959a331c3154afa3d44b). The burn is a TWO-PARTY co-sign (the
//   note owner + the covenant governance), and the ETH unlock is gated on a ~1-3h Kaspa finality proof, so the
//   return leg is operator-assisted (initiated + proven off-chain), not yet self-serve from the browser.
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
    // LIVE Tier-2 mainnet stack (2026-07-28). Covid provenance: reproducible from each covenant's launch proof.
    burnRegistryCovid: "2fda4298b781bd389f15cde2b4bd9cfec4b2886daa3d9c9ea585e2de7d2955cd",
    wethTemplateHash:  "36205a78ae657a7f1db798f6c52925ca82aca7361df71ef6a8202ce05aa7ec5f",
    wethCovid:         "6e0d2649c4b29136ea96a0757ba3dd52a640fc3a52c35df16741a91156f1321e",
    bridgeCovid:       "58231a18cca8acfb5d58fbc6b1170eeb42268139be74e0ed3ce5784005cdca99",
    mintAuthorityCovid:"b8f2231e2733800647d788ead59ebb42c52ca379622e9c93feb3a2354ab73d20",
    explorer: "https://explorer.kaspa.org"
  },
  // Minted wETH — canonical, proof-gated KCC20 notes (covid A), each 1:1 backed by a proven ETH deposit.
  // No external wallet indexes silverscript-KCC20 covenant notes yet, so the bridge surfaces its own mints
  // here and does a LIVE on-chain check that each note UTXO is still held (unspent) at its covenant address.
  weth: {
    tokenCovid:  "6e0d2649c4b29136ea96a0757ba3dd52a640fc3a52c35df16741a91156f1321e",
    minterCovid: "b8f2231e2733800647d788ead59ebb42c52ca379622e9c93feb3a2354ab73d20",
    // Canonical, DEX-compliant KCC20 wETH (note template 36205a78), each note proof-gated 1:1 against a real
    // SP1 Helios storage proof of an ETH deposit — minted by the live Tier-2 stack (bridge 58231a18 ->
    // minter b8f2231e -> token 6e0d2649). The frontend live-checks each note UTXO is still held (unspent).
    mints: [
      {
        amountEth: "0.0002", units: "200000000000000",
        recipient:     "d94d02625649d3bc428158fb2a42e3b53703e3fa19e67c6996e69ff79cb61f71",
        recipientAddr: "kaspa:qrv56qnz2eya80zzs9v0k2jzuw6nwqlrlgv7vlrfjmnflauukc0hzffhan3rm",
        noteAddr:  "kaspa:prjphf289mdlz4wtl2ssygap99keu78yp8gyn047ww6ssjzggfz9cq3m3egap",
        noteTxid:  "a0fef7c448449e69453b0e09239b65c873dfccef85ab2fa9c162d6385313eade", noteIdx: 1,
        mintTxid:  "a0fef7c448449e69453b0e09239b65c873dfccef85ab2fa9c162d6385313eade",
        ethDepositId: 1, ethBlock: null, ethTxid: null
      }
    ]
  },
  // baked-in bridge fee (Kasplex-style flat fee). KAS-side leg = a 0.5-KAS fee output in the burn tx;
  // ETH-side leg = the escrow's immutable feeFlat (wei), taken on lock + unlock.
  fee: {
    flatKas: 0.5, ethFeeWei: "0", burnService: null,   // return leg is operator-assisted (no browser self-serve burn)
    kaspaAddress: "kaspa:qz7v9j9dddsqams8tswzgvadau00drmjkv3ux7p2q24j4xrd5wyscdmnzdcd9",
    // x-only pubkey decoded from the fee address (version 0 P2PK) — the burn bin's FEE_PUBKEY
    feePubkey: "bcc2c8ad6b600eee075c1c2433adef1ef68f72b323c3782a02ab2a986da3890c",
  },
  // the off-chain proving/relayer endpoint (optional). If set, the frontend can poll bridge status; if null,
  // proving is done out-of-band (CLI) and the frontend just shows the on-chain deposit/burn it submitted.
  relayer: null,
  finality: { lambda: 50, beta: 0.33, k: 49, seconds: 4.9 }
};
