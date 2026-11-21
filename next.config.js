// next.config.js — standalone k402 exchange site
module.exports = {
  transpilePackages: ['@kaspa-x402/core'],
  reactStrictMode: true,
  // /api/og reads the bundled Fraunces WOFF with fs at request time, and next/og's Node build loads resvg.wasm + yoga.wasm
  // from its own directory; the serverless bundle on Vercel traced neither (500 in production, fine under `next start`).
  outputFileTracingIncludes: {
    '/api/og': ['./lib/fonts/**', './node_modules/next/dist/compiled/@vercel/og/**'],
    // the status route recomputes box addresses with the kusd-client WASM (lib/kusd/client.mjs reads it from disk)
    '/api/kusd/status': ['./lib/kusd/wasm/**'],
  },
  async redirects() {
    // the Kaspa Agent Market moved here from the Lab: /kusd/market is the old path
    return [{ source: '/kusd/market', destination: '/market', permanent: true }];
  },
  async rewrites() {
    // Machine-readable catalog + per-service manifests at clean, conventional URLs for agents/LLMs.
    // beforeFiles so `/skill/<cap>.md` hits the markdown API before the `[cap]` HTML page catches it.
    return {
      beforeFiles: [
        { source: '/llms.txt', destination: '/api/llms' },
        { source: '/llms.json', destination: '/api/llmsjson' },
        { source: '/skill/:cap.md', destination: '/api/skill/:cap' },
      ],
      afterFiles: [
        // ETH⇄Kaspa bridge GUI (static vanilla app under public/bridge/) at the clean /bridge URL.
        { source: '/bridge', destination: '/bridge/index.html' },
      ],
    };
  },
};
