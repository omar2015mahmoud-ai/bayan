// Cloudflare Pages Function: /api/chat  (ذكاء «رفيق بيان» عبر Workers AI)
// التفعيل: Settings → Bindings → Add → Workers AI، والاسم AI.
const MODELS = ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.1-8b-instruct'];
export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin') || '';
  if (origin && origin !== new URL(request.url).origin) return new Response('forbidden', { status: 403 });
  if (!env.AI) return new Response('not configured', { status: 503 });
  let b; try { b = await request.json(); } catch { return new Response('bad json', { status: 400 }); }
  const messages = (Array.isArray(b.messages) ? b.messages : []).slice(-24)
    .filter(m => m && ['system', 'user', 'assistant'].includes(m.role))
    .map(m => ({ role: m.role, content: String(m.content || '').slice(0, 12000) }));
  if (!messages.some(m => m.role === 'user')) return new Response('bad request', { status: 400 });
  for (const model of MODELS) {
    try {
      const r = await env.AI.run(model, { messages, max_tokens: 1800 });
      const text = r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content));
      if (text) return new Response(JSON.stringify({ text: String(text).trim() }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {}
  }
  return new Response('upstream', { status: 502 });
}
