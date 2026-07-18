// next.config.js — standalone k402 exchange site
module.exports = {
  reactStrictMode: true,
  async rewrites() {
    // machine-readable catalog at a clean, conventional URL for agents/LLMs
    return [{ source: '/llms.txt', destination: '/api/llms' }];
  },
};
