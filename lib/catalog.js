// lib/catalog.js — capability metadata (plain-English what/send/get + categories), used by the
// discovery routes (/llms, /skill) to describe a service's capability. Payment is x402 v2 (@kaspa-x402/*).
// Plain-English "what this does" + you-send / you-get, per capability. Falls back to a generic line.
export const CAP_INFO = {
  'llm:chat': { what: 'General chat completion on a fast 7–8B model — Q&A, drafting, quick tasks.', send: '{ "model": "chat", "messages": [{ "role": "user", "content": "…" }] }', get: 'OpenAI-format chat completion' },
  'llm:reason': { what: 'Deeper reasoning on a larger model — multi-step problems, analysis.', send: '{ "model": "reason", "messages": [ … ] }', get: 'OpenAI-format chat completion' },
  'llm:code': { what: 'Code generation and help from a coder-tuned model.', send: '{ "model": "code", "messages": [ … ] }', get: 'OpenAI-format chat completion' },
  'kaspa-expert': { what: 'RAG-grounded answers about Kaspa, on current knowledge (won’t hallucinate facts).', send: '{ "model": "kaspa-expert", "messages": [ … ] }', get: 'OpenAI-format chat completion' },
  summarize: { what: 'Condense text or a public URL into a short summary.', send: '{ "text": "…" (or "url"), "max_words": 120 }', get: '{ "summary": "…" }' },
  extract: { what: 'Pull structured JSON from text, guaranteed to match a schema you provide.', send: '{ "text": "…", "schema": { … } }', get: 'JSON matching your schema' },
  classify: { what: 'Label text into one (or several) of your categories.', send: '{ "text": "…", "labels": ["a", "b", "c"] }', get: '{ "label": "b" }' },
  rewrite: { what: 'Rewrite text to an instruction — tone, format, or length.', send: '{ "text": "…", "instruction": "make it formal" }', get: '{ "text": "…" }' },
  embed: { what: 'Turn text into vector embeddings for semantic search / RAG.', send: '{ "input": ["text one", "text two"] }', get: '{ "data": [{ "embedding": [ … ] }] }' },
  read: { what: 'Fetch a public web page and return its title + clean markdown.', send: '{ "url": "https://…" }', get: '{ "title": "…", "markdown": "…" }' },
  search: { what: 'Semantic search over a collection you indexed earlier.', send: '{ "collection": "…", "q": "…", "top_k": 5 }', get: 'ranked matches with scores' },
  'zk-prove': { what: 'Generate a RISC Zero zero-knowledge proof — cycle-priced, verifiable by anyone.', send: '{ "image_id": "…", "input_b64": "…" }', get: '{ "receipt_b64": "…", "journal_b64": "…" }' },
  attest: { what: 'Verify a RISC Zero receipt against an image id.', send: '{ "receipt_b64": "…", "image_id": "…" }', get: '{ "valid": true, "journal_b64": "…" }' },
  'covenant:compile': { what: 'Compile a Silverscript covenant to script hex, ABI, template hash, and its P2SH address.', send: '{ "source": "…", "constructor_args": [ … ] }', get: '{ "script", "address", "template_hash" }' },
  'covenant:build': { what: 'Assemble a covenant spend transaction (you sign locally; the service never holds keys).', send: '{ "inputs": [ … ], "outputs": [ … ] }', get: 'a broadcast-ready transaction + pre-verify' },
  'covenant:redteam': { what: 'Static "red team" linter for a Silverscript/Toccata covenant — flags known Kaspa footguns (unchecked outputs, baked covenant-ids, storage-mass floor, replay/freshness, the 520-byte reveal, fee model) with severity, plus the template hash. A linter, not an audit: flags to review, never a safe/unsafe verdict and never exploit paths.', send: '{ "source": "<.sil>", "constructorArgs": [ … ] }  (or { "scriptHex": "…" } / { "address": "kaspa:…" })', get: '{ "reviewPosture": "…", "counts": { … }, "findings": [ … ], "opcodeProfile": { … }, "assessment": { "summary": "…" } }' },
  'chain:balance': { what: 'Balance of any Kaspa mainnet address, straight from a node — no indexer, no key.', send: '{ "address": "kaspa:…" }', get: '{ "balance": 123456789 }' },
  'chain:utxos': { what: 'The UTXO set of a Kaspa address, including covenant ids where set.', send: '{ "address": "kaspa:…" }', get: '{ "utxos": [ … ] }' },
  'chain:tx': { what: 'Mempool / acceptance status of a Kaspa transaction.', send: '{ "txid": "…" }', get: '{ "status": "…" }' },
  'token-risk': { what: 'On-chain risk report for a KRC-20 token or KRC-721 collection — holder concentration, mint status, liquidity, and legitimacy signals, plus a plain-language summary. Facts only, not financial advice.', send: '{ "asset": "krc20:NACHO" }  (or "krc721:KASPUNKS")', get: '{ "facts": { … }, "flags": [ … ], "assessment": { "riskLevel": "…", "summary": "…" } }' },
  'wallet-risk': { what: 'On-chain profile + risk read for a Kaspa address — KAS balance, activity, KRC-20 holdings, exposure to risky tokens, and deployer detection. Facts from public data, not an accusation.', send: '{ "address": "kaspa:…" }', get: '{ "facts": { … }, "flags": [ … ], "assessment": { "profile": "…", "riskLevel": "…", "summary": "…" } }' },
  'token-compare': { what: 'Side-by-side risk comparison of 2–5 KRC-20 tokens — ranked safest-first on holder concentration, mint status, liquidity, and legitimacy, with a comparative summary. Facts only, not financial advice.', send: '{ "assets": "NACHO,KOMA,KANDA" }', get: '{ "comparison": [ … ], "rankingSafestFirst": [ … ], "assessment": { "summary": "…" } }' },
  'mint-radar': { what: 'A momentum + safety feed of KRC-20 tokens / KRC-721 NFTs — sorted by hot (holder growth), new, or minting activity, each with quick risk flags. Facts only, not financial advice.', send: '{ "type": "krc20|krc721", "sort": "hot|new|minting", "limit": 10 }', get: '{ "radar": [ … ], "assessment": { "summary": "…" } }' },
  'fund-trace': { what: 'Follow-the-money fund-flow trace for a Kaspa address or transaction — top sources (who funded it), top destinations (who it paid), net flow, and counterparties, with a forensic read. Public on-chain data.', send: '{ "target": "kaspa:… or <txid>" }', get: '{ "topSources": [ … ], "topDestinations": [ … ], "netFlowKas": …, "assessment": { "summary": "…" } }' },
  'whale-watch': { what: 'Tail a Kaspa wallet — its size (KAS + KRC-20 holdings), whether it is accumulating or distributing KAS, and which tokens it is loading up on vs offloading right now. Public on-chain data.', send: '{ "address": "kaspa:…" }', get: '{ "size": { … }, "kasFlow": { … }, "tokenMoves": { … }, "assessment": { "summary": "…" } }' },
  'rug-autopsy': { what: 'Token autopsy for a KRC-20 — a health verdict (alive → likely dead) plus cause-of-death signs: liquidity, pre-mint, deployer holding, concentration, holder flight. On-chain diagnosis, not an accusation.', send: '{ "ticker": "KANDA" }', get: '{ "verdict": "…", "vitals": { … }, "causeOfDeathSigns": [ … ], "assessment": { "summary": "…" } }' },
  'sybil-scan': { what: 'Flag coordinated / sybil-looking wallet clusters in a KRC-20 — wallets holding identical amounts (a farm / insider fingerprint), with a suspicion level. Top-holder sample; a signal, not proof.', send: '{ "ticker": "KANDA" }', get: '{ "suspicion": "…", "coordinatedClusters": [ … ], "assessment": { "summary": "…" } }' },
  'opsec-score': { what: 'A "how traceable are you?" OPSEC score for a Kaspa wallet — linked alter-egos (co-spending), counterparty footprint, and on-chain surface, with hardening advice. Public on-chain data.', send: '{ "address": "kaspa:…" }', get: '{ "exposure": "…", "exposureScore": …, "signals": { … }, "findings": [ … ], "assessment": { "summary": "…" } }' },
  'entity-cluster': { what: 'Unmask the entity behind a Kaspa wallet — a co-spending cluster map of the addresses controlled by the same owner, with per-address balances and total KAS controlled. Heuristic, not proof.', send: '{ "address": "kaspa:…" }', get: '{ "entitySize": …, "totalControlledKas": …, "members": [ … ], "assessment": { "summary": "…" } }' },
  // Base-native services — settled on Base by the kaspa-x402-router; you pay in KAS.
  'base:token-price': { what: 'On-chain token price, market cap & 24h volume from CoinGecko (Base DEX data) — you pay KAS, the router settles on Base.', send: '?contract=0x… (a Base token address)', get: '{ "data": { "attributes": { "token_prices": { … } } } }' },
  'base:travel': { what: 'Tripadvisor location details (rating, reviews, address) — you pay KAS, the router settles on Base.', send: '?locationId=…', get: 'Tripadvisor location detail JSON' },
  'base:web-search': { what: 'Neural / web search over the live web (Exa, Parallel) — you pay KAS, the router settles on Base.', send: '?body={ "query": "…" } (or Exa: { "urls": ["…"] })', get: 'ranked search results / page contents' },
  'base:subgraph': { what: 'Query any subgraph on The Graph — you pay KAS, the router settles on Base.', send: '?subgraph_id=… & ?body={ "query": "{ … }" }', get: 'GraphQL result JSON' },
  'base:rpc': { what: 'Alchemy JSON-RPC on any supported chain — you pay KAS, the router settles on Base.', send: '?chainNetwork=base-mainnet & ?body={ "jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1 }', get: 'JSON-RPC response' },
  'base:answer': { what: 'Perplexity answer engine — a sourced answer to a question — you pay KAS, the router settles on Base.', send: '?body={ "query": "…" }', get: 'answer + citations' },
  'base:transcribe': { what: 'Deepgram speech-to-text (higher tier) — you pay KAS, the router settles on Base.', send: '?body={ "url": "https://…/audio.wav" }', get: 'transcript JSON' },
  'proof-of-reserve': { what: 'Control-proven reserve attestation for Kaspa. Two modes: (address) a claimant signs a recent block hash with each address key → signed, self-verifiable proof of total KAS controlled; (covenant) point at a covenant address and get the KAS its script controls on-chain (mainnet or testnet-10), no signing. Proof of reserves (assets), not solvency.', send: '{ "claimantLabel": "…", "challengeBlock": "<block hash>", "claims": [ { "address": "kaspa:…", "publicKey": "…", "signature": "…" } ] }  — or covenant mode: { "covenantAddress": "kaspa:… | kaspatest:…" }', get: '{ "attestation": { … }, "serviceSignature": { … }, "verifyRecipe": "…" }' },
};
export const capInfo = (cap) => CAP_INFO[cap] || { what: 'A custom agent-payable service — open Use to see how to call it.' };

// browsable categories, derived from the capability
export const CATEGORIES = [
  ['Inference', (c) => c.startsWith('llm:') || c === 'kaspa-expert'],
  ['Text & data', (c) => ['summarize', 'extract', 'classify', 'rewrite', 'read', 'embed', 'search'].includes(c)],
  ['Kaspa chain data', (c) => c.startsWith('chain:')],
  ['Markets & risk', (c) => c === 'token-risk' || c === 'wallet-risk' || c === 'token-compare' || c === 'mint-radar'],
  ['Forensics', (c) => c === 'fund-trace' || c === 'whale-watch' || c === 'rug-autopsy' || c === 'sybil-scan' || c === 'opsec-score' || c === 'entity-cluster'],
  ['Covenants', (c) => c.startsWith('covenant:')],
  ['Attestation', (c) => c === 'proof-of-reserve'],
  ['Zero-knowledge', (c) => c === 'zk-prove' || c === 'attest'],
  ['Base · via router', (c) => c.startsWith('base:')],
];
export const CAT_ORDER = [...CATEGORIES.map((c) => c[0]), 'Other'];
export const categoryOf = (cap) => (CATEGORIES.find(([, test]) => test(cap)) || ['Other'])[0];

