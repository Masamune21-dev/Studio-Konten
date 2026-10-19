// Captions keep `vo` while the TTS gets a phonetic respelling of words the
// chosen voice mispronounces. pronunciation.json is keyed per voice: an exact
// voice id wins, else its language prefix (e.g. "id-ID").
import fs from "node:fs/promises";
import path from "node:path";

import { root } from "./project.mjs";
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function speakableFor(voice) {
  const lexicons = JSON.parse(await fs.readFile(path.join(root, "pronunciation.json"), "utf8"));
  const lexicon = Object.entries(lexicons[voice] ?? lexicons[voice.slice(0, 5)] ?? {}).sort((a, b) => b[0].length - a[0].length);
  return (text) =>
    lexicon.reduce((t, [from, to]) => t.replace(new RegExp(`(?<![\\w-])${escape(from)}(?![\\w-])`, "gi"), to), text);
}
