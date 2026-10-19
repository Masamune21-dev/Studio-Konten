// Contact sheet of chosen frames, rendered from the source (not the MP4), to review an edit in one
// look: the frame-0 hook, every scene change mid-transition, a click, a zoom. Run from a project:
//   npm run frames -- 219 223 502         these frames
//   npm run frames -- --transisi          frame 0 + 3 frames inside every scene change
//   npm run frames -- s03 s04             6 frames spread over each of these scenes
//   npm run frames -- --isyarat           every "zoom" / "sorot" / "guncang" cue at its fullest (to
//                                         check that it aims at the right element; template since 16 Oct 2026)
//   --wide (VideoWide) · --comp=<id> (another composition) · --cols=5 · --scale=0.25 · --out=out/frames.png
// Each tile is labelled with its frame number. Writes one PNG and prints its path.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { chromiumOptions, outFps, root } from "./project.mjs";
import { DIGITS, decodePng, png } from "./ritme.mjs";

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const wide = args.includes("--wide");
const cols = Number(opt("cols", wide ? 3 : 5));
const scale = Number(opt("scale", wide ? 0.2 : 0.25));
const outFile = path.resolve(root, opt("out", wide ? "out/frames-yt.png" : "out/frames.png"));

// Same timing as src/Video.tsx: LEAD_IN + ceil(vo × FPS) + TAIL frames per scene; WIPE from Edit.tsx.
const theme = fs.readFileSync(path.join(root, "src/theme.ts"), "utf8");
const num = (name) => Number(theme.match(new RegExp(`${name}\\s*=\\s*(\\d+)`))[1]);
const [FPS, LEAD_IN, TAIL] = [num("FPS"), num("LEAD_IN"), num("TAIL")];
const editFile = path.join(root, "src/components/Edit.tsx");
const WIPE = fs.existsSync(editFile) ? Number(fs.readFileSync(editFile, "utf8").match(/WIPE\s*=\s*(\d+)/)[1]) : 12;
const script = JSON.parse(fs.readFileSync(path.join(root, "src/script.json"), "utf8"));
const durations = JSON.parse(fs.readFileSync(path.join(root, "src/vo-durations.json"), "utf8"));
// Scenes count logical FPS frames; a 60 fps video (the default since 11 Oct 2026) has 2 real frames each.
// Frame numbers typed on the command line are real frames, as in the rendered video.
const K = outFps / FPS;
let from = 0;
const scenes = script.scenes.map((s) => {
  const d = LEAD_IN + Math.ceil((durations[s.id] ?? 3) * FPS) + TAIL;
  const sc = { id: s.id, from, d };
  from += d;
  return sc;
});

const frames = [];
if (args.includes("--transisi")) {
  frames.push(0);
  for (const s of scenes.slice(1)) frames.push(...[0.25, 0.5, 0.8].map((p) => Math.round((s.from + WIPE * p) * K)));
}
for (const a of args.filter((x) => !x.startsWith("--"))) {
  const s = scenes.find((x) => x.id === a);
  if (s) for (let i = 0; i < 6; i++) frames.push(Math.round((s.from + ((i + 0.5) / 6) * s.d) * K));
  else if (/^\d+$/.test(a)) frames.push(Number(a));
  else {
    console.error(`"${a}" bukan nomor frame atau id scene (${scenes.map((x) => x.id).join(", ")})`);
    process.exit(1);
  }
}
const cueMode = args.includes("--isyarat");
if (!frames.length && !cueMode) {
  console.error("Sebutkan frame (219 223), scene (s03), --transisi, atau --isyarat.");
  process.exit(1);
}

const chromeDir = path.join(root, "../node_modules/.remotion/chrome-headless-shell");
const platform = fs.readdirSync(chromeDir).find((d) => fs.statSync(path.join(chromeDir, d)).isDirectory());
const inner = fs.readdirSync(path.join(chromeDir, platform)).find((d) => d.startsWith("chrome-headless-shell"));
const browserExecutable = path.join(chromeDir, platform, inner, "chrome-headless-shell");
const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), enableCaching: false, rootDir: root, publicDir: path.join(root, "public") });
const browser = await openBrowser("chrome", { browserExecutable, logLevel: "error", chromiumOptions });
const composition = await selectComposition({ serveUrl, id: opt("comp", wide ? "VideoWide" : "Video"), puppeteerInstance: browser, browserExecutable, logLevel: "error" });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "frames-"));
if (cueMode) {
  // src/Video.tsx logs the cue frames (real frames) when rendered with the listCues input prop.
  let cues = null;
  await renderStill({
    serveUrl,
    composition,
    frame: 0,
    output: path.join(tmp, "cues.png"),
    imageFormat: "png",
    scale: 0.1,
    inputProps: { listCues: true },
    puppeteerInstance: browser,
    browserExecutable,
    logLevel: "error",
    onBrowserLog: (log) => {
      if (log.text.startsWith("CUEFRAMES ")) cues = JSON.parse(log.text.slice(10));
    },
  });
  if (!cues) console.error("Proyek ini belum mencatat isyarat (src/Video.tsx sebelum 16 Okt 2026): pakai nomor frame.");
  else if (!cues.length) console.error('Tidak ada isyarat "zoom", "sorot", atau "guncang" di script.json.');
  else for (const c of cues) console.log(`  ${c.scene} ${c.kind.padEnd(7)} frame ${c.frame}`);
  frames.push(...(cues ?? []).map((c) => c.frame));
  if (!frames.length) process.exit(1);
}
const tiles = [];
for (const f of frames) {
  const file = path.join(tmp, `${f}.png`);
  await renderStill({ serveUrl, composition, frame: Math.min(f, composition.durationInFrames - 1), output: file, imageFormat: "png", scale, puppeteerInstance: browser, browserExecutable, logLevel: "error" });
  const b = fs.readFileSync(file);
  tiles.push({ f, w: b.readUInt32BE(16), h: b.readUInt32BE(20), px: decodePng(b) });
}
await browser.close({ silent: true });
fs.rmSync(tmp, { recursive: true, force: true });

const { w, h } = tiles[0];
const gap = 8, label = 22;
const rows = Math.ceil(tiles.length / cols);
const W = cols * (w + gap) + gap, H = rows * (h + label + gap) + gap;
const img = Buffer.alloc(W * H * 3, 24);
tiles.forEach((t, i) => {
  const x0 = gap + (i % cols) * (w + gap), y0 = gap + Math.floor(i / cols) * (h + label + gap);
  for (let y = 0; y < h; y++) t.px.copy(img, ((y0 + y) * W + x0) * 3, y * w * 3, (y + 1) * w * 3);
  [...String(t.f)].forEach((d, k) => {
    const g = DIGITS[+d];
    for (let p = 0; p < 15; p++)
      if (g[p] === "1")
        for (let dy = 0; dy < 3; dy++)
          for (let dx = 0; dx < 3; dx++) {
            const o = ((y0 + h + 4 + Math.floor(p / 3) * 3 + dy) * W + x0 + k * 12 + (p % 3) * 3 + dx) * 3;
            img[o] = img[o + 1] = img[o + 2] = 230;
          }
  });
});
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, png(W, H, img));
console.log(`${tiles.length} frame → ${path.relative(root, outFile)}`);
