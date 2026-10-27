// Cloudflare Pages Function: /api/translate  (ترجمة احتياطية عبر Gemini)
// الإعداد: Pages → Settings → Variables and Secrets → أضف سرًا باسم GEMINI_API_KEY
export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin') || '';
  const host = new URL(request.url).origin;
  if (origin && origin !== host) return new Response('forbidden', { status: 403 });
  if (!env.GEMINI_API_KEY) return new Response('not configured', { status: 503 });
  let b; try { b = await request.json(); } catch { return new Response('bad json', { status: 400 }); }
  const text = String(b.text || '').slice(0, 6000);
  const names = { en: 'English', ar: 'Arabic' };
  const sl = names[b.sl], tl = names[b.tl];
  if (!text.trim() || !sl || !tl) return new Response('bad request', { status: 400 });
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.GEMINI_API_KEY },
    body: JSON.stringify({
      model: 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: `Translate from ${sl} to ${tl}. Output only the translation, keep paragraph breaks, add nothing.` },
        { role: 'user', content: text }
      ]
    })
  });
  if (!r.ok) return new Response('upstream ' + r.status, { status: 502 });
  const j = await r.json();
  const out = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
  if (!out) return new Response('empty', { status: 502 });
  return new Response(JSON.stringify({ text: out.trim() }), { headers: { 'Content-Type': 'application/json' } });
}
