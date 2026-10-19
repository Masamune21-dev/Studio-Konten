// Quality gate for an edited upload (src/edit.json, compositions Edit / EditWide; SKILL.md step 9).
// Run from the project after `npm run render:edit` (or render:edit:yt for "format": "landscape"):
//   npm run qa:edit                 npm run qa:edit -- --durasi=30
// Checks: TypeScript; sources exist and every cut lies inside its clip; transcript present when
// captions are on; length; zoom count; and for the MP4: same length as the edit, not older than its
// sources, rhythm (filmstrip), smooth motion away from the cuts, loudness -14 LUFS. Writes
// out/qa[-yt]/report.json with a still of frame 0 and of every cut, like npm run qa, so the Studio
// video card shows it. ✗ = must fix, ⚠ = look at it. Exit code 1 on any ✗.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { chromiumOptions, outFps, root } from "./project.mjs";
import { STILL_FAIL, STILL_WARN, analyse, filmstrip, snaps } from "./ritme.mjs";

const args = process.argv.slice(2);
const target = Number(args.find((a) => a.startsWith("--durasi="))?.split("=")[1]) || null;
const editFile = path.join(root, "src/edit.json");
if (!fs.existsSync(editFile)) {
  console.error("Tidak ada src/edit.json: ini bukan proyek edit video (pakai npm run qa).");
  process.exit(1);
}
const edit = JSON.parse(fs.readFileSync(editFile, "utf8"));
const wide = edit.format === "landscape";
const outRel = wide ? "out/qa-yt" : "out/qa";
const out = path.join(root, outRel);
const slug = path.basename(root);
const mp4 = path.resolve(root, "..", "output", `${slug}${wide ? "-yt" : ""}.mp4`);
const FPS = 30; // logical frames, as in src/Footage.tsx
const K = outFps / FPS;

const checks = [];
const add = (key, label, status, detail = "") => {
  checks.push({ key, label, status, detail });
  console.log(`${{ ok: "✓", warn: "⚠", fail: "✗" }[status]} ${label}${detail ? ` — ${detail}` : ""}`);
};
const run = (cmd, a) => spawnSync(cmd, a, { cwd: root, encoding: "utf8", maxBuffer: 64 << 20 });
const tail = (s, n = 3) => s.split("\n").map((l) => l.trim()).filter((l) => l && !l.includes("macOS")).slice(-n).join(" | ");
const probeDur = (file) => Number(run("npx", ["remotion", "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).stdout.trim().split("\n").filter((l) => /^[\d.]+$/.test(l)).pop());

// Same timeline as src/Footage.tsx.
const segs = [];
let at = 0;
for (const s of edit.segments ?? []) {
  const frames = Math.max(1, Math.round(((s.to - s.from) / (s.speed ?? 1)) * FPS));
  segs.push({ ...s, at, frames });
  at += frames;
}
const totalS = Math.max(FPS, at) / FPS;
const cuts = segs.slice(1).map((s) => s.at / FPS);
console.log(`QA edit ${slug}${wide ? " (16:9)" : " (9:16)"}: ${segs.length} potongan, ${totalS.toFixed(1)} dtk`);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

/* ---------- TypeScript ---------- */
{
  const r = run("npx", ["tsc", "-p", "."]);
  add("tsc", "TypeScript", r.status === 0 ? "ok" : "fail", r.status === 0 ? "" : tail(r.stdout + r.stderr));
}

/* ---------- sources and cuts ---------- */
{
  const problems = [];
  const durs = {};
  for (const [key, rel] of Object.entries(edit.sources ?? {})) {
    const f = path.join(root, "public", rel);
    if (!fs.existsSync(f)) problems.push(`sumber "${key}" tidak ada (public/${rel})`);
    else durs[key] = probeDur(f);
  }
  const short = [];
  segs.forEach((s, i) => {
    const d = durs[s.src];
    if (!(s.src in (edit.sources ?? {}))) problems.push(`potongan ${i + 1}: sumber "${s.src}" tidak terdaftar`);
    else if (d && (s.from < 0 || s.to > d + 0.05)) problems.push(`potongan ${i + 1}: ${s.from}–${s.to} dtk di luar panjang klip (${d.toFixed(1)} dtk)`);
    if (s.to - s.from < 0.4) short.push(i + 1);
  });
  if (!segs.length) problems.push("belum ada potongan di edit.json");
  add(
    "sumber",
    "Sumber & potongan",
    problems.length ? "fail" : short.length ? "warn" : "ok",
    problems.length ? problems.join("; ") : short.length ? `potongan sangat pendek (< 0,4 dtk): ${short.join(", ")}` : `${Object.keys(edit.sources ?? {}).length} klip, ${segs.length} potongan`,
  );
}

/* ---------- transcript ---------- */
if (edit.captions !== false) {
  let words = {};
  try {
    words = JSON.parse(fs.readFileSync(path.join(root, "src/footage-words.json"), "utf8"));
  } catch {}
  const used = [...new Set(segs.map((s) => path.basename(edit.sources?.[s.src] ?? "")))].filter(Boolean);
  const missing = used.filter((n) => !(n in words));
  const silent = used.filter((n) => n in words && !words[n].length);
  add(
    "transkrip",
    "Transkrip untuk subtitle",
    missing.length ? "fail" : silent.length ? "warn" : "ok",
    missing.length ? `belum ditranskrip: ${missing.join(", ")} (npm run transcribe)` : silent.length ? `tidak ada ucapan terdengar di ${silent.join(", ")}: subtitle kosong di sana` : `${used.length} klip`,
  );
}

/* ---------- length ---------- */
{
  const [lo, hi] = target ? [target * 0.85, target * 1.2] : [8, 180];
  add("durasi", "Durasi", totalS >= lo && totalS <= hi ? "ok" : "warn", `${totalS.toFixed(1)} dtk${target ? `, target ±${target} dtk` : ""}`);
}

/* ---------- zoom ---------- */
{
  const zooms = edit.zoom ?? [];
  const strong = zooms.filter((z) => (z.skala ?? 1.08) > 1.12).length;
  add("zoom", "Zoom secukupnya", zooms.length > 5 ? "fail" : zooms.length > 3 || strong ? "warn" : "ok", `${zooms.length} punch-in, ${(edit.sorot ?? []).length} sorot${strong ? `; ${strong} dengan skala > 1,12` : ""}`);
}

/* ---------- stills: frame 0 and every cut ---------- */
const sheet = [];
try {
  const chromeDir = path.join(root, "../node_modules/.remotion/chrome-headless-shell");
  const platform = fs.readdirSync(chromeDir).find((d) => fs.statSync(path.join(chromeDir, d)).isDirectory());
  const inner = fs.readdirSync(path.join(chromeDir, platform)).find((d) => d.startsWith("chrome-headless-shell"));
  const browserExecutable = path.join(chromeDir, platform, inner, "chrome-headless-shell");
  const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), enableCaching: false, rootDir: root, publicDir: path.join(root, "public") });
  const browser = await openBrowser("chrome", { browserExecutable, logLevel: "error", chromiumOptions });
  const composition = await selectComposition({ serveUrl, id: wide ? "EditWide" : "Edit", puppeteerInstance: browser, browserExecutable, logLevel: "error" });
  const still = (frame, file) => renderStill({ serveUrl, composition, frame: Math.min(composition.durationInFrames - 1, Math.round(frame * K)), output: path.join(out, file), imageFormat: "jpeg", scale: 0.35, puppeteerInstance: browser, browserExecutable, logLevel: "error" });
  await still(0, "f0.jpg");
  sheet.push({ scene: "frame 0", file: `${outRel}/f0.jpg` });
  for (const [i, s] of segs.slice(0, 14).entries()) {
    await still(s.at + Math.round(s.frames * 0.6), `cut${i + 1}.jpg`);
    sheet.push({ scene: `potongan ${i + 1}`, file: `${outRel}/cut${i + 1}.jpg` });
  }
  await browser.close({ silent: true });
  add("still", "Still per potongan", "ok", `${sheet.length} still di ${outRel}/ (lihat: judul/ikon tidak menutupi wajah atau teks penting)`);
} catch (e) {
  add("still", "Still per potongan", "fail", `still gagal dirender: ${e.message.split("\n")[0]}`);
}

/* ---------- the rendered MP4 ---------- */
const result = {};
if (!fs.existsSync(mp4)) add("mp4", "MP4 final", "warn", `belum dirender (${path.relative(root, mp4)}; npm run render:edit${wide ? ":yt" : ""})`);
else {
  const dur = probeDur(mp4);
  result.duration_s = +dur.toFixed(2);
  let newest = 0;
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else newest = Math.max(newest, fs.statSync(f).mtimeMs);
    }
  };
  walk(path.join(root, "src"));
  walk(path.join(root, "public"));
  if (Math.abs(dur - totalS) > 0.25) add("mp4", "MP4 final", "fail", `durasi MP4 ${dur.toFixed(1)} dtk ≠ edit ${totalS.toFixed(1)} dtk: render ulang`);
  else if (fs.statSync(mp4).mtimeMs < newest) add("mp4", "MP4 final", "warn", "ada file sumber yang lebih baru dari MP4: render ulang kalau perubahannya belum masuk");
  else add("mp4", "MP4 final", "ok", `${dur.toFixed(1)} dtk, sesuai edit`);

  try {
    const a = analyse(mp4);
    filmstrip(a, path.join(out, "ritme.png"));
    result.ritme = { beats_per_10s: a.perTen, longest_still_s: a.longest, still: a.still };
    const where = a.still.map(([s, e]) => `${s}–${e}`).join(", ");
    add("ritme", "Ritme (layar tidak diam)", a.longest >= STILL_FAIL ? "fail" : a.longest >= STILL_WARN ? "warn" : "ok", `${a.perTen} beat per 10 dtk, diam terlama ${a.longest} dtk${where ? ` di ${where}` : ""}; filmstrip ${outRel}/ritme.png${a.longest >= STILL_WARN ? '. Tambah beat: potong lebih rapat, overlay ikon/teks/judul, "sorot", atau ganti sudut (x/y) antar potongan' : ""}`);
  } catch (e) {
    add("ritme", "Ritme (layar tidak diam)", "warn", `gagal dianalisis: ${e.message.split("\n")[0]}`);
  }
  // Hard cuts are meant to jump; only snaps away from them count.
  try {
    const found = snaps(mp4, cuts.map((c) => [c - 0.05, c + 0.2]));
    result.patah = found;
    add("gerak", "Gerak halus (tanpa patah)", found.length ? "warn" : "ok", found.length ? `${found.length} bagian lompat dalam 1 frame di luar potongan: ${found.map((x) => `${x.t.toFixed(1)} dtk`).join(", ")} — bisa dari rekamannya sendiri; kalau dari overlay, beri masuk/keluar` : "tidak ada");
  } catch (e) {
    add("gerak", "Gerak halus (tanpa patah)", "warn", `gagal dianalisis: ${e.message.split("\n")[0]}`);
  }
  const l = run("node", ["../scripts/loudness.mjs", "--check", mp4]);
  const m = l.stdout.match(/(-?\d+(?:\.\d+)?) LUFS, TP (-?\d+(?:\.\d+)?)/);
  if (m) result.loudness = { I: Number(m[1]), TP: Number(m[2]) };
  add("loudness", "Keras suara −14 LUFS", !m ? "warn" : l.status === 0 ? "ok" : "warn", m ? `${m[1]} LUFS, true peak ${m[2]} dBTP${l.status === 0 ? "" : " — jalankan npm run loudness"}` : tail(l.stderr || l.stdout));
}

const status = checks.some((c) => c.status === "fail") ? "fail" : checks.some((c) => c.status === "warn") ? "warn" : "ok";
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify({ at: new Date().toISOString(), project: slug, kind: "edit", format: wide ? "landscape" : "portrait", status, timeline_s: +totalS.toFixed(2), target_s: target, ...result, checks, sheet }, null, 2) + "\n");
const counts = ["fail", "warn"].map((k) => checks.filter((c) => c.status === k).length);
console.log(`\n${status === "ok" ? "LOLOS QA" : status === "warn" ? `LOLOS dengan ${counts[1]} catatan ⚠` : `GAGAL: ${counts[0]} ✗ harus diperbaiki`} — ${outRel}/report.json`);
process.exit(status === "fail" ? 1 : 0);
