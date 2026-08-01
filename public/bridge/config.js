// Kaspa-402 Bridge frontend — network + contract configuration.
// Both legs are LIVE on mainnet. The full loop is closed END TO END, PERMISSIONLESSLY (2026-07-29):
// ETH lock -> SP1 Helios proof -> KCC20 wETH mint -> KEYLESS burn (no operator sig) -> sparse-anchor
// finality proof -> ETH released on Ethereum mainnet (unlock tx 0x50017f2f, Tier-2 escrow).
window.BRIDGE_CONFIG = {
  eth: {
    chainId: "0x1",               // Ethereum L1 mainnet
    chainName: "Ethereum",
    // Deposit/lock escrow — the mint covenants prove THIS contract's storage slots (deposits #1..#5).
    escrow: "0x51328cC5995EDE52968A444d605659cFC3e3A571",
    // Tier-2 unlock escrow (canonical for the return leg) — verifies the sparse-anchor finality proof of a
    // Tier-2/permissionless burn and releases ETH. Proven live: unlock tx 0x50017f2f… (2026-07-29).
    unlockEscrow: "0x3c79d59595535E30A7f3B33CEB1A6CA2A06d4F3d",
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
    // Canonical Tier-2 stack (2026-07-28, launch-proof verified — covenant/launch/ in the repo):
    burnRegistryCovid: "2fda4298b781bd389f15cde2b4bd9cfec4b2886daa3d9c9ea585e2de7d2955cd",
    // canonical kcc20 note template (2a3961c compile) — what wallets/DEX validate against; the registry's
    // own masked-state param (wethTmpl) is 8278cbec….
    wethTemplateHash:  "36205a78ae657a7f1db798f6c52925ca82aca7361df71ef6a8202ce05aa7ec5f",
    wethCovid:         "6e0d2649c4b29136ea96a0757ba3dd52a640fc3a52c35df16741a91156f1321e",
    bridgeCovid:       "58231a18cca8acfb5d58fbc6b1170eeb42268139be74e0ed3ce5784005cdca99",
    mintAuthorityCovid:"b8f2231e2733800647d788ead59ebb42c52ca379622e9c93feb3a2354ab73d20",
    // PERMISSIONLESS stack v2 (2026-07-29, canonical): same mint gate, but the burn leg is KEYLESS —
    // authorized by a structural anti-mint constraint (OpCovOutputCount==1), no governance signature.
    // PERMISSIONLESS v3 (canonical): the first minter that binds the deposit proof to a specific escrow
    // (AUDIT-READINESS §7.8). v2 (a544f84b/fd45f41b) is superseded — it accepted a proof of ANY contract.
    permMinterCovid:   "a331756148cebc527f4df866dd518173e19babf2262d8b8eb417879ce28492ad",
    permWethCovid:     "0bb9a10e262fcc8ac06bc9735c86279686cdfc9bfef90a4b3d90a11ba5dcb39f",
    explorer: "https://explorer.kaspa.org"
  },
  // Minted wETH — canonical, proof-gated KCC20 notes, each 1:1 backed by a proven ETH deposit.
  // No external wallet indexes silverscript-KCC20 covenant notes yet, so the bridge surfaces its own mints
  // here and does a LIVE on-chain check that each note UTXO is still held (unspent) at its covenant address.
  // Notes burned via the value-absorption registry carry burnTxid (+ unlockEthTxid once ETH was released).
  //
  // `permissionless: true` marks a note minted by the PERMISSIONLESS stack — only those can be burned
  // self-serve from this page (that minter's burn leg needs no governance signature). Notes from the
  // earlier stack require an operator co-signature and are shown but not burnable here.
  // `noteValueSompi` is the note UTXO's KAS value (not the wETH amount) — needed to build the co-spend.
  weth: {
    tokenCovid:  "6e0d2649c4b29136ea96a0757ba3dd52a640fc3a52c35df16741a91156f1321e",
    minterCovid: "b8f2231e2733800647d788ead59ebb42c52ca379622e9c93feb3a2354ab73d20",
    // Current canonical stack (Tier-2 registry + merged proof-gated minter). The 2026-07-26/27 stack
    // (token 8b6a3522 / minter acebb33b) is retired; its mints predate the value-absorption burn.
    mints: [
      {
        // v3 stack, minted through the FIXED §7.8 gate — this is the note the self-serve burn uses
        amountEth: "0.0002", units: "200000000000000",
        recipient:     "d94d02625649d3bc428158fb2a42e3b53703e3fa19e67c6996e69ff79cb61f71",
        recipientAddr: "kaspa:qrv56qnz2eya80zzs9v0k2jzuw6nwqlrlgv7vlrfjmnflauukc0hzffhan3rm",
        noteAddr:  "kaspa:prjphf289mdlz4wtl2ssygap99keu78yp8gyn047ww6ssjzggfz9cq3m3egap",
        noteTxid:  "2c7e0462981ee212bdbe321f4ba8212d6de200b52520dd806d8d23344d94ea59", noteIdx: 1,
        noteValueSompi: 30000000, permissionless: true,
        mintTxid:  "2c7e0462981ee212bdbe321f4ba8212d6de200b52520dd806d8d23344d94ea59",
        ethDepositId: 1, ethBlock: 25655594,
        ethTxid: "0xc04de5e211f44fb5425e4963310c83b164cc72d8b4170cc5e0242979393f403a"
      },
      {
        // still-held proof-gated mint (bridge 58231a18 -> minter b8f2231e -> token 6e0d2649)
        amountEth: "0.0002", units: "200000000000000",
        recipient:     "d94d02625649d3bc428158fb2a42e3b53703e3fa19e67c6996e69ff79cb61f71",
        recipientAddr: "kaspa:qrv56qnz2eya80zzs9v0k2jzuw6nwqlrlgv7vlrfjmnflauukc0hzffhan3rm",
        noteAddr:  "kaspa:prjphf289mdlz4wtl2ssygap99keu78yp8gyn047ww6ssjzggfz9cq3m3egap",
        noteTxid:  "a0fef7c448449e69453b0e09239b65c873dfccef85ab2fa9c162d6385313eade", noteIdx: 1,
        mintTxid:  "a0fef7c448449e69453b0e09239b65c873dfccef85ab2fa9c162d6385313eade",
        ethDepositId: 1, ethBlock: null, ethTxid: null,
        // burned 2026-07-31 (note-owner signature came from KasWare signPskt) to clear the double claim
        // left by the ETH recovery; registry accRoot b7ed91ce -> ecce1f67.
        burnTxid: "7b57862f16fa52d1e724464601b8a6bceb19853e9f17c8fd4b30dd2b167b8535"
      },
      {
        amountEth: "0.0001", units: "100000000000000",
        recipient:     "b3efc756356e556a0963de13ae47427dcf9b68ee8783ce13f36f3d842bd00f32",
        recipientAddr: "kaspa:qze7l36kx4h926sfv00p8tj8gf7ulxmga6rc8nsn7dhnmppt6q8nyg5sr0xjy",
        noteAddr:  "kaspa:pqgdhtxknq6lzy9rjw6qm0ktl6hlw5l0rtvswnxmrjyulsuqdrf9q65tgknqf",
        noteTxid:  "bea05e92742c2ad475925e499a91541ef459601bca51952e67fbc1a1ee902e12", noteIdx: 1,
        mintTxid:  "bea05e92742c2ad475925e499a91541ef459601bca51952e67fbc1a1ee902e12",
        ethDepositId: 3, ethBlock: 25627787,
        ethTxid: "0xfe82f53c84e39870be939bc2a36977487644a0db8b613ecac620b706ef60e7b8",
        // Tier-2 value-absorption burn: the note was DESTROYED, the registry absorbed the exact amount.
        burnTxid: "d1938ddf41ac4e3019515c846ac76cb91df3ccb7cc1a959a331c3154afa3d44b"
      },
      {
        amountEth: "0.0001", units: "100000000000000",
        recipient:     "b3efc756356e556a0963de13ae47427dcf9b68ee8783ce13f36f3d842bd00f32",
        recipientAddr: "kaspa:qze7l36kx4h926sfv00p8tj8gf7ulxmga6rc8nsn7dhnmppt6q8nyg5sr0xjy",
        noteAddr:  "kaspa:pqgdhtxknq6lzy9rjw6qm0ktl6hlw5l0rtvswnxmrjyulsuqdrf9q65tgknqf",
        noteTxid:  "237704556fc75401a7b7fc4b38237eeb35902a402730d66616908693bfa777b7", noteIdx: 1,
        noteValueSompi: 40000000, permissionless: true,
        mintTxid:  "237704556fc75401a7b7fc4b38237eeb35902a402730d66616908693bfa777b7",
        ethDepositId: 5, ethBlock: 25635045,
        ethTxid: "0x3e3f975979c31dd8b8627a20690d47fbd3bb3d7996a6475a36ca36335740fc79",
        // The PERMISSIONLESS demo cycle: KEYLESS burn (no operator signature) -> sparse-anchor finality
        // proof -> ETH released on mainnet. The complete loop, permissionless end to end.
        burnTxid: "dfbeb7c97ca4b07d99afb2f643928f874c8e702a5382cd30ce414f1c2c5ba7f1",
        unlockEthTxid: "0x50017f2f374e420ff7b6f2150faf65175b0f36cd239761a3691afad633b73c74"
      }
    ]
  },
  // baked-in bridge fee (Kasplex-style flat fee). KAS-side leg = a 0.5-KAS fee output in the burn tx;
  // ETH-side leg = the escrow's immutable feeFlat (wei), taken on lock + unlock.
  fee: {
    // burnService: the KEYLESS burn service (frontend/burn-service/) that builds the covenant co-spend.
    // It holds no private key — your wallet signs the burn via signPskt and the service engine-verifies
    // before broadcasting. null = feature disabled.
    // SAME-ORIGIN path (recommended): the Cloudflare tunnel routes /burn-api/* on this hostname to the
    // service, so there is no CORS and no mixed-content block. An absolute http:// URL will NOT work from
    // the HTTPS site — browsers block it.
    flatKas: 0.5, ethFeeWei: "0", burnService: "/burn-api",
    kaspaAddress: "kaspa:qz7v9j9dddsqams8tswzgvadau00drmjkv3ux7p2q24j4xrd5wyscdmnzdcd9",
    // x-only pubkey decoded from the fee address (version 0 P2PK) — the burn bin's FEE_PUBKEY
    feePubkey: "bcc2c8ad6b600eee075c1c2433adef1ef68f72b323c3782a02ab2a986da3890c",
  },
  // the off-chain proving/relayer endpoint (optional). If set, the frontend can poll bridge status; if null,
  // proving is done out-of-band (CLI) and the frontend just shows the on-chain deposit/burn it submitted.
  relayer: null,
  finality: { lambda: 50, beta: 0.33, k: 49, seconds: 4.9 }
};
