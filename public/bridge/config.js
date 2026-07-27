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
    wethTemplateHash:  "8130334e8a562f91e60107c74bbd38005c788a06a6f01a40fdb0998d6819b93b",
    // mainnet covenants (2026-07-26): canonical KCC20 wETH + the mint-direction light client + authority
    wethCovid:         "383080a7a4880d86356e47e5676e6121e1f2605f71fa17f3b1f0bf7caadd2e30",
    bridgeCovid:       "523af31d2064937c94a6c8535bdc2cbc8318c4d912e292c390965f9d86303eff",
    mintAuthorityCovid:"f3bc2b89943e83e2c2821ca3df9e5c359f73689fa0e230b836c1219ebe61295c",
    explorer: "https://explorer.kaspa.org"
  },
  // Minted wETH — canonical, proof-gated KCC20 notes (covid A), each 1:1 backed by a proven ETH deposit.
  // No external wallet indexes silverscript-KCC20 covenant notes yet, so the bridge surfaces its own mints
  // here and does a LIVE on-chain check that each note UTXO is still held (unspent) at its covenant address.
  weth: {
    tokenCovid:  "4b3be42eb544f7fe214266bb9058a58d00e7e9dcce3081eca5c34673dff6a2ea",
    minterCovid: "51277d92e2b3ed9f3b084ff99a8ef1e606289909031bb8dbfda08826a8f944ab",
    mints: [
      {
        amountEth: "0.0002", units: "200000000000000",
        recipient:     "d94d02625649d3bc428158fb2a42e3b53703e3fa19e67c6996e69ff79cb61f71",
        recipientAddr: "kaspa:qrv56qnz2eya80zzs9v0k2jzuw6nwqlrlgv7vlrfjmnflauukc0hzffhan3rm",
        noteAddr:  "kaspa:prjphf289mdlz4wtl2ssygap99keu78yp8gyn047ww6ssjzggfz9cq3m3egap",
        noteTxid:  "538f87dbb24a769b3fd37a381c1506052e5605cb6958460c91db13c9e9a2a414", noteIdx: 1,
        mintTxid:  "538f87dbb24a769b3fd37a381c1506052e5605cb6958460c91db13c9e9a2a414",
        ethDepositId: 0, ethBlock: 25614483,
        ethTxid: "0x865154ca2af65aa03b6aded292b8f0d7d8ea7ad84f940605f4d8bbe917914647"
      },
      {
        amountEth: "0.0005", units: "500000000000000",
        recipient:     "d94d02625649d3bc428158fb2a42e3b53703e3fa19e67c6996e69ff79cb61f71",
        recipientAddr: "kaspa:qrv56qnz2eya80zzs9v0k2jzuw6nwqlrlgv7vlrfjmnflauukc0hzffhan3rm",
        noteAddr:  "kaspa:pr0eszqyqjq7k39r0nk3f977mqqqd2gy6wkff4drr6t6gnm3caak7ft5gn762",
        noteTxid:  "75eb244f2e6beff352fe0c8cc4543b66d6c99c5cd9a99100974ccd2d8ffe8d00", noteIdx: 1,
        mintTxid:  "75eb244f2e6beff352fe0c8cc4543b66d6c99c5cd9a99100974ccd2d8ffe8d00",
        ethDepositId: 1, ethBlock: 25615186,
        ethTxid: "0xe88a24a63dc15f48592a7048b8e262a8648f721fdfd3f91307bede93d3bd1a9e"
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
