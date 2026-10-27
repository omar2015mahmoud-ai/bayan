// Cloudflare Pages Function: /api/translate  (ترجمة احتياطية)
// الأسهل: Settings → Bindings → Add → Workers AI، والاسم AI (بدون مفتاح).
// بديل: سر باسم GEMINI_API_KEY.
export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin') || '';
  if (origin && origin !== new URL(request.url).origin) return new Response('forbidden', { status: 403 });
  let b; try { b = await request.json(); } catch { return new Response('bad json', { status: 400 }); }
  const text = String(b.text || '').slice(0, 6000);
  const ok = { en: 'English', ar: 'Arabic' };
  if (!text.trim() || !ok[b.sl] || !ok[b.tl]) return new Response('bad request', { status: 400 });
  const json = o => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } });

  if (env.AI) {
    try {
      const r = await env.AI.run('@cf/meta/m2m100-1.2b', { text, source_lang: b.sl, target_lang: b.tl });
      const t = r && r.translated_text;
      if (t) return json({ text: String(t).trim() });
    } catch (e) {}
  }
  if (env.GEMINI_API_KEY) {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.GEMINI_API_KEY },
      body: JSON.stringify({ model: 'gemini-2.5-flash', messages: [
        { role: 'system', content: `Translate from ${ok[b.sl]} to ${ok[b.tl]}. Output only the translation, keep paragraph breaks.` },
        { role: 'user', content: text }] })
    });
    if (r.ok) { const j = await r.json(); const t = j.choices?.[0]?.message?.content; if (t) return json({ text: t.trim() }); }
    return new Response('upstream', { status: 502 });
  }
  return new Response('not configured', { status: 503 });
}
