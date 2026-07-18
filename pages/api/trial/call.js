// pages/api/trial/call.js — run one free trial call with a trial session, server-side proxied.
// Restricted to the `kaspa-expert` tier: a RAG-grounded model with current Kaspa knowledge, so the
// free demo gives accurate answers about Kaspa (and can't be abused as a general open proxy).
const GATEWAY = 'https://x402-compute.68cxgfyr0.workers.dev';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { session, prompt } = req.body || {};
  if (!session || !String(session).startsWith('trial_')) {
    return res.status(400).json({ error: 'a trial session is required' });
  }
  try {
    const r = await fetch(`${GATEWAY}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Session': String(session) },
      body: JSON.stringify({
        model: 'kaspa-expert',
        messages: [{ role: 'user', content: String(prompt || '').slice(0, 600) }],
        max_tokens: 200,
      }),
    });
    const d = await r.json();
    if (d.choices && d.choices[0]) {
      return res.status(200).json({ text: d.choices[0].message.content });
    }
    return res.status(r.status === 200 ? 502 : r.status).json({
      error: (d.error && (d.error.message || d.error)) || 'call failed',
      trialExhausted: !!d.trialExhausted,
    });
  } catch (e) {
    console.error('trial/call:', e);
    return res.status(502).json({ error: 'call failed' });
  }
}
