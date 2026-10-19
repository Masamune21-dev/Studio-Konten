// Gemini free tier allows ~10 requests/day per model, so each voice speaks ALL of
// its lines in ONE request with long pauses between them, and the take is cut
// back into one clip per line at the longest silences.
//
// Dialog: `voices` in script.json maps a speaker (a character key from the brand) to a Gemini voice
// and style; a scene names its speaker with `who`, or splits into `turns`
// ([{ who, vo }]). Turn clips are joined with a short gap, and their timings go
// to src/vo-turns.json so only the character who is talking moves.
//   npm run vo                 all voices
//   npm run vo -- --only=sari re-record one voice (e.g. after changing it)
//   npm run vo:reuse           re-cut the saved takes without using quota
//
// Per-voice options in script.json `voices.<who>`:
//   "cuts": [s, …]   rough start of each pause between lines, snapped to the nearest
//                    pause; for when the automatic pick lands on a pause inside a line.
//                    (Older projects use top-level "cuts": {"<who>": [exact s, …]}.)
//   "tighten": true  or {"pause": 0.35, "tempo": 1}: shorten pauses inside each
//                    line to `pause` s and, only if `tempo` > 1, speed up (pitch kept).
//                    For voices with long gaps (Charon). Applied on every vo / vo:reuse.
//                    Since 9 Oct 2026 the default no longer speeds up: the user found
//                    3.2 words/s ("ngomong cepet") too fast; fit length with the script.
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { geminiTts } from "./gemini-tts.mjs";
import { speakableFor } from "./lexicon.mjs";
import { root } from "./project.mjs";

const script = JSON.parse(await fs.readFile(path.join(root, "src/script.json"), "utf8"));
const reuse = process.argv.includes("--reuse");
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
// Repeated <pause> tags make line gaps the longest silences in the take
const SEP = "\n\n" + "<pause> ".repeat(8) + "\n\n";
const GAP = 0.3; // seconds of silence between turns inside one scene

const voices = script.voices ?? { narrator: { voice: script.voice, style: script.style } };
const first = Object.keys(voices)[0];
const lines = script.scenes.flatMap((s) =>
  (s.turns ?? [{ who: s.who ?? first, vo: s.vo, say: s.say }]).map((t) => ({ scene: s.id, who: t.who ?? first, vo: t.vo, say: t.say })),
);
for (const l of lines) if (!voices[l.who]) throw new Error(`${l.scene}: pembicara "${l.who}" tidak ada di voices`);
const takeFile = (who) => path.join(root, script.voices ? `out/vo-full-${who}.wav` : "out/vo-full.wav");
await fs.mkdir(path.join(root, "out"), { recursive: true });

let fmt = null; // { header, rate } of the first take; all takes must match
for (const [who, cfg] of Object.entries(voices)) {
  const mine = lines.filter((l) => l.who === who);
  if (!mine.length) continue;
  const speakable = await speakableFor(cfg.voice);
  for (const l of mine) l.text = l.say ?? speakable(l.vo);
  const full = takeFile(who);
  if (!reuse && (!only || only === who)) {
    const take = full.replace(/\.wav$/, ".take.wav");
    const d = await geminiTts({ text: mine.map((l) => l.text).join(SEP), voice: cfg.voice, style: cfg.style ?? script.style, out: take });
    // The model sometimes stops early; Indonesian narration runs ~0.055 s/char
    const minimum = mine.reduce((n, l) => n + l.text.length, 0) * 0.04;
    if (d < minimum) throw new Error(`${who}: narasi terpotong (${d.toFixed(1)}s, minimal ${minimum.toFixed(0)}s); ${path.basename(full)} tidak diubah`);
    await fs.rename(take, full);
    console.log(`${who} (${cfg.voice}): ${d.toFixed(1)}s`);
  }
  const cut = await cutTake(full, mine.map((l) => l.text), who);
  if (fmt && fmt.rate !== cut.rate) throw new Error(`sample rate ${who} beda (${cut.rate} vs ${fmt.rate})`);
  fmt ??= cut;
  mine.forEach((l, i) => (l.pcm = cut.clips[i]));
  if (cfg.tighten) {
    const opt = { pause: 0.35, tempo: 1, ...(cfg.tighten === true ? {} : cfg.tighten) };
    for (const l of mine) l.pcm = tighten(l.pcm, cut.rate, opt, `${l.scene}-${who}`);
    console.log(`${who}: jeda dipendekkan ke ${opt.pause}s, tempo ×${opt.tempo}`);
  }
}

// --- join each scene's turns and write one WAV per scene
const header = (bytes) => {
  const h = Buffer.from(fmt.header);
  h.writeUInt32LE(36 + bytes, 4);
  h.write("data", 36);
  h.writeUInt32LE(bytes, 40);
  return h;
};
const durations = {};
const turns = {};
await fs.mkdir(path.join(root, "public/vo"), { recursive: true });
for (const s of script.scenes) {
  const parts = lines.filter((l) => l.scene === s.id);
  const gap = new Int16Array(Math.round(GAP * fmt.rate));
  const chunks = [];
  let t = 0;
  turns[s.id] = parts.map((p, i) => {
    if (i) (chunks.push(gap), (t += gap.length / fmt.rate));
    chunks.push(p.pcm);
    const turn = { who: p.who, start: +t.toFixed(3), end: +(t + p.pcm.length / fmt.rate).toFixed(3), vo: p.vo };
    t = turn.end;
    return turn;
  });
  const bytes = Buffer.concat(chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength)));
  await fs.writeFile(path.join(root, `public/vo/${s.id}.wav`), Buffer.concat([header(bytes.length), bytes]));
  durations[s.id] = +t.toFixed(2);
  console.log(`${s.id}  ${durations[s.id].toFixed(2)}s  ${parts.map((p) => `[${p.who}] ${p.vo}`).join("  ")}`);
}
await fs.writeFile(path.join(root, "src/vo-durations.json"), JSON.stringify(durations, null, 2) + "\n");
await fs.writeFile(path.join(root, "src/vo-turns.json"), JSON.stringify(turns, null, 2) + "\n");
console.log(`total narasi: ${Object.values(durations).reduce((x, y) => x + y, 0).toFixed(1)}s`);

// Cut one take into `texts.length` clips at the pauses between them, each trimmed
// to 80 ms of silence on both sides.
async function cutTake(file, texts, who) {
  const wav = await fs.readFile(file);
  const rate = wav.readUInt32LE(24);
  // Read the data chunk only. Gemini appends a C2PA provenance chunk (6070 bytes) after
  // the audio; read as samples it was 0.13 s of white noise at the end of each take (the "dret").
  const dataAt = wav.indexOf("data", 12) + 8;
  const dataEnd = Math.min(wav.length, dataAt + wav.readUInt32LE(dataAt - 4));
  const pcm = new Int16Array(wav.buffer.slice(wav.byteOffset + dataAt, wav.byteOffset + dataEnd));

  // loudness per 10 ms window
  const WIN = Math.round(rate / 100);
  const rms = [];
  for (let i = 0; i + WIN <= pcm.length; i += WIN) {
    let s = 0;
    for (let j = i; j < i + WIN; j++) s += pcm[j] * pcm[j];
    rms.push(Math.sqrt(s / WIN));
  }
  const loud = [...rms].sort((a, b) => a - b)[Math.floor(rms.length * 0.9)];
  const quiet = loud * 0.04;

  let bounds = [0, rms.length];
  // Older projects: "cuts": { "<who>": [seconds, …] } at the top of script.json, exact cut
  // times, one per boundary.
  const exact = script.cuts?.[who];
  if (exact && exact.length === texts.length - 1) {
    console.log(`${who} dipotong manual di:`, exact.join(" "));
    bounds = [0, ...exact.map((s) => Math.round(s * 100)), rms.length];
  } else if (texts.length > 1) {
    // silent runs (in windows), ignoring leading/trailing silence
    const runs = [];
    let start = -1;
    for (let i = 0; i <= rms.length; i++) {
      const silent = i < rms.length && rms[i] < quiet;
      if (silent && start < 0) start = i;
      if (!silent && start >= 0) {
        if (start > 0 && i < rms.length) runs.push({ start, end: i, len: i - start });
        start = -1;
      }
    }
    const manual = script.voices?.[who]?.cuts;
    if (manual) {
      // Snap each given time to the nearest pause (≥ 50 ms) so the cut lands in silence.
      const near = runs.filter((r) => r.len >= 5);
      const picked = manual.map((t) => near.reduce((a, c) => (Math.abs(c.start / 100 - t) < Math.abs(a.start / 100 - t) ? c : a)));
      console.log(`${who} dipotong manual di:`, picked.map((c) => ((c.start + c.end) / 200).toFixed(1)).join(" "));
      bounds = [0, ...picked.map((c) => Math.round((c.start + c.end) / 2)), rms.length];
    } else {
      // Separators usually give the longest pauses, but the model sometimes skips
      // one. Pick one pause per boundary, in order, maximising
      // (pause length − 0.15 × distance from where text length expects it).
      const total = rms.length / 100;
      const chars = texts.map((t) => t.length);
      const sum = chars.reduce((x, y) => x + y);
      let acc = 0;
      const expected = chars.slice(0, -1).map((c) => ((acc += c) / sum) * total);
      const cand = runs.filter((r) => r.len >= 25).sort((a, b) => a.start - b.start);
      const score = (k, c) => c.len / 100 - 0.15 * Math.abs(c.start / 100 - expected[k]);
      const best = expected.map(() => cand.map(() => -Infinity));
      const from = expected.map(() => cand.map(() => -1));
      cand.forEach((c, j) => (best[0][j] = score(0, c)));
      for (let k = 1; k < expected.length; k++)
        for (let j = 0; j < cand.length; j++)
          for (let i = 0; i < j; i++)
            if (best[k - 1][i] + score(k, cand[j]) > best[k][j]) {
              best[k][j] = best[k - 1][i] + score(k, cand[j]);
              from[k][j] = i;
            }
      let j = best.at(-1).indexOf(Math.max(...best.at(-1)));
      if (j < 0 || best.at(-1)[j] === -Infinity) throw new Error(`${who}: jeda antar-kalimat tidak cukup; cek ${path.basename(file)}`);
      const cuts = [];
      for (let k = expected.length - 1; k >= 0; k--) {
        cuts.unshift(cand[j]);
        j = from[k][j];
      }
      cuts.forEach((c, k) => {
        if (Math.abs(c.start / 100 - expected[k]) > 6)
          throw new Error(`${who}: jeda ke-${k + 1} di ${(c.start / 100).toFixed(1)}s, padahal perkiraan ${expected[k].toFixed(1)}s; cek ${path.basename(file)}`);
      });
      console.log(`${who} dipotong di:`, cuts.map((c) => ((c.start + c.end) / 200).toFixed(1)).join(" "));
      bounds = [0, ...cuts.map((c) => Math.round((c.start + c.end) / 2)), rms.length];
    }
  }
  const clips = texts.map((_, i) => {
    let a = bounds[i];
    let b = bounds[i + 1];
    while (a < b && rms[a] < quiet) a++;
    while (b > a && rms[b - 1] < quiet) b--;
    a = Math.max(bounds[i], a - 8);
    b = Math.min(bounds[i + 1], b + 8);
    // 10 ms fades so cut edges never click.
    const clip = Int16Array.from(pcm.subarray(a * WIN, b * WIN));
    const fade = Math.min(WIN, clip.length >> 1);
    for (let j = 0; j < fade; j++) {
      clip[j] = Math.round((clip[j] * j) / fade);
      clip[clip.length - 1 - j] = Math.round((clip[clip.length - 1 - j] * j) / fade);
    }
    return clip;
  });
  return { rate, header: wav.subarray(0, 44), clips };
}

// Shorten the pauses inside one line to `pause` s, then speed it up by `tempo` with
// ffmpeg's atempo (pitch kept). Same steps as the tighten.py first used on the Mbps
// and YouTube-block videos (Charon: slow, long gaps).
function tighten(pcm, rate, { pause, tempo }, name) {
  const win = Math.floor(rate / 100);
  const loud = [];
  for (let i = 0; i < pcm.length; i += win) {
    let m = 0;
    for (let j = i; j < Math.min(i + win, pcm.length); j++) m = Math.max(m, Math.abs(pcm[j]));
    loud.push(m >= 600);
  }
  const keep = [];
  for (let i = 0; i < loud.length; ) {
    let j = i;
    while (j < loud.length && loud[j] === loud[i]) j++;
    let seg = pcm.subarray(i * win, j * win);
    if (!loud[i] && i > 0 && j < loud.length && (j - i) / 100 > pause) {
      const h = Math.floor((pause * rate) / 2);
      seg = Int16Array.of(...seg.subarray(0, h), ...seg.subarray(seg.length - h));
    }
    keep.push(seg);
    i = j;
  }
  const short = Buffer.concat(keep.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength)));
  if (tempo === 1) return new Int16Array(short.buffer.slice(short.byteOffset, short.byteOffset + short.length));
  const dir = path.join(root, "out/tighten");
  const src = path.join(dir, `${name}.wav`);
  const dst = path.join(dir, `${name}.tempo.wav`);
  mkdirSync(dir, { recursive: true });
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + short.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(short.length, 40);
  writeFileSync(src, Buffer.concat([h, short]));
  execFileSync("npx", ["remotion", "ffmpeg", "-y", "-loglevel", "error", "-i", src, "-filter:a", `atempo=${tempo}`, "-ar", String(rate), "-ac", "1", "-c:a", "pcm_s16le", dst], { cwd: root, stdio: "pipe" });
  // ffmpeg writes a LIST chunk before the audio, so walk the chunks to find `data`.
  const wav = readFileSync(dst);
  for (let o = 12; o + 8 <= wav.length; o += 8 + wav.readUInt32LE(o + 4) + (wav.readUInt32LE(o + 4) & 1)) {
    if (wav.toString("ascii", o, o + 4) !== "data") continue;
    const data = wav.subarray(o + 8, o + 8 + wav.readUInt32LE(o + 4));
    return new Int16Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.length));
  }
  throw new Error(`${name}: hasil atempo tanpa chunk data`);
}
