// وظيفة Cloudflare Pages: تحويل النص إلى صوت عصبي عربي (أصوات Edge العصبية)
// المسار: /api/tts?v=ar-SA-HamedNeural&t=النص
const TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const VER = '1-130.0.2849.68';
const VOICES = { 'ar-SA-HamedNeural': 'ar-SA', 'ar-SA-ZariyahNeural': 'ar-SA', 'ar-EG-ShakirNeural': 'ar-EG', 'ar-EG-SalmaNeural': 'ar-EG', 'ar-AE-HamdanNeural': 'ar-AE', 'ar-AE-FatimaNeural': 'ar-AE' };
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
const esc = s => s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
async function gec() {
  let t = Math.floor(Date.now() / 1000) + 11644473600; t -= t % 300; t = t * 1e7;
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t + TOKEN)));
}
async function synth(text, voice) {
  const id = crypto.randomUUID().replace(/-/g, '');
  const url = 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=' + TOKEN + '&Sec-MS-GEC=' + await gec() + '&Sec-MS-GEC-Version=' + VER + '&ConnectionId=' + id;
  const r = await fetch(url, { headers: { Upgrade: 'websocket', Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0' } });
  const ws = r.webSocket; if (!ws) throw new Error('ws ' + r.status);
  ws.accept();
  return new Promise((res, rej) => {
    const parts = []; const ts = new Date().toString();
    const done = () => { let n = 0; parts.forEach(p => n += p.length); const o = new Uint8Array(n); let k = 0; parts.forEach(p => { o.set(p, k); k += p.length; }); res(o); };
    const to = setTimeout(() => { try { ws.close(); } catch (e) {} rej(new Error('timeout')); }, 20000);
    ws.addEventListener('message', async e => {
      if (typeof e.data === 'string') { if (e.data.includes('Path:turn.end')) { clearTimeout(to); ws.close(); parts.length ? done() : rej(new Error('empty')); } return; }
      const buf = new Uint8Array(e.data instanceof ArrayBuffer ? e.data : await e.data.arrayBuffer());
      const hl = (buf[0] << 8) | buf[1], head = new TextDecoder().decode(buf.slice(2, 2 + hl));
      if (head.includes('Path:audio')) parts.push(buf.slice(2 + hl));
    });
    ws.addEventListener('error', () => { clearTimeout(to); rej(new Error('ws error')); });
    ws.send('X-Timestamp:' + ts + '\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n');
    ws.send('X-RequestId:' + id + '\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:' + ts + 'Z\r\nPath:ssml\r\n\r\n<speak version=\'1.0\' xmlns=\'http://www.w3.org/2001/10/synthesis\' xml:lang=\'' + VOICES[voice] + '\'><voice name=\'' + voice + '\'><prosody pitch=\'+0Hz\' rate=\'+0%\' volume=\'+0%\'>' + esc(text) + '</prosody></voice></speak>');
  });
}
export async function onRequestGet({ request }) {
  const u = new URL(request.url), v = u.searchParams.get('v') || '', t = (u.searchParams.get('t') || '').slice(0, 400);
  if (!VOICES[v] || !t.trim()) return new Response('bad request', { status: 400 });
  const cache = caches.default, key = new Request(request.url);
  const hit = await cache.match(key); if (hit) return hit;
  try {
    const audio = await synth(t, v);
    const resp = new Response(audio, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' } });
    await cache.put(key, resp.clone()); return resp;
  } catch (e) { return new Response('tts failed: ' + e.message, { status: 502 }); }
}
