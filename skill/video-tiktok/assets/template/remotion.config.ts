// node_modules dan Chrome headless dipakai bersama di folder video/ (lihat ../package.json),
// jadi proyek ini tidak punya node_modules sendiri. Tanpa ini Remotion mengunduh Chrome
// (±190 MB) ke folder proyek, karena Remotion mencarinya di sebelah package.json terdekat.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Config } from "@remotion/cli/config";

const base = path.resolve(process.cwd(), "../node_modules/.remotion/chrome-headless-shell");
const platform = fs.existsSync(base) ? fs.readdirSync(base).find((d) => fs.statSync(path.join(base, d)).isDirectory()) : undefined;
if (platform) {
  const inner = fs.readdirSync(path.join(base, platform)).find((d) => d.startsWith("chrome-headless-shell"));
  const exe = inner && path.join(base, platform, inner, process.platform === "win32" ? "chrome-headless-shell.exe" : "chrome-headless-shell");
  if (exe && fs.existsSync(exe)) Config.setBrowserExecutable(exe);
}

// Cache webpack (±170 MB per proyek) tidak sepadan: bundle tanpa cache cuma beberapa detik.
Config.setCachingEnabled(false);

// Adegan 3D (components/ThreeKit.tsx, Three.js/WebGL): tanpa "angle" Chrome headless gagal
// membuat konteks WebGL. Hanya aktif kalau ada scene yang mengimpor ThreeKit/@remotion/three
// (ThreeKit.tsx dan ThreeKitProps.tsx selalu ikut template, jadi tidak dihitung), supaya video 2D tetap
// dirender persis seperti sebelumnya. scripts/project.mjs memakai deteksi yang sama.
const uses3d = (dir: string): boolean =>
  fs.readdirSync(dir, { withFileTypes: true }).some((e) =>
    e.isDirectory() ? uses3d(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) && !/^ThreeKit\w*\.tsx$/.test(e.name) && /@remotion\/three|ThreeKit/.test(fs.readFileSync(path.join(dir, e.name), "utf8")),
  );
if (uses3d(path.resolve(process.cwd(), "src"))) Config.setChromiumOpenGlRenderer("angle");

// Efek suara (components/Sfx.tsx): public/sfx/*.wav dibuat ../scripts/sfx.mjs dan tidak masuk git.
// Kalau ada yang hilang (clone baru, proyek baru disalin tanpa folder itu), buat ulang sebelum render;
// hasilnya selalu sama persis karena generatornya memakai seed tetap.
const sfxJson = path.resolve(process.cwd(), "src/sfx.json");
if (fs.existsSync(sfxJson)) {
  const list: Record<string, number[]> = JSON.parse(fs.readFileSync(sfxJson, "utf8")).list;
  const missing = Object.entries(list).some(([name, v]) => v.some((_, i) => !fs.existsSync(path.resolve(process.cwd(), `public/sfx/${name}-${i}.wav`))));
  if (missing) execFileSync(process.execPath, [path.resolve(process.cwd(), "../scripts/sfx.mjs")], { stdio: "inherit" });
}
