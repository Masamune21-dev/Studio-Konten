// One quality gate before a video goes out. Run from a project folder after `npm run render`:
//   npm run qa                     TikTok version (composition Video)
//   npm run qa -- --yt             YouTube version (VideoWide)
//   npm run qa -- --durasi=30      compare the length with the job's target (left out = "Bebas": length only reported)
//   npm run qa -- --transkrip      also transcribe every clip (npm run check, uses the router)
// Checks: TypeScript, voice clips (complete, quiet tail = no "dret"), frame 0 already full (FYP
// rule), hook spoken within ~2 s, length, characters cut at the edges and captions over faces
// (check-crop), and for the
// MP4: same length as the timeline, not older than its sources, editing rhythm (no long still
// stretches, filmstrip out/qa/ritme.png), smooth motion (no element snapping in or out in one
// frame), loudness at -14 LUFS. Also how much the camera zooms (script.json cues, since 16 Oct 2026),
// and since 19 Oct 2026 the cover system (frame 0 = cover: mode colours, series tag, title, empty crop
// bands and views corner) and brand fonts/colours, for projects that have components/Cover.tsx.
// ✗ = must fix before sending, ⚠ = look at it. Writes out/qa[-yt]/report.json and one still per
// scene (plus frame 0) that the Studio dashboard shows on the video card. Exit code 1 on any ✗.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { spawnSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { chromiumOptions, outFps, root } from "./project.mjs";
import { STILL_FAIL, STILL_WARN, analyse, filmstrip, snaps } from "./ritme.mjs";

const args = process.argv.slice(2);
const wide = args.includes("--yt");
const target = Number(args.find((a) => a.startsWith("--durasi="))?.split("=")[1]) || null;
const outRel = wide ? "out/qa-yt" : "out/qa";
const out = path.join(root, outRel);
const slug = path.basename(root);
const mp4 = path.resolve(root, "..", "output", `${slug}${wide ? "-yt" : ""}.mp4`);

const checks = [];
const add = (key, label, status, detail = "") => {
  checks.push({ key, label, status, detail });
  console.log(`${{ ok: "✓", warn: "⚠", fail: "✗" }[status]} ${label}${detail ? ` — ${detail}` : ""}`);
};
const run = (cmd, a) => spawnSync(cmd, a, { cwd: root, encoding: "utf8", maxBuffer: 64 << 20 });
const tail = (s, n = 3) => s.split("\n").map((l) => l.trim()).filter((l) => l && !l.includes("macOS")).slice(-n).join(" | ");

// Same timing as src/Video.tsx: LEAD_IN + ceil(vo × FPS) + TAIL frames per scene.
const theme = fs.readFileSync(path.join(root, "src/theme.ts"), "utf8");
const num = (name) => Number(theme.match(new RegExp(`${name}\\s*=\\s*(\\d+)`))[1]);
const [FPS, LEAD_IN, TAIL] = [num("FPS"), num("LEAD_IN"), num("TAIL")];
const script = JSON.parse(fs.readFileSync(path.join(root, "src/script.json"), "utf8"));
const readJson = (f) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));
  } catch {
    return {};
  }
};
const durations = readJson("src/vo-durations.json");
const turns = readJson("src/vo-turns.json");
// Scenes count logical FPS frames; a 60 fps video (the default since 11 Oct 2026) has 2 real frames each.
const K = outFps / FPS;
let from = 0;
const scenes = script.scenes.map((s) => {
  const frames = LEAD_IN + Math.ceil((durations[s.id] ?? 3) * FPS) + TAIL;
  const sc = { id: s.id, from, frames };
  from += frames;
  return sc;
});
const totalS = from / FPS;
console.log(`QA ${slug}${wide ? " (YouTube 16:9)" : ""}: ${scenes.length} scene, ${totalS.toFixed(1)} dtk`);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

/* ---------- TypeScript ---------- */
{
  const r = run("npx", ["tsc", "-p", "."]);
  add("tsc", "TypeScript", r.status === 0 ? "ok" : "fail", r.status === 0 ? "" : tail(r.stdout + r.stderr));
}

/* ---------- voice clips ---------- */
{
  const ext = script.engine === "gemini" ? "wav" : "mp3";
  const missing = [];
  const noisy = [];
  for (const s of script.scenes) {
    const f = path.join(root, `public/vo/${s.id}.${ext}`);
    if (!fs.existsSync(f) || durations[s.id] == null || (script.voices && !turns[s.id])) {
      missing.push(s.id);
      continue;
    }
    if (ext !== "wav") continue;
    // A clip ends in silence after the cut; noise there is the C2PA "dret" or a bad cut.
    const b = fs.readFileSync(f);
    let data = null;
    for (let o = 12; o + 8 <= b.length; o += 8 + b.readUInt32LE(o + 4) + (b.readUInt32LE(o + 4) & 1))
      if (b.toString("ascii", o, o + 4) === "data") data = b.subarray(o + 8, o + 8 + b.readUInt32LE(o + 4));
    if (!data) {
      missing.push(`${s.id} (WAV tanpa chunk data)`);
      continue;
    }
    const rate = b.readUInt32LE(24);
    const n = Math.min(Math.round(rate * 0.05), data.length / 2);
    let sum = 0;
    for (let i = data.length / 2 - n; i < data.length / 2; i++) sum += (data.readInt16LE(i * 2) / 32768) ** 2;
    const db = 10 * Math.log10(sum / n + 1e-12);
    const extra = b.length - (data.byteOffset - b.byteOffset + data.length) > 1; // a chunk after the audio (C2PA)
    if (db > -40 || extra) noisy.push(`${s.id} (${extra ? "ada chunk setelah audio" : `${db.toFixed(0)} dB`})`);
  }
  if (missing.length) add("vo", "Suara per scene", "fail", `belum ada/tidak lengkap: ${missing.join(", ")} (npm run vo atau vo:reuse)`);
  else if (noisy.length) add("vo", "Suara per scene", "warn", `ujung klip tidak hening, dengarkan (bunyi "dret"?): ${noisy.join(", ")}`);
  else add("vo", "Suara per scene", "ok", `${script.scenes.length} klip, ujungnya hening`);
}

/* ---------- transcription (optional) ---------- */
if (args.includes("--transkrip")) {
  const r = run("node", ["--env-file-if-exists=../.env", "../scripts/check-vo.mjs"]);
  const bad = r.stdout.split("\n").filter((l) => l.startsWith("✗")).map((l) => l.slice(2, 60));
  add("transkrip", "Transkripsi suara", r.status !== 0 ? "warn" : bad.length ? "warn" : "ok", r.status !== 0 ? tail(r.stderr) : bad.length ? `beda awal/akhir kalimat (cek, angka sering salah dengar): ${bad.join(" · ")}` : "");
}

/* ---------- hook within ~2 s ---------- */
{
  const s = script.scenes[0];
  const first = turns[s.id]?.[0];
  const text = first?.vo ?? s.turns?.[0]?.vo ?? s.vo ?? "";
  const sentence = text.match(/^.*?[.?!…](\s|$)/)?.[0] ?? text;
  const start = first?.start ?? 0;
  const len = first ? first.end - first.start : durations[s.id] ?? 0;
  const at = LEAD_IN / FPS + start + (len * sentence.length) / Math.max(1, text.length);
  add("hook", "Hook ≤ 2 detik", at <= 2.5 ? "ok" : "warn", `kalimat pertama selesai ±${at.toFixed(1)} dtk: “${sentence.trim().slice(0, 70)}”`);
}

/* ---------- length ---------- */
// With a target (the user's pick in Buat video): ⚠ outside 85–120% of it. Without one ("Bebas" since
// 18 Oct 2026, the user: "bisa lebih dari 60 detik"; it used to warn outside 25–70 s) the length is
// only reported, ⚠ past 3 min: the YouTube Shorts cap (TikTok itself takes uploads up to 60 min).
{
  const [lo, hi] = target ? [target * 0.85, target * 1.2] : [0, 180];
  const why = target
    ? `target ±${target} dtk (pilihan user di Buat video)`
    : `durasi bebas, tanpa target${totalS > hi ? "; lebih dari 3 menit tidak bisa jadi YouTube Shorts" : ""}`;
  add("durasi", "Durasi", totalS >= lo && totalS <= hi ? "ok" : "warn", `${totalS.toFixed(1)} dtk, ${why}`);
}

/* ---------- speaking pace ---------- */
// Words per second over the narrated clips. Videos the user approved talk at 1.8–2.4; the
// 9 Oct firewall video at 3.2 was "ngomong cepet". Reach the target length by writing more
// (or fewer) lines, never by speeding the voice up (no "tempo cepat" style, no tempo > 1).
{
  let words = 0;
  let secs = 0;
  for (const s of script.scenes) {
    const vo = s.vo ?? (s.turns ?? []).map((t) => t.vo).join(" ");
    if (!vo || !durations[s.id]) continue;
    words += vo.split(/\s+/).filter(Boolean).length;
    secs += durations[s.id];
  }
  if (secs) {
    const wps = words / secs;
    add("tempo", "Tempo bicara", wps > 2.7 ? "fail" : wps > 2.5 ? "warn" : "ok", `${wps.toFixed(2)} kata/dtk (${words} kata, ${secs.toFixed(1)} dtk narasi); wajar 2,0–2,5. Terlalu cepat: hapus "cepat" dari style suara, matikan tempo tighten, tambah isi naskah`);
  }
}

/* ---------- camera: how much zoom ---------- */
// The user asked for less zoom (16 Oct 2026, "kurangi efek zoom"): videos of 13–15 Oct had 7–9
// punch-ins each, mostly added to pass the rhythm check. Now: about 3 per video, at most 1 per scene,
// ≤ 1.12×; beats come from new elements and "sorot" (SKILL.md 6c/6e). Projects from before the
// change (Edit.tsx without ZOOM_MAX) zoom 1.15× when "skala" is left out, and get ⚠ instead of ✗ so
// a small revision of an old video is not blocked.
{
  const editSrc = fs.existsSync(path.join(root, "src/components/Edit.tsx")) ? fs.readFileSync(path.join(root, "src/components/Edit.tsx"), "utf8") : "";
  const defScale = editSrc.includes("ZOOM_MAX") ? 1.08 : 1.15;
  const zooms = script.scenes.flatMap((s) => (Array.isArray(s.zoom) ? s.zoom : []).map((z) => ({ id: s.id, skala: z.skala ?? defScale })));
  const count = {};
  for (const z of zooms) count[z.id] = (count[z.id] ?? 0) + 1;
  const crowded = Object.keys(count).filter((id) => count[id] > 1);
  const strong = zooms.filter((z) => z.skala > 1.12).map((z) => `${z.id} ${z.skala}×`);
  const zoomCuts = script.scenes.filter((s) => s.transisi === "zoom").map((s) => s.id);
  const drift = script.kamera === false ? 0 : (script.kamera?.drift ?? (defScale === 1.08 ? 0.015 : 0.03));
  const spots = script.scenes.reduce((n, s) => n + (Array.isArray(s.sorot) ? s.sorot.length : 0), 0);
  const notes = [
    zooms.length > 3 && `${zooms.length} punch-in (maks ±3)`,
    crowded.length && `lebih dari 1 zoom di ${crowded.join(", ")}`,
    strong.length && `skala > 1,12: ${strong.join(", ")}`,
    zoomCuts.length > 1 && `transisi zoom ${zoomCuts.length}× (${zoomCuts.join(", ")})`,
    drift > 0.02 && `drift kamera ${Math.round(drift * 100)}%`,
  ].filter(Boolean);
  add(
    "zoom",
    "Zoom secukupnya",
    zooms.length > 5 && defScale === 1.08 ? "fail" : notes.length ? "warn" : "ok",
    `${zooms.length} punch-in, ${spots} sorot, drift ${(drift * 100).toFixed(1)}%${notes.length ? ` — ${notes.join("; ")}. Ganti beat zoom dengan elemen baru, "sorot", atau ganti layar (langkah 6c/6e)` : ""}`,
  );
}

// Colour helpers for the brand and cover checks.
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/* ---------- brand fonts and colours (since 19 Oct 2026) ---------- */
// One palette and three faces for every video (src/design.ts). Scenes that load their own fonts or
// paint in many colours outside the palette break the consistency the user asked for. Projects from
// before the cover system (no components/Cover.tsx) are skipped. Greys and colours close to the
// palette pass; illustrations may need a few more (skin, wood), so this only warns.
if (fs.existsSync(path.join(root, "src/components/Cover.tsx"))) {
  const src = (f) => fs.readFileSync(path.join(root, "src", f), "utf8");
  const files = fs.readdirSync(path.join(root, "src"), { recursive: true }).map(String).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));
  const own = new Set(["design.ts", "theme.ts", "components/Captions.tsx"]);
  const fonts = files.filter((f) => !own.has(f) && /@remotion\/google-fonts\//.test(src(f)));
  const literal = files.filter((f) => !own.has(f) && /fontFamily:\s*["'`]/.test(src(f)));
  const palette = [...src("design.ts").matchAll(/#[0-9A-Fa-f]{6}\b/g), ...JSON.stringify(readJson("src/components/cover-modes.json")).matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => hexRgb(m[0]));
  const scenesSrc = files.filter((f) => /^scenes.*\.tsx$/.test(f)).map(src).join("\n");
  const off = [...new Set([...scenesSrc.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase()))].filter((h) => {
    const c = hexRgb(h);
    return Math.max(...c) - Math.min(...c) > 36 && !palette.some((q) => dist(c, q) < 42);
  });
  const notes = [
    fonts.length && `font sendiri di ${fonts.join(", ")}`,
    literal.length && `fontFamily berupa teks di ${literal.join(", ")} (pakai display / serif / label / mono)`,
    off.length > 6 && `${off.length} warna di luar palet brand di scenes: ${off.slice(0, 8).join(" ")}${off.length > 8 ? " …" : ""} (pakai K / THEMES dari design.ts)`,
  ].filter(Boolean);
  add("brand", "Font & warna brand", notes.length ? "warn" : "ok", notes.length ? notes.join("; ") : `3 font, ${off.length} warna tambahan di luar palet`);
}

/* ---------- stills: frame 0 vs settled, one per scene ---------- */
function decodePng(buf) {
  let pos = 8, w, h, type;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const name = buf.toString("ascii", pos + 4, pos + 8);
    const d = buf.subarray(pos + 8, pos + 8 + len);
    if (name === "IHDR") [w, h, type] = [d.readUInt32BE(0), d.readUInt32BE(4), d[9]];
    else if (name === "IDAT") idat.push(d);
    pos += 12 + len;
  }
  const ch = type === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const px = new Uint8Array(w * h * 3);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const cur = new Uint8Array(stride);
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0;
      let v = raw[y * (stride + 1) + 1 + x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v;
    }
    for (let x = 0; x < w; x++) for (let k = 0; k < 3; k++) px[(y * w + x) * 3 + k] = cur[x * ch + k];
    prev = cur;
  }
  return { w, h, px };
}
// Share of pixels on a sharp edge (text, characters, illustrations), above the subtitle area.
// Plain shapes such as an empty table or a coloured band have edges only at their border, so a
// frame 0 showing just the backdrop scores low even when the backdrop fills the screen.
function detail({ w, h, px }) {
  const Y = (x, y) => {
    const i = (y * w + x) * 3;
    return 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
  };
  const bottom = Math.floor(h * (wide ? 0.78 : 0.72)); // subtitles live below this line
  let edges = 0;
  for (let y = 0; y < bottom - 1; y++)
    for (let x = 0; x < w - 1; x++) if (Math.abs(Y(x + 1, y) - Y(x, y)) + Math.abs(Y(x, y + 1) - Y(x, y)) > 40) edges++;
  return edges / ((bottom - 1) * (w - 1));
}

/* ---------- cover system (components/Cover.tsx, since 19 Oct 2026) ---------- */
// The user found the profile grid "jelek, kaya ngga konsisten": every video had its own palette, fonts,
// opener layout and host spot. Frame 0 is the cover; the grid crops it to 3:4 (y 240–1680) and prints
// the view count bottom left. Spots below are the frame pixels of COVER_LAYOUT.portrait in Cover.tsx.
const COVER = {
  bg: { x0: 330, x1: 540, y0: 40, y1: 150 }, // plain background above the title, clear of the glow
  tag: { x0: 84, x1: 96, y0: 314, y1: 334 }, // inside the series tag's left padding
  title: { x0: 72, x1: 900, y0: 384, y1: 700 },
  views: { x0: 0, x1: 400, y0: 1530, y1: 1680 },
  top: { x0: 0, x1: 1080, y0: 0, y1: 228 },
  bottom: { x0: 0, x1: 560, y0: 1692, y1: 1920 },
};
// Median colour and share of sharp edges in a box given in 1080×1920 frame pixels.
function region({ w, h, px }, box) {
  const k = w / 1080;
  const [x0, x1, y0, y1] = [box.x0, box.x1, box.y0, box.y1].map((v, i) => Math.max(0, Math.min(i < 2 ? w - 1 : h - 1, Math.round(v * k))));
  const ch = [[], [], []];
  let edges = 0;
  let n = 0;
  const Y = (x, y) => {
    const i = (y * w + x) * 3;
    return 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
  };
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = (y * w + x) * 3;
      for (let c = 0; c < 3; c++) ch[c].push(px[i + c]);
      if (x < x1 && y < y1 && Math.abs(Y(x + 1, y) - Y(x, y)) + Math.abs(Y(x, y + 1) - Y(x, y)) > 40) edges++;
      n++;
    }
  const med = ch.map((a) => a.sort((p, q) => p - q)[a.length >> 1]);
  return { color: med, edges: edges / Math.max(1, n) };
}
const rgbHex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();

// Calibrated on 14 projects (7 Oct 2026): see docs/04 "QA".
const RATIO_OK = 0.6;
const RATIO_WARN = 0.35;
const sheet = [];
try {
  const chromeDir = path.join(root, "../node_modules/.remotion/chrome-headless-shell");
  const platform = fs.readdirSync(chromeDir).find((d) => fs.statSync(path.join(chromeDir, d)).isDirectory());
  const inner = fs.readdirSync(path.join(chromeDir, platform)).find((d) => d.startsWith("chrome-headless-shell"));
  const browserExecutable = path.join(chromeDir, platform, inner, "chrome-headless-shell");
  const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), enableCaching: false, rootDir: root, publicDir: path.join(root, "public") });
  const browser = await openBrowser("chrome", { browserExecutable, logLevel: "error", chromiumOptions });
  const composition = await selectComposition({ serveUrl, id: wide ? "VideoWide" : "Video", puppeteerInstance: browser, browserExecutable, logLevel: "error" });
  const still = (frame, file, imageFormat = "jpeg", scale = 0.35) =>
    renderStill({ serveUrl, composition, frame: Math.round(frame * K), output: path.join(out, file), imageFormat, scale, puppeteerInstance: browser, browserExecutable, logLevel: "error" });

  // Frame 0 against the same scene once it has settled (75% in): the hook text and main visual
  // must already be there at frame 0, not slide in over an empty background.
  const s1 = scenes[0];
  await still(0, "f0.png", "png", 0.25);
  await still(s1.from + Math.round(s1.frames * 0.75), "f0-settled.png", "png", 0.25);
  const d0 = detail(decodePng(fs.readFileSync(path.join(out, "f0.png"))));
  const dS = detail(decodePng(fs.readFileSync(path.join(out, "f0-settled.png"))));
  const ratio = dS > 0 ? d0 / dS : 1;
  const status = ratio >= RATIO_OK ? "ok" : ratio >= RATIO_WARN ? "warn" : "fail";
  add("frame0", "Frame 0 sudah terisi", status, `detail frame 0 = ${Math.round(ratio * 100)}% dari scene 1 saat penuh (${(d0 * 100).toFixed(1)}% vs ${(dS * 100).toFixed(1)}%)${status === "ok" ? "" : "; aturan FYP: teks hook + visual utama sudah terlihat di frame 0"}`);
  // The cover: series tag, background and title in place on frame 0, crop bands and the views corner empty.
  if (!wide && fs.existsSync(path.join(root, "src/components/Cover.tsx"))) {
    const modes = readJson("src/components/cover-modes.json");
    const mode = modes.modes?.[script.look?.mode];
    const notes = [];
    let fail = false;
    if (!mode) {
      fail = true;
      notes.push(`look.mode belum diisi (${Object.keys(modes.modes ?? {}).join(" / ")})`);
    } else {
      if (script.look?.tag && !modes.tags.includes(script.look.tag)) {
        fail = true;
        notes.push(`look.tag "${script.look.tag}" bukan label seri (${modes.tags.join(", ")})`);
      }
      const usesCover =
        script.scenes[0]?.kind === "cover" ||
        fs.readdirSync(path.join(root, "src")).some((f) => /^scenes.*\.tsx$/.test(f) && fs.readFileSync(path.join(root, "src", f), "utf8").includes("<CoverFrame"));
      if (!usesCover) {
        fail = true;
        notes.push('s01 belum memakai sistem sampul ("kind": "cover" atau CoverFrame dari components/Cover.tsx)');
      }
      await still(0, "cover.png", "png", 0.5);
      const img = decodePng(fs.readFileSync(path.join(out, "cover.png")));
      fs.rmSync(path.join(out, "cover.png"));
      const bg = region(img, COVER.bg);
      const tagged = region(img, COVER.tag);
      if (dist(bg.color, hexRgb(mode.bg)) > 45) {
        fail = true;
        notes.push(`latar frame 0 ${rgbHex(bg.color)}, mode ${script.look.mode} = ${mode.bg}`);
      }
      if (dist(tagged.color, hexRgb(mode.tagBg)) > 60) {
        fail = true;
        notes.push(`label seri tidak terlihat di kiri atas (warna ${rgbHex(tagged.color)}, harusnya ${mode.tagBg})`);
      }
      if (region(img, COVER.title).edges < 0.02) {
        fail = true;
        notes.push("judul belum terlihat di frame 0 (x 72–900, y 384–700)");
      }
      if (region(img, COVER.views).edges > 0.03) notes.push("pojok kiri bawah (angka views TikTok, y 1530–1680) terisi");
      if (region(img, COVER.top).edges > 0.015) notes.push("ada isi di 240 px teratas, terpotong di grid profil");
      if (region(img, COVER.bottom).edges > 0.03) notes.push("ada isi di bawah garis potong y 1680 di sisi kiri");
      if (script.scenes[0]?.theme !== mode.theme) notes.push(`theme s01 "${script.scenes[0]?.theme}", mode ${script.look.mode} memakai "${mode.theme}"`);
    }
    add("sampul", "Sampul konsisten", fail ? "fail" : notes.length ? "warn" : "ok", notes.length ? `${notes.join("; ")} — lihat npx remotion still AsetSampul dan bagian "Sampul" di skill` : `mode ${script.look.mode}, label ${script.look?.tag ?? mode.tag}`);
  } else if (!wide) add("sampul", "Sampul konsisten", "ok", "proyek sebelum sistem sampul (19 Okt 2026), dilewati");
  await still(0, "f0.jpg");
  for (const f of ["f0.png", "f0-settled.png"]) fs.rmSync(path.join(out, f));
  sheet.push({ scene: "frame 0", file: `${outRel}/f0.jpg` });
  for (const s of scenes) {
    await still(s.from + Math.round(s.frames * 0.75), `${s.id}.jpg`);
    sheet.push({ scene: s.id, file: `${outRel}/${s.id}.jpg` });
  }
  await browser.close({ silent: true });
} catch (e) {
  add("frame0", "Frame 0 sudah terisi", "fail", `still gagal dirender: ${e.message.split("\n")[0]}`);
}

/* ---------- characters cut at the edges ---------- */
{
  const r = run("node", ["../scripts/check-crop.mjs", ...(wide ? ["--wide"] : [])]);
  const lines = r.stdout.split("\n");
  // Captions over faces (projects with components/Faces.ts) are their own check below.
  const faceLines = lines.filter((l) => l.includes("subtitle menutupi wajah"));
  const summary = lines.find((l) => l.startsWith("subtitle vs wajah:"));
  if (summary)
    add(
      "wajah",
      "Subtitle tidak menutupi wajah",
      faceLines.length ? "fail" : "ok",
      faceLines.length ? `${faceLines.length} baris: ${faceLines.map((l) => l.trim().split(/\s+/)[0] + " " + (l.match(/frame \d+/)?.[0] ?? "")).join(", ")} — geser/kecilkan karakternya (still di out/crop${wide ? "-yt" : ""}/)` : summary.replace("subtitle vs wajah: ", ""),
    );
  const bad = lines.filter((l) => l.includes("✗") && !l.includes("subtitle menutupi wajah")).map((l) => l.trim().split(/\s+/).slice(0, 2).join(" "));
  const look = lines.filter((l) => l.includes("cukup terpotong")).map((l) => l.trim().split(/\s+/).slice(0, 2).join(" "));
  if (r.status !== 0 && !bad.length && !faceLines.length) add("crop", "Karakter utuh di frame", "fail", `check-crop gagal: ${tail(r.stderr || r.stdout)}`);
  else if (bad.length) add("crop", "Karakter utuh di frame", "fail", `terpotong lebih dari batas: ${bad.join(", ")} (still di out/crop${wide ? "-yt" : ""}/)`);
  else if (look.length) add("crop", "Karakter utuh di frame", "warn", `cukup terpotong, lihat still: ${look.join(", ")}`);
  else add("crop", "Karakter utuh di frame", "ok", lines.some((l) => l.includes("tidak ada karakter anime")) ? "tidak ada karakter anime" : "");
}

/* ---------- the rendered MP4 ---------- */
const result = {};
if (!fs.existsSync(mp4)) add("mp4", "MP4 final", "warn", `belum dirender (${path.relative(root, mp4)})`);
else {
  const p = run("npx", ["remotion", "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4]);
  const dur = Number(p.stdout.trim().split("\n").filter((l) => !l.includes("macOS")).pop());
  result.duration_s = +dur.toFixed(2);
  // Newest source the render depends on: scenes, script, timing, clips, images.
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
  const stale = fs.statSync(mp4).mtimeMs < newest;
  if (Math.abs(dur - totalS) > 0.25) add("mp4", "MP4 final", "fail", `durasi MP4 ${dur.toFixed(1)} dtk ≠ timeline ${totalS.toFixed(1)} dtk: render ulang`);
  else if (stale) add("mp4", "MP4 final", "warn", "ada file sumber (src/ atau public/) yang lebih baru dari MP4: render ulang kalau perubahannya belum masuk");
  else add("mp4", "MP4 final", "ok", `${dur.toFixed(1)} dtk, sesuai timeline`);

  // Editing rhythm: the longest stretch with no visible change (scripts/ritme.mjs), plus a
  // filmstrip of the whole video (one tile per second) to review the edit in one image.
  try {
    const a = analyse(mp4);
    filmstrip(a, path.join(out, "ritme.png"));
    result.ritme = { beats_per_10s: a.perTen, longest_still_s: a.longest, still: a.still };
    const where = a.still.map(([s, e]) => `${s}–${e}`).join(", ");
    add(
      "ritme",
      "Ritme (layar tidak diam)",
      a.longest >= STILL_FAIL ? "fail" : a.longest >= STILL_WARN ? "warn" : "ok",
      `${a.perTen} beat per 10 dtk, diam terlama ${a.longest} dtk${where ? ` di ${where}` : ""}; filmstrip ${outRel}/ritme.png${a.longest >= STILL_WARN ? ". Tambah beat di situ: elemen/kartu baru yang masuk bertahap, \"sorot\" di script.json, ganti layar, atau pecah scene" : ""}`,
    );
  } catch (e) {
    add("ritme", "Ritme (layar tidak diam)", "warn", `gagal dianalisis: ${e.message.split("\n")[0]}`);
  }

  // Smooth motion: elements that pop in/out or jump in a single frame (scripts/ritme.mjs snaps),
  // outside the scene transitions. A heuristic, so ⚠ at most: look at the moment and animate it.
  try {
    const editFile = path.join(root, "src/components/Edit.tsx");
    const wipe = fs.existsSync(editFile) ? Number(fs.readFileSync(editFile, "utf8").match(/WIPE\s*=\s*(\d+)/)?.[1] ?? 12) : 12;
    const skip = scenes.slice(1).map((s) => [s.from / FPS - 0.05, (s.from + wipe + 3) / FPS]);
    const found = snaps(mp4, skip);
    result.patah = found;
    const sceneAt = (t) => [...scenes].reverse().find((s) => t * FPS >= s.from)?.id ?? "?";
    add(
      "gerak",
      "Gerak halus (tanpa patah)",
      found.length ? "warn" : "ok",
      found.length
        ? `${found.length} bagian muncul/berubah dalam 1 frame tanpa animasi: ${found.map((x) => `${sceneAt(x.t)} ${x.t.toFixed(1)} dtk`).join(", ")} — lihat frame-nya (npm run frames -- <detik × ${outFps}>), lalu beri masuk/keluar 8–15 frame (components/Motion.ts) atau ukuran tetap untuk panel yang teksnya berubah`
        : "tidak ada elemen yang muncul/lompat dalam 1 frame",
    );
  } catch (e) {
    add("gerak", "Gerak halus (tanpa patah)", "warn", `gagal dianalisis: ${e.message.split("\n")[0]}`);
  }

  const l = run("node", ["../scripts/loudness.mjs", "--check", mp4]);
  const m = l.stdout.match(/(-?\d+(?:\.\d+)?) LUFS, TP (-?\d+(?:\.\d+)?)/);
  if (m) result.loudness = { I: Number(m[1]), TP: Number(m[2]) };
  add("loudness", "Keras suara −14 LUFS", !m ? "warn" : l.status === 0 ? "ok" : "warn", m ? `${m[1]} LUFS, true peak ${m[2]} dBTP${l.status === 0 ? "" : " — jalankan npm run loudness"}` : tail(l.stderr || l.stdout));
}

const status = checks.some((c) => c.status === "fail") ? "fail" : checks.some((c) => c.status === "warn") ? "warn" : "ok";
fs.writeFileSync(
  path.join(out, "report.json"),
  JSON.stringify({ at: new Date().toISOString(), project: slug, format: wide ? "landscape" : "portrait", status, timeline_s: +totalS.toFixed(2), target_s: target, ...result, checks, sheet }, null, 2) + "\n",
);
const counts = ["fail", "warn"].map((k) => checks.filter((c) => c.status === k).length);
console.log(`\n${status === "ok" ? "LOLOS QA" : status === "warn" ? `LOLOS dengan ${counts[1]} catatan ⚠` : `GAGAL: ${counts[0]} ✗ harus diperbaiki`} — ${outRel}/report.json, still per scene di ${outRel}/`);
process.exit(status === "fail" ? 1 : 0);
