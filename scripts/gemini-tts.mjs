// Gemini TTS via the Interactions API. Delivery direction goes in the
// speech_metadata `style` annotation: anything in `text` is read verbatim.
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";

export const GEMINI_MODEL = process.env.GEMINI_TTS_MODEL ?? "gemini-3.8-flash-tts";

// GEMINI_API_KEY, then GEMINI_API_KEY_2, _3 … as backups. The free quota (about 10
// requests a day per model) is counted per Google project, so a key from another
// project adds its own quota; when one key is refused "per day" the next is tried.
const KEYS = [process.env.GEMINI_API_KEY, ...Array.from({ length: 8 }, (_, i) => process.env[`GEMINI_API_KEY_${i + 2}`])]
  .map((key, i) => ({ key, n: i + 1 }))
  .filter((k) => k.key);

// Every request is logged to the Studio Konten data folder so the dashboard can
// show how much of the daily quota is left.
import { root } from "./project.mjs";
const USAGE = process.env.TTS_USAGE_LOG ?? path.resolve(root, "..", "studio", "data", "tts-usage.jsonl");
async function logUsage(entry) {
  try {
    await fs.access(path.dirname(USAGE));
    await fs.appendFile(USAGE, JSON.stringify({ ts: new Date().toISOString(), project: path.basename(root), model: GEMINI_MODEL, ...entry }) + "\n");
  } catch {}
}

// Quotas reset at midnight Pacific time; keys refused "per day" since then are skipped.
function refusedToday() {
  const now = new Date();
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  const offset = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(now.getTime() / 1000) * 1000;
  const start = Date.UTC(+p.year, +p.month - 1, +p.day) - offset;
  try {
    return new Set(
      readFileSync(USAGE, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l))
        .filter((e) => e.daily && e.model === GEMINI_MODEL && Date.parse(e.ts) >= start)
        .map((e) => e.key ?? 1),
    );
  } catch {
    return new Set();
  }
}

// Returns the clip duration in seconds.
export async function geminiTts({ text, voice, style, out }) {
  if (!KEYS.length) throw new Error("GEMINI_API_KEY belum di-set (lihat .env)");
  const spent = refusedToday();
  const keys = KEYS.filter((k) => !spent.has(k.n));
  if (!keys.length) throw new Error(`Kuota harian ${GEMINI_MODEL} habis di semua key (${KEYS.length}). Coba GEMINI_TTS_MODEL lain atau tunggu reset.`);
  const content = { type: "text", text };
  if (style) content.annotations = [{ type: "speech_metadata", style }];
  let lastError = "";
  for (const { key, n } of keys) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          model: GEMINI_MODEL,
          input: [{ type: "user_input", content: [content] }],
          response_format: { type: "audio" },
          generation_config: { speech_config: [{ voice }] },
        }),
      });
      const data = await res.json();
      const message = String(data.error?.message ?? data.message ?? "");
      const daily = res.status === 429 && /per day/i.test(message);
      // Per-minute rate limit: back off and retry the same key.
      if (res.status === 429 && !daily && attempt < 3) {
        await logUsage({ key: n, voice, chars: text.length, ok: false, status: 429, error: "batas per menit, dicoba lagi" });
        await new Promise((r) => setTimeout(r, 15000 * (attempt + 1)));
        continue;
      }
      const audio = (data.steps ?? [])
        .filter((s) => s.type === "model_output")
        .flatMap((s) => s.content ?? [])
        .filter((c) => c.type === "audio")
        .pop();
      if (!res.ok || !audio) {
        await logUsage({ key: n, voice, chars: text.length, ok: false, status: res.status, daily, retry: message.match(/retry in ([^.]+)/i)?.[1], error: message.slice(0, 200) });
        lastError = `Gemini TTS ${res.status} (key ${n}): ${JSON.stringify(data.error ?? data).slice(0, 300)}`;
        if (daily) {
          console.log(`key ${n}: kuota harian ${GEMINI_MODEL} habis, pindah ke key berikutnya`);
          break;
        }
        throw new Error(lastError);
      }
      const wav = Buffer.from(audio.data, "base64");
      await fs.writeFile(out, wav);
      await logUsage({ key: n, voice, chars: text.length, ok: true, status: res.status });
      // WAV header: byte rate at offset 28, then find the data chunk size
      const byteRate = wav.readUInt32LE(28);
      const dataAt = wav.indexOf("data", 12);
      return wav.readUInt32LE(dataAt + 4) / byteRate;
    }
  }
  throw new Error(lastError);
}
