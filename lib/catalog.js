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
  'chain:balance': { what: 'Balance of any Kaspa mainnet address, straight from a node — no indexer, no key.', send: '{ "address": "kaspa:…" }', get: '{ "balance": 123456789 }' },
  'chain:utxos': { what: 'The UTXO set of a Kaspa address, including covenant ids where set.', send: '{ "address": "kaspa:…" }', get: '{ "utxos": [ … ] }' },
  'chain:tx': { what: 'Mempool / acceptance status of a Kaspa transaction.', send: '{ "txid": "…" }', get: '{ "status": "…" }' },
  'token-risk': { what: 'On-chain risk report for a KRC-20 token or KRC-721 collection — holder concentration, mint status, liquidity, and legitimacy signals, plus a plain-language summary. Facts only, not financial advice.', send: '{ "asset": "krc20:NACHO" }  (or "krc721:KASPUNKS")', get: '{ "facts": { … }, "flags": [ … ], "assessment": { "riskLevel": "…", "summary": "…" } }' },
  'wallet-risk': { what: 'On-chain profile + risk read for a Kaspa address — KAS balance, activity, KRC-20 holdings, exposure to risky tokens, and deployer detection. Facts from public data, not an accusation.', send: '{ "address": "kaspa:…" }', get: '{ "facts": { … }, "flags": [ … ], "assessment": { "profile": "…", "riskLevel": "…", "summary": "…" } }' },
  'token-compare': { what: 'Side-by-side risk comparison of 2–5 KRC-20 tokens — ranked safest-first on holder concentration, mint status, liquidity, and legitimacy, with a comparative summary. Facts only, not financial advice.', send: '{ "assets": "NACHO,KOMA,KANDA" }', get: '{ "comparison": [ … ], "rankingSafestFirst": [ … ], "assessment": { "summary": "…" } }' },
  'mint-radar': { what: 'A momentum + safety feed of KRC-20 tokens / KRC-721 NFTs — sorted by hot (holder growth), new, or minting activity, each with quick risk flags. Facts only, not financial advice.', send: '{ "type": "krc20|krc721", "sort": "hot|new|minting", "limit": 10 }', get: '{ "radar": [ … ], "assessment": { "summary": "…" } }' },
  'fund-trace': { what: 'Follow-the-money fund-flow trace for a Kaspa address or transaction — top sources (who funded it), top destinations (who it paid), net flow, and counterparties, with a forensic read. Public on-chain data.', send: '{ "target": "kaspa:… or <txid>" }', get: '{ "topSources": [ … ], "topDestinations": [ … ], "netFlowKas": …, "assessment": { "summary": "…" } }' },
};
export const capInfo = (cap) => CAP_INFO[cap] || { what: 'A custom agent-payable service — open Use to see how to call it.' };

// browsable categories, derived from the capability
export const CATEGORIES = [
  ['Inference', (c) => c.startsWith('llm:') || c === 'kaspa-expert'],
  ['Text & data', (c) => ['summarize', 'extract', 'classify', 'rewrite', 'read', 'embed', 'search'].includes(c)],
  ['Kaspa chain data', (c) => c.startsWith('chain:')],
  ['Markets & risk', (c) => c === 'token-risk' || c === 'wallet-risk' || c === 'token-compare' || c === 'mint-radar'],
  ['Forensics', (c) => c === 'fund-trace'],
  ['Covenants', (c) => c.startsWith('covenant:')],
  ['Zero-knowledge', (c) => c === 'zk-prove' || c === 'attest'],
];
export const CAT_ORDER = [...CATEGORIES.map((c) => c[0]), 'Other'];
export const categoryOf = (cap) => (CATEGORIES.find(([, test]) => test(cap)) || ['Other'])[0];

