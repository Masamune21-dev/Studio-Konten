import Anthropic from "@anthropic-ai/sdk";
import { setting } from "./db.mjs";

// Quick text tasks (ideas, captions) try each configured model in order until one answers.
// "anthropic:<id>" goes to the Anthropic API, anything else to the user's 9router
// (OpenAI-compatible). Video work goes to Claude Code.
export const DEFAULT_MODELS = "ag/claude-sonnet-4-6, ag/gemini-3.8-flash, gemini/gemini-3.8-flash";
export const ANTHROPIC_PREFIX = "anthropic:";

// Keys saved in Pengaturan win over .env. The Anthropic key is never put in process.env:
// Claude Code jobs inherit that env and would then bill the API instead of the subscription.
export const routerConfig = () => ({
  base: (setting("router_base_url", "") || process.env.ROUTER_BASE_URL || "").replace(/\/+$/, ""),
  key: setting("router_api_key", "") || process.env.ROUTER_API_KEY || "",
});
const anthropicKey = () => setting("anthropic_api_key", "");

// What the dashboard may know about the keys: whether one is set, never the key itself.
export const keyStatus = () => ({
  router: {
    base_url: setting("router_base_url", ""),
    env_base_url: process.env.ROUTER_BASE_URL ?? "",
    has_key: Boolean(setting("router_api_key", "")),
    env_key: Boolean(process.env.ROUTER_API_KEY),
  },
  anthropic: { has_key: Boolean(anthropicKey()) },
});

let client = null;
const anthropic = () => {
  const apiKey = anthropicKey();
  if (!apiKey) throw new Error("API key Anthropic belum diisi di Pengaturan");
  if (client?.apiKey !== apiKey) client = new Anthropic({ apiKey, timeout: 300000, maxRetries: 2 });
  return client;
};

// Short Indonesian messages for the dashboard instead of the raw API error body.
const anthropicError = (e) => {
  if (e instanceof Anthropic.AuthenticationError) return new Error("API key Anthropic ditolak: salah atau sudah dicabut");
  if (e instanceof Anthropic.PermissionDeniedError) return new Error("API key Anthropic tidak punya izin untuk ini");
  if (e instanceof Anthropic.NotFoundError) return new Error("model tidak ada untuk key ini");
  if (e instanceof Anthropic.RateLimitError) return new Error("batas pemakaian Anthropic tercapai, coba lagi nanti");
  if (e instanceof Anthropic.APIError) return new Error(`Anthropic ${e.status ?? ""}: ${e.error?.error?.message ?? e.message}`.trim());
  return e;
};

// Model lists for the dropdowns, kept 10 minutes per key so the page opens fast.
const lists = new Map();
export async function listModels(provider, fresh = false) {
  const key = provider === "anthropic" ? anthropicKey() : routerConfig().key;
  const hit = lists.get(provider);
  if (!fresh && hit && hit.key === key && Date.now() - hit.at < 600000) return hit.models;
  let models;
  if (provider === "anthropic") {
    models = [];
    try {
      for await (const m of anthropic().models.list()) models.push({ id: m.id, name: m.display_name, max_tokens: m.max_tokens });
    } catch (e) {
      throw anthropicError(e);
    }
  } else if (provider === "router") {
    const { base } = routerConfig();
    if (!base || !key) throw new Error("Base URL / API key 9router belum diisi");
    const res = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20000) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !Array.isArray(data.data)) throw new Error(`9router: ${JSON.stringify(data.error ?? data).slice(0, 160) || res.status}`);
    models = data.data.map((m) => ({ id: m.id, group: m.owned_by ?? "", max_tokens: m.max_completion_tokens }));
  } else throw new Error(`Penyedia tidak dikenal: ${provider}`);
  lists.set(provider, { key, at: Date.now(), models });
  return models;
}

async function askRouter(model, system, user) {
  const { base, key } = routerConfig();
  if (!base || !key) throw new Error("Base URL / API key 9router belum diisi");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(120000),
  });
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!res.ok || !text) throw new Error(JSON.stringify(data.error ?? data).slice(0, 200));
  return text;
}

// These models can decline on a safety classifier; "default" lets the API rerun the
// request on the model Anthropic recommends for that kind of refusal.
const FALLBACK = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

async function askAnthropic(model, system, user) {
  // Streamed, because 10 ideas on a thinking model take minutes (Fable 5.1: ±130 s for 5 ideas,
  // 19 Oct 2026); a plain request would hit the HTTP timeout and start over. Thinking counts
  // toward max_tokens and 5 ideas already used 9.5K, so leave room; older models allow less.
  const cap = (await listModels("anthropic").catch(() => [])).find((m) => m.id === model)?.max_tokens;
  const params = { model, max_tokens: Math.min(64000, cap || 64000), system, messages: [{ role: "user", content: user }] };
  const stream = FALLBACK.has(model)
    ? anthropic().beta.messages.stream({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
    : anthropic().messages.stream(params);
  const msg = await stream.finalMessage().catch((e) => {
    throw anthropicError(e);
  });
  if (msg.stop_reason === "refusal") throw new Error(`ditolak model (${msg.stop_details?.category ?? "refusal"})`);
  if (msg.stop_reason === "max_tokens") throw new Error("jawaban terpotong (max_tokens)");
  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  if (!text) throw new Error(`jawaban kosong (${msg.stop_reason})`);
  return text;
}

export async function chatJson(system, user) {
  const models = setting("llm_models", DEFAULT_MODELS)
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  let lastError = "";
  for (const model of models) {
    try {
      const text = model.startsWith(ANTHROPIC_PREFIX) ? await askAnthropic(model.slice(ANTHROPIC_PREFIX.length), system, user) : await askRouter(model, system, user);
      const json = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
      return { model, data: JSON.parse(json) };
    } catch (e) {
      lastError = `${model}: ${e.message}`;
    }
  }
  throw new Error(`Semua model gagal. Terakhir: ${lastError}`);
}

// TikTok allows 5 hashtags; normalise whatever the model returns.
export const cleanTags = (tags) =>
  [...new Set((Array.isArray(tags) ? tags : String(tags ?? "").split(/[\s,]+/)).map((t) => "#" + String(t).replace(/^#+/, "").trim().toLowerCase()).filter((t) => t.length > 1))].slice(0, 5);
