// Character crop check. Renders two frames of every scene and reports how much of each
// anime character (img/<who>-*.png) sticks out past the left, right or top edge,
// measured as the share of its opaque pixels outside the frame.
//   npm run check:crop              TikTok version (composition Video)
//   npm run check:crop -- --wide    YouTube version (composition VideoWide)
// Up to 15% cut at the sides is fine (an elbow or fingertip past the edge), 15–30% is
// worth a look, and more than 30% (half a torso, or only a pointing arm left) fails with
// exit 1, as does any cut through the head at the top. Calibrated with the user on
// 7 Oct 2026: the FUP video (worst 27%) looked normal, the survey video (36–62%) did not. The bottom edge is not
// checked: half-body poses are meant to stand on it. Stills are kept in out/crop[-yt]/.
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";

const SIDE_OK = 0.15;
const SIDE = 0.3;
const TOP = 0.03;

import { chromiumOptions, outFps, root } from "./project.mjs";
const wide = process.argv.includes("--wide");
// --tanpa-geser: captions stay at their home place (to see what dodging fixes).
const stay = process.argv.includes("--tanpa-geser");
const id = wide ? "VideoWide" : "Video";
const out = path.join(root, wide ? "out/crop-yt" : "out/crop");

// Same timing as src/Video.tsx: LEAD_IN + ceil(vo × FPS) + TAIL frames per scene.
const theme = fs.readFileSync(path.join(root, "src/theme.ts"), "utf8");
const num = (name) => Number(theme.match(new RegExp(`${name}\\s*=\\s*(\\d+)`))[1]);
const [FPS, LEAD_IN, TAIL] = [num("FPS"), num("LEAD_IN"), num("TAIL")];
const script = JSON.parse(fs.readFileSync(path.join(root, "src/script.json"), "utf8"));
const durations = JSON.parse(fs.readFileSync(path.join(root, "src/vo-durations.json"), "utf8"));
// Scenes count logical FPS frames; a 60 fps video (the default since 11 Oct 2026) has 2 real frames each.
const K = outFps / FPS;
let from = 0;
const shots = script.scenes.flatMap((s) => {
  const d = LEAD_IN + Math.ceil((durations[s.id] ?? 3) * FPS) + TAIL;
  const frames = [0.5, 0.85].map((p) => ({ scene: s.id, frame: Math.round((from + d * p) * K) }));
  from += d;
  return frames;
});

// The shared Chrome in ../node_modules/.remotion, as in remotion.config.ts.
const chromeDir = path.join(root, "../node_modules/.remotion/chrome-headless-shell");
const platform = fs.existsSync(chromeDir) ? fs.readdirSync(chromeDir).find((d) => fs.statSync(path.join(chromeDir, d)).isDirectory()) : null;
const inner = platform && fs.readdirSync(path.join(chromeDir, platform)).find((d) => d.startsWith("chrome-headless-shell"));
const browserExecutable = inner ? path.join(chromeDir, platform, inner, "chrome-headless-shell") : null;

// The renderer echoes every browser console line; the measurements are read through
// onBrowserLog instead, so keep them out of the terminal.
for (const k of ["log", "info", "warn"]) {
  const orig = console[k].bind(console);
  console[k] = (...a) => (a.some((x) => /CROPCHECK|EDITCUES|CAPLINES|FACECHECK/.test(String(x))) ? undefined : orig(...a));
}
const write = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, ...rest) => (/CROPCHECK|EDITCUES|CAPLINES|FACECHECK/.test(String(chunk)) ? true : write(chunk, ...rest));

console.log(`cek karakter terpotong: ${id}, ${shots.length} frame…`);
const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), enableCaching: false, rootDir: root, publicDir: path.join(root, "public") });
const browser = await openBrowser("chrome", { browserExecutable, logLevel: "error", chromiumOptions });
const inputProps = { checkCrop: true, captionsStay: stay };
const composition = await selectComposition({ serveUrl, id, inputProps, puppeteerInstance: browser, browserExecutable, logLevel: "error" });
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

// Projects with the editing layer (components/Edit.tsx) log the frames where a zoom or shake peaks;
// those frames are measured too, since a punch-in pushes characters near the edge out of frame.
await renderStill({
  serveUrl,
  composition,
  frame: 0,
  output: path.join(out, "cues.jpg"),
  imageFormat: "jpeg",
  scale: 0.1,
  inputProps,
  puppeteerInstance: browser,
  browserExecutable,
  logLevel: "error",
  onBrowserLog: (log) => {
    if (log.text.startsWith("EDITCUES ") && !shots.some((s) => s.cue)) for (const c of JSON.parse(log.text.slice(9))) shots.push({ ...c, cue: true });
    // Projects whose captions dodge faces (components/Faces.ts) also list the middle of every
    // caption line; at those frames the captions report whether they sit on a face.
    if (log.text.startsWith("CAPLINES ") && !shots.some((s) => s.line)) for (const c of JSON.parse(log.text.slice(9))) shots.push({ ...c, line: true });
  },
});
fs.rmSync(path.join(out, "cues.jpg"), { force: true });
const cues = shots.filter((s) => s.cue).length;
const lineShots = shots.filter((s) => s.line).length;
if (cues || lineShots) console.log(`+ ${cues} frame puncak zoom/guncang, ${lineShots} baris subtitle`);
const faceHits = new Map(); // frame → { scene, hit, moved }

// worst cut per scene and character
const worst = new Map();
for (const { scene, frame } of shots) {
  await renderStill({
    serveUrl,
    composition,
    frame,
    output: path.join(out, `${scene}-f${frame}.jpg`),
    imageFormat: "jpeg",
    scale: 0.3,
    inputProps,
    puppeteerInstance: browser,
    browserExecutable,
    logLevel: "error",
    onBrowserLog: (log) => {
      if (log.text.startsWith("FACECHECK ")) {
        const m = JSON.parse(log.text.slice(10));
        const prev = faceHits.get(frame);
        faceHits.set(frame, { scene, hit: [...new Set([...(prev?.hit ?? []), ...m.hit])], moved: m.moved || prev?.moved || "" });
        return;
      }
      if (!log.text.startsWith("CROPCHECK ")) return;
      const m = JSON.parse(log.text.slice(10));
      const key = `${scene} ${m.name.replace(/-mulut-(closed|mid|open)$/, "")}`;
      const side = Math.max(m.left, m.right);
      const prev = worst.get(key);
      if (!prev || side > prev.side || m.top > prev.top) worst.set(key, { scene, who: key.split(" ")[1], frame, side: Math.max(side, prev?.side ?? 0), top: Math.max(m.top, prev?.top ?? 0), edge: m.left > m.right ? "kiri" : "kanan" });
    },
  });
}
await browser.close({ silent: true });

const pct = (x) => `${Math.round(x * 100)}%`.padStart(4);
let bad = 0;
let faceBad = 0;
for (const w of [...worst.values()].sort((a, b) => a.scene.localeCompare(b.scene))) {
  const sideBad = w.side > SIDE;
  const topBad = w.top > TOP;
  if (sideBad || topBad) bad++;
  const verdict = sideBad || topBad ? `✗ ${[sideBad && `terpotong ${w.edge}`, topBad && "kepala terpotong"].filter(Boolean).join(", ")} (frame ${w.frame})` : w.side > SIDE_OK ? `cukup terpotong ${w.edge}, lihat still (frame ${w.frame})` : w.side > 0.03 ? "sedikit terpotong, masih wajar" : "✓";
  console.log(`${w.scene}  ${w.who.padEnd(22)} samping ${pct(w.side)}  atas ${pct(w.top)}  ${verdict}`);
}
if (!worst.size) console.log("tidak ada karakter anime yang terdeteksi");
// Captions over faces (only for projects with components/Faces.ts).
if (faceHits.size) {
  const rows = [...faceHits.entries()].sort((a, b) => a[0] - b[0]);
  const covered = rows.filter(([, v]) => v.hit.length);
  const moved = rows.filter(([, v]) => v.moved);
  const by = (k) => moved.filter(([, v]) => v.moved === k).length;
  console.log(`\nsubtitle vs wajah: ${rows.length} frame dicek, ${moved.length} digeser (samping ${by("samping")}, turun ${by("turun")}, naik ${by("naik")})${covered.length ? "" : ", tidak ada yang menutupi wajah ✓"}`);
  const far = moved.filter(([, v]) => v.moved !== "samping").map(([frame, v]) => `${v.scene} f${frame} ${v.moved}`);
  if (far.length) console.log(`  turun/naik (lihat still-nya, npm run frames -- <frame>): ${far.join(", ")}`);
  for (const [frame, v] of covered) console.log(`${v.scene}  ✗ subtitle menutupi wajah ${v.hit.join(", ")} (frame ${frame})${stay ? "" : ": tidak ada tempat kosong, geser/kecilkan karakternya"}`);
  faceBad = covered.length;
}
console.log(bad ? `\n${bad} karakter terpotong lebih dari batas (samping ${SIDE * 100}%, atas ${TOP * 100}%): geser masuk lalu cek lagi. Still: ${path.relative(root, out)}/` : `\ntidak ada karakter yang terpotong parah. Still: ${path.relative(root, out)}/`);
if (faceBad) console.log(`${faceBad} baris subtitle menutupi wajah.`);
process.exit(bad || faceBad ? 1 : 0);
