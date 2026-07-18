// next.config.js — standalone k402 exchange site
module.exports = {
  reactStrictMode: true,
  async rewrites() {
    // Machine-readable catalog + per-service manifests at clean, conventional URLs for agents/LLMs.
    // beforeFiles so `/skill/<cap>.md` hits the markdown API before the `[cap]` HTML page catches it.
    return {
      beforeFiles: [
        { source: '/llms.txt', destination: '/api/llms' },
        { source: '/llms.json', destination: '/api/llmsjson' },
        { source: '/skill/:cap.md', destination: '/api/skill/:cap' },
      ],
    };
  },
};
