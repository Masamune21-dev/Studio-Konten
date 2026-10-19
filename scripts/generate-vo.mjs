// Generate voice-over per scene, then record durations so each scene's length follows its
// narration. "engine": "gemini" goes to generate-vo-gemini.mjs; any other engine uses an older
// HTTP TTS server (TTS_API_URL in .env, or legacyTtsUrl in the brand).
import fs from "node:fs/promises";
import path from "node:path";
import { speakableFor } from "./lexicon.mjs";

import { root } from "./project.mjs";
import { BRAND } from "./brand.mjs";
const script = JSON.parse(await fs.readFile(path.join(root, "src/script.json"), "utf8"));
const only = process.argv.slice(2); // optional: regenerate specific scene ids

if (script.engine === "gemini") {
  await import("./generate-vo-gemini.mjs");
  process.exit(0);
}

const durationsPath = path.join(root, "src/vo-durations.json");
let durations = {};
try {
  durations = JSON.parse(await fs.readFile(durationsPath, "utf8"));
} catch {}

const API = process.env.TTS_API_URL || BRAND.legacyTtsUrl;
if (!API) throw new Error('Engine selain "gemini" butuh TTS_API_URL di .env (atau legacyTtsUrl di brand). Pakai "engine": "gemini" di script.json.');

const speakable = await speakableFor(script.voice);

await fs.mkdir(path.join(root, "public/vo"), { recursive: true });

for (const scene of script.scenes) {
  if (only.length && !only.includes(scene.id)) continue;
  const res = await fetch(`${API}/api/generate/standard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: scene.say ?? speakable(scene.vo),
      voice: script.voice,
      rate: script.rate ?? "+0%",
      pitch: "+0Hz",
      volume: "+0%",
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.audio_url) throw new Error(`${scene.id}: ${data.detail ?? res.status}`);
  const audio = await fetch(new URL(data.audio_url, API));
  await fs.writeFile(path.join(root, `public/vo/${scene.id}.mp3`), Buffer.from(await audio.arrayBuffer()));
  durations[scene.id] = data.duration;
  console.log(`${scene.id}  ${data.duration.toFixed(2)}s  ${data.text}`);
}

await fs.writeFile(durationsPath, JSON.stringify(durations, null, 2) + "\n");
const total = Object.values(durations).reduce((a, b) => a + b, 0);
console.log(`total narasi: ${total.toFixed(1)}s`);
