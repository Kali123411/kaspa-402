# kaspa-402

The **k402 service exchange** — an open marketplace of agent-payable services (LLM inference, chain
data, zero-knowledge proofs, covenant tooling), settled trustlessly over Kaspa L1 payment channels.
The registry never holds funds; reputation is chain-verified settled volume.

Standalone Next.js site for **kaspa-402.org**. The marketplace is the homepage; live listings come
from the k402 registry via same-origin API proxies (`/api/exchange`, `/api/trial/*`) so the browser
makes no cross-origin calls.

## Develop
```
npm install
npm run dev      # http://localhost:3000
```

## Deploy
Any Next.js host. On Vercel: import the repo, framework auto-detected, no env vars needed.

Protocol + client: https://github.com/Kali123411/k402 · `pip install k402`
