// Transcribe each scene's VO via the router and compare with the script.
// Scenes are sent a few at a time (router-audio.mjs), and each transcript is cached per audio
// content in out/check-vo.json, so a re-run after fixing one cut only sends the changed scenes
// (--fresh asks the router again for every scene).
import fs from "node:fs/promises";
import crypto from "node:crypto";
import "./project.mjs";
import { MODEL, hear, pool } from "./router-audio.mjs";
const script = JSON.parse(await fs.readFile("src/script.json", "utf8"));
const ext = script.engine === "gemini" ? "wav" : "mp3";
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const fresh = process.argv.includes("--fresh");
const cacheFile = "out/check-vo.json";
const cache = JSON.parse(await fs.readFile(cacheFile, "utf8").catch(() => "{}"));
const scenes = script.scenes.filter((s) => !only.length || only.includes(s.id));
const lines = await pool(scenes, async (s) => {
  const buf = await fs.readFile(`public/vo/${s.id}.${ext}`);
  const key = `${MODEL}:${crypto.createHash("sha1").update(buf).digest("hex")}`;
  const heard = (!fresh && cache[key]) || (await hear(buf, ext, "Transkripsikan audio ini kata per kata. Balas hanya transkripnya."));
  if (heard) cache[key] = heard;
  const [a, b] = [norm(s.vo), norm(heard)];
  const ok = a[0] === b[0] && a.at(-1) === b.at(-1);
  return `${ok ? "✓" : "✗"} ${s.id}: ${heard || "? (router tidak menjawab, jalankan lagi)"}`;
});
await fs.mkdir("out", { recursive: true });
await fs.writeFile(cacheFile, JSON.stringify(cache, null, 1));
console.log(lines.join("\n"));
