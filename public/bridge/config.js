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
    wethCovid:         "8b6a35222c6ab907f0d669d8e46d6cad7f395f3758a7b8270c7c384f1378b656",
    bridgeCovid:       "58231a18cca8acfb5d58fbc6b1170eeb42268139be74e0ed3ce5784005cdca99",
    mintAuthorityCovid:"acebb33bcac42b46c50683f21ca2387cff781e2400e8444f032315a491ecf822",
    explorer: "https://explorer.kaspa.org"
  },
  // Minted wETH — canonical, proof-gated KCC20 notes (covid A), each 1:1 backed by a proven ETH deposit.
  // No external wallet indexes silverscript-KCC20 covenant notes yet, so the bridge surfaces its own mints
  // here and does a LIVE on-chain check that each note UTXO is still held (unspent) at its covenant address.
  weth: {
    tokenCovid:  "8b6a35222c6ab907f0d669d8e46d6cad7f395f3758a7b8270c7c384f1378b656",
    minterCovid: "acebb33bcac42b46c50683f21ca2387cff781e2400e8444f032315a491ecf822",
    // Re-issued 2026-07-27 on silverscript 2a3961c (adds #143 template-hash hardening + #154 leader-entrypoint
    // hardening) so the note template (36205a78) matches the canonical KCC20 standard the DEX validates against.
    // FULLY bridge-integrated: this note was MINTED by the redeployed stack (fresh bridge 58231a18 -> minter
    // acebb33b -> token 8b6a3522) from a real SP1 Helios storage proof of ETH deposit #0 — proof-gated 1:1, not
    // operator-seeded. The prior token (4b3be42e, template 8130334e) is retired.
    mints: [
      {
        amountEth: "0.0002", units: "200000000000000",
        recipient:     "d94d02625649d3bc428158fb2a42e3b53703e3fa19e67c6996e69ff79cb61f71",
        recipientAddr: "kaspa:qrv56qnz2eya80zzs9v0k2jzuw6nwqlrlgv7vlrfjmnflauukc0hzffhan3rm",
        noteAddr:  "kaspa:prjphf289mdlz4wtl2ssygap99keu78yp8gyn047ww6ssjzggfz9cq3m3egap",
        noteTxid:  "a976087b0fc8e3191f0b91142fb48bf84941900d288c795cccdf0197eca61d19", noteIdx: 1,
        mintTxid:  "a976087b0fc8e3191f0b91142fb48bf84941900d288c795cccdf0197eca61d19",
        ethDepositId: 0, ethBlock: 25614483,
        ethTxid: "0x865154ca2af65aa03b6aded292b8f0d7d8ea7ad84f940605f4d8bbe917914647"
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
