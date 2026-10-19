// Shared by check-vo.mjs and fixcuts.mjs: transcribe short audio through the 9router.
// Requests run a few at a time (CHECK_CONCURRENCY, default 4) instead of one by one with a fixed
// pause: on 19 Oct 2026 one job spent ±19 of its 43 minutes waiting on these transcriptions.
export const MODEL = process.env.CHECK_MODEL ?? "ag/gemini-3.8-flash";
const LIMIT = Math.max(1, Number(process.env.CHECK_CONCURRENCY ?? 4) || 4);

// The router sometimes answers as if no audio was attached; that is a failure, not a transcript.
export const BAD = /\b(audio|berkas|unggah|lampirkan|attach|upload)\b/i;

// Transcript of one WAV/MP3 buffer, or "" when every try failed. Failed tries back off, since an
// empty answer usually means the router is throttling. Answers take ±8 s (slowest seen 42 s), but
// now and then a request hangs, so a try is abandoned after 45 s and sent again.
export async function hear(buf, format, prompt, tries = 4) {
  for (let k = 0; k < tries; k++) {
    try {
      const res = await fetch(`${process.env.ROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.ROUTER_API_KEY}` },
        body: JSON.stringify({
          model: MODEL,
          stream: false,
          messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "input_audio", input_audio: { data: buf.toString("base64"), format } }] }],
        }),
        signal: AbortSignal.timeout(45000),
      });
      const text = (await res.json().catch(() => ({}))).choices?.[0]?.message?.content?.trim();
      if (text && !BAD.test(text)) return text;
    } catch {}
    if (k < tries - 1) await new Promise((r) => setTimeout(r, 4000 * (k + 1)));
  }
  return "";
}

// fn over every item with at most LIMIT running at once; results keep the input order.
export async function pool(items, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(LIMIT, items.length) }, worker));
  return out;
}
