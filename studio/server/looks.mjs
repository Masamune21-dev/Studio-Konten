// Cover modes of the cover system (since 19 Oct 2026). Until then each video drew a random
// palette and type set ("acak"); on the TikTok profile grid that read as many channels and the user
// called it "jelek, kaya ngga konsisten". Now every new video has the brand palette and three fonts;
// the mode only sets the cover colours and the series tag, and follows the content pillar. The list
// is read from the template (src/components/cover-modes.json, the brand's own copy when it has one),
// the same file design.ts and scripts/qa.mjs read, so the three never disagree.
import fs from "node:fs";
import { templateFile } from "../../scripts/brand.mjs";

const FILE = templateFile("src/components/cover-modes.json");
const load = () => {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return { modes: {}, tags: [] };
  }
};

// For the Buat video modal: key, name, hint, swatch [background, accent, second accent], default tag.
export const coverModes = () =>
  Object.entries(load().modes).map(([key, m]) => ({ key, name: m.name, hint: m.hint, swatch: [m.bg, m.accent, m.accent2], tag: m.tag, pillars: m.pillars }));

// requested.mode: a mode key, or "auto"/missing = from the pillar (the agent may still switch a tips
// video whose cover is a number comparison to "hitungan"). reply: the idea answers a viewer comment.
export function resolveLook(requested = {}, { pillar = "", reply = false } = {}) {
  const { modes, tags } = load();
  const picked = modes[requested.mode] ? requested.mode : null;
  const fromPillar = Object.entries(modes).find(([, m]) => m.pillars?.includes(pillar))?.[0] ?? null;
  const mode = picked ?? fromPillar;
  const tag = tags.includes(requested.tag) ? requested.tag : reply ? "BALAS KOMEN" : pillar === "ai" ? "AI" : mode ? modes[mode].tag : null;
  return { mode, tag, auto: !picked };
}

// One prompt line for the job: which mode and tag, or how to choose when the pillar is unknown.
export const describeLook = (look) => {
  const { modes, tags } = load();
  const m = modes[look?.mode];
  const list = Object.entries(modes)
    .map(([k, x]) => `"${k}" (${x.name}: ${x.hint})`)
    .join(", ");
  if (!m) return `mode belum dipilih: pilih dari pilar/topik salah satu dari ${list}; label seri dari ${tags.map((t) => `"${t}"`).join(", ")}`;
  const why = look.auto ? ` (otomatis dari pilar; kalau sampulnya perbandingan angka, boleh ganti ke "hitungan")` : " (pilihan user, jangan diganti)";
  return `mode "${look.mode}" (${m.name}: ${m.hint})${why}, label seri "${look.tag ?? m.tag}"`;
};
