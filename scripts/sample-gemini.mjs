// Render the first two scenes with several Gemini voices for side-by-side
// listening. Uses one TTS request per voice, so mind the ~10/day free quota.
//   npm run samples -- Puck Fenrir Achird
import fs from "node:fs/promises";
import "./project.mjs";
import { geminiTts } from "./gemini-tts.mjs";
import { speakableFor } from "./lexicon.mjs";

const script = JSON.parse(await fs.readFile("src/script.json", "utf8"));
const voices = process.argv.slice(2).length ? process.argv.slice(2) : ["Puck", "Fenrir", "Achird"];

await fs.mkdir("out/samples", { recursive: true });
for (const [i, voice] of voices.entries()) {
  const speakable = await speakableFor(voice);
  const text = script.scenes.slice(0, 2).map((s) => s.say ?? speakable(s.vo)).join(" ");
  const out = `out/samples/${i + 1}-${voice}.wav`;
  const d = await geminiTts({ text, voice, style: script.style, out });
  console.log(`${i + 1} ${voice} ${d.toFixed(2)}s → ${out}`);
}
