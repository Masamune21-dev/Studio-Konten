import fs from "node:fs";
import path from "node:path";
import { DATA } from "./config.mjs";
import { setting } from "./db.mjs";

// Gemini TTS has no quota API. Every video project's scripts/gemini-tts.mjs appends
// one line per request to this log, and the free tier allows about 10 requests a
// day per model, reset at midnight Pacific time.
export const TTS_LOG = path.join(DATA, "tts-usage.jsonl");
export const TTS_MODELS = [
  { model: "gemini-3.8-flash-tts", label: "Flash TTS (utama)" },
  { model: "gemini-3.8-flash-lite-tts", label: "Flash-Lite TTS (cadangan)" },
];

// Start of the current quota day (midnight in America/Los_Angeles) and the next reset.
export function quotaDay(now = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  const offset = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(now.getTime() / 1000) * 1000;
  const start = Date.UTC(+p.year, +p.month - 1, +p.day) - offset;
  return { start: new Date(start), reset: new Date(start + 24 * 3600 * 1000) };
}

const readLog = () => {
  try {
    return fs
      .readFileSync(TTS_LOG, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
};

// GEMINI_API_KEY, GEMINI_API_KEY_2, … — the video scripts fall back to the next key
// when one is refused "per day". Quota is per Google project, so each key counts alone.
export const geminiKeys = () =>
  [process.env.GEMINI_API_KEY, ...Array.from({ length: 8 }, (_, i) => process.env[`GEMINI_API_KEY_${i + 2}`])]
    .map((key, i) => ({ key, n: i + 1 }))
    .filter((k) => k.key);

export function ttsStatus() {
  const { start, reset } = quotaDay();
  const limit = Math.max(1, Number(setting("tts_daily_limit", "10")) || 10);
  const log = readLog();
  const today = log.filter((e) => new Date(e.ts) >= start);
  const keys = geminiKeys().map(({ n }) => n);
  const models = TTS_MODELS.map(({ model, label }) => {
    const perKey = keys.map((n) => {
      // Log lines from before backup keys existed have no key: they were key 1.
      const mine = today.filter((e) => e.model === model && (e.key ?? 1) === n);
      const used = mine.filter((e) => e.ok).length;
      // A "per day" refusal means Google already counts the key as spent, whatever our tally says.
      const exhausted = mine.some((e) => !e.ok && e.daily) || used >= limit;
      return { key: n, used, left: exhausted ? 0 : Math.max(0, limit - used), exhausted, lastError: mine.filter((e) => !e.ok).at(-1)?.error ?? null };
    });
    const used = perKey.reduce((x, k) => x + k.used, 0);
    const left = perKey.reduce((x, k) => x + k.left, 0);
    return { model, label, used, left, limit: limit * perKey.length, exhausted: left === 0, keys: perKey, lastError: perKey.map((k) => k.lastError).filter(Boolean).at(-1) ?? null };
  });
  return {
    reset: reset.toISOString(),
    start: start.toISOString(),
    limit,
    keyCount: keys.length,
    models,
    // A dialog video takes one request per voice.
    videosLeft: Math.floor(models.reduce((n, m) => n + m.left, 0) / 2),
    recent: log.slice(-8).reverse(),
    since: log[0]?.ts ?? null,
  };
}

// Confirms every key and both models without spending quota (model info is free).
export async function checkTts() {
  const keys = geminiKeys();
  if (!keys.length) return { ok: false, error: "GEMINI_API_KEY belum ada di .env (folder utama repo)", models: [] };
  const models = (
    await Promise.all(
      keys.map(({ key, n }) =>
        Promise.all(
          TTS_MODELS.map(async ({ model, label }) => {
            try {
              const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}`, { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(15000) });
              const d = await res.json().catch(() => ({}));
              return { key: n, model, label, ok: res.ok, status: res.status, error: res.ok ? null : (d.error?.message ?? `HTTP ${res.status}`).slice(0, 160) };
            } catch (e) {
              return { key: n, model, label, ok: false, status: 0, error: e.message };
            }
          }),
        ),
      ),
    )
  ).flat();
  return { ok: models.every((m) => m.ok), keyCount: keys.length, models, checkedAt: new Date().toISOString() };
}
