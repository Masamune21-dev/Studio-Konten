// Word-level transcript of uploaded footage with local Whisper (whisper.cpp + model "medium"), for
// per-word captions and for planning cuts (SKILL.md step 9 "Edit video upload"). Run from a project:
//   npm run transcribe                  every video in public/footage/
//   npm run transcribe -- a.mp4 b.mov   only these (names inside public/footage/)
//   npm run transcribe -- --lang=en     another language (default id)
//   node ../scripts/transcribe.mjs --install   only install whisper.cpp + the model
// The first run installs into <repo>/tools/whisper (git clone + make, then a
// ±1.5 GB model download; needs the Xcode command line tools). Writes:
//   src/footage-words.json   { "<file name>": [{ "text", "start", "end" }] } in seconds of the source,
//                            read by src/Footage.tsx for captions and "kata" cues
//   out/transcript-<name>.txt  one line per phrase with times, plus every pause ≥ 0.35 s, to decide cuts
// Whisper's word times run end to end (the silence between sentences is given to the words), so
// the pauses are measured from the audio itself and the word times are pulled back to the speech:
// cut inside a listed pause and no syllable is lost.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { downloadWhisperModel, installWhisperCpp, toCaptions, transcribe } from "@remotion/install-whisper-cpp";

const VERSION = "1.6.2"; // builds with plain `make`; 1.7.x calls cmake, which this Mac does not have
const MODEL = "medium";
// Shared by all projects, next to node_modules; a worktree uses the main folder's copy.
const videoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..").split(`${path.sep}.claude${path.sep}worktrees${path.sep}`)[0];
const TOOLS = process.env.WHISPER_TOOLS ?? path.join(videoRoot, "tools", "whisper");
const WHISPER = path.join(TOOLS, "whisper.cpp");

const args = process.argv.slice(2);
const lang = args.find((a) => a.startsWith("--lang="))?.split("=")[1] ?? "id";

async function ensureWhisper() {
  fs.mkdirSync(TOOLS, { recursive: true });
  const exe = path.join(WHISPER, "main");
  if (!fs.existsSync(exe)) {
    if (fs.existsSync(WHISPER)) {
      console.log(`whisper.cpp di ${WHISPER} belum selesai dibangun, ulangi make…`);
      const r = spawnSync("make", [], { cwd: WHISPER, stdio: "inherit" });
      if (r.status !== 0) throw new Error("make whisper.cpp gagal");
    } else {
      console.log(`Memasang whisper.cpp ${VERSION} ke ${WHISPER} (sekali saja)…`);
      await installWhisperCpp({ version: VERSION, to: WHISPER, printOutput: false });
    }
  }
  const model = path.join(TOOLS, `ggml-${MODEL}.bin`);
  if (!fs.existsSync(model)) {
    console.log(`Mengunduh model Whisper "${MODEL}" (±1,5 GB, sekali saja)…`);
    let last = 0;
    await downloadWhisperModel({
      model: MODEL,
      folder: TOOLS,
      printOutput: false,
      onProgress: (done, total) => {
        const pct = Math.floor((done / total) * 100);
        if (pct >= last + 10) (last = pct), console.log(`  ${pct}%`);
      },
    });
  }
}

const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;

// Pauses in a 16-bit mono WAV: 20 ms blocks quieter than 30 dB under the clip's speaking level (90th
// percentile of its blocks) or under −50 dBFS, for at least `min` seconds. Returns [start, end] in s.
function pauses(wavFile, min = 0.35) {
  const b = fs.readFileSync(wavFile);
  let o = 12, data = null, rate = 16000;
  while (o + 8 <= b.length) {
    const id = b.toString("ascii", o, o + 4), size = b.readUInt32LE(o + 4);
    if (id === "fmt ") rate = b.readUInt32LE(o + 12);
    if (id === "data") data = b.subarray(o + 8, Math.min(b.length, o + 8 + size));
    o += 8 + size + (size & 1);
  }
  if (!data) return [];
  const n = Math.floor(rate * 0.02);
  const db = [];
  for (let i = 0; i + n * 2 <= data.length; i += n * 2) {
    let sum = 0;
    for (let j = 0; j < n; j++) sum += (data.readInt16LE(i + j * 2) / 32768) ** 2;
    db.push(10 * Math.log10(sum / n + 1e-12));
  }
  const sorted = [...db].sort((x, y) => x - y);
  const quiet = Math.max(-50, sorted[Math.floor(sorted.length * 0.9)] - 30);
  const out = [];
  let st = -1;
  db.forEach((v, k) => {
    if (v < quiet && st < 0) st = k;
    if ((v >= quiet || k === db.length - 1) && st >= 0) {
      if ((k - st) * 0.02 >= min) out.push([+(st * 0.02).toFixed(2), +(k * 0.02).toFixed(2)]);
      st = -1;
    }
  });
  return out;
}

// Pull word edges out of the pauses (kept 40 ms inside the speech).
const fitToSpeech = (words, gaps) =>
  words.map((w) => {
    let { start, end } = w;
    for (const [a, z] of gaps) {
      if (start >= a - 0.02 && start < z && end > z) start = Math.max(start, z - 0.04);
      if (end > a && end <= z + 0.02 && start < a) end = Math.min(end, a + 0.04);
    }
    return { ...w, start: +start.toFixed(3), end: +Math.max(start + 0.05, end).toFixed(3) };
  });

async function run() {
  await ensureWhisper();
  if (args.includes("--install")) return console.log(`Whisper siap: ${WHISPER} + ggml-${MODEL}.bin`);
  const dir = path.resolve("public/footage");
  const names = args.filter((a) => !a.startsWith("--"));
  const files = (names.length ? names : fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => /\.(mp4|mov|m4v|webm|mkv)$/i.test(n)) : []).map((n) => path.join(dir, path.basename(n)));
  if (!files.length) throw new Error("Tidak ada video di public/footage/ (salin rekaman user ke sana dulu).");
  const outFile = path.resolve("src/footage-words.json");
  const all = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, "utf8")) : {};
  fs.mkdirSync("out", { recursive: true });
  for (const file of files) {
    if (!fs.existsSync(file)) throw new Error(`Tidak ada ${file}`);
    const name = path.basename(file);
    const wav = path.join(os.tmpdir(), `transcribe-${process.pid}-${name}.wav`);
    // 16 kHz mono PCM, what whisper.cpp expects.
    const ff = spawnSync("npx", ["remotion", "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", file, "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav], { encoding: "utf8" });
    if (ff.status !== 0 || !fs.existsSync(wav)) {
      console.log(`${name}: tidak ada audio yang bisa dibaca, dilewati (${ff.stderr.split("\n").filter((l) => l && !l.includes("macOS")).slice(-1)[0] ?? ""})`);
      all[name] = [];
      continue;
    }
    const t0 = Date.now();
    const out = await transcribe({ inputPath: wav, whisperPath: WHISPER, whisperCppVersion: VERSION, model: MODEL, modelFolder: TOOLS, tokenLevelTimestamps: true, splitOnWord: true, language: lang, printOutput: false });
    const gaps = pauses(wav);
    fs.rmSync(wav, { force: true });
    const { captions } = toCaptions({ whisperCppOutput: out });
    const words = fitToSpeech(
      captions.map((c) => ({ text: c.text.trim(), start: +(c.startMs / 1000).toFixed(3), end: +(c.endMs / 1000).toFixed(3) })).filter((w) => w.text && !/^\[.*\]$/.test(w.text)), // drop [MUSIC], [BLANK_AUDIO]
      gaps,
    );
    all[name] = words;
    // Readable transcript: phrases end at punctuation or a pause; every pause listed with its middle,
    // the safest place for a cut.
    const lines = [];
    let cur = [];
    const flush = () => cur.length && (lines.push(`[${fmt(cur[0].start)}–${fmt(cur[cur.length - 1].end)}] ${cur.map((w) => w.text).join(" ")}`), (cur = []));
    let g = 0;
    words.forEach((w) => {
      while (g < gaps.length && gaps[g][1] <= w.start + 0.05) {
        flush();
        const [a, z] = gaps[g++];
        lines.push(`        (jeda ${(z - a).toFixed(2)} dtk: ${fmt(a)}–${fmt(z)}, potong di ${((a + z) / 2).toFixed(2)})`);
      }
      cur.push(w);
      if (/[.?!]$/.test(w.text)) flush();
    });
    flush();
    for (; g < gaps.length; g++) lines.push(`        (jeda ${(gaps[g][1] - gaps[g][0]).toFixed(2)} dtk: ${fmt(gaps[g][0])}–${fmt(gaps[g][1])})`);
    fs.writeFileSync(path.join("out", `transcript-${name.replace(/\.[^.]+$/, "")}.txt`), `${name} · ${words.length} kata · bahasa ${lang}\n\n${lines.join("\n")}\n`);
    console.log(`${name}: ${words.length} kata dalam ${((Date.now() - t0) / 1000).toFixed(0)} dtk → out/transcript-${name.replace(/\.[^.]+$/, "")}.txt`);
  }
  fs.writeFileSync(outFile, JSON.stringify(all, null, 0).replace(/\],"/g, '],\n"') + "\n");
  console.log(`Waktu per kata → ${path.relative(process.cwd(), outFile)}`);
}

run().catch((e) => {
  console.error(`GAGAL: ${e.message}`);
  process.exit(1);
});
