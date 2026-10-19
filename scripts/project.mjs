// Shared by every video project: `npm run …` in a project folder runs these scripts with
// that folder as the working directory, so the project root is process.cwd().
import fs from "node:fs";
import path from "node:path";

export const root = process.cwd();
if (!fs.existsSync(path.join(root, "src/script.json"))) {
  console.error(`Jalankan dari folder proyek video lewat npm run (tidak ada src/script.json di ${root}).`);
  process.exit(1);
}

// Projects with 3D scenes (a scene importing components/ThreeKit.tsx or @remotion/three) need
// Chrome's "angle" GL, or WebGL fails to start in headless Chrome. ThreeKit.tsx and
// ThreeKitProps.tsx ship with every project, so they do not count. 2D projects keep the default GL.
export const uses3d = (() => {
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).some((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) && !/^ThreeKit\w*\.tsx$/.test(e.name) && /@remotion\/three|ThreeKit/.test(fs.readFileSync(path.join(dir, e.name), "utf8")),
    );
  return walk(path.join(root, "src"));
})();
export const chromiumOptions = uses3d ? { gl: "angle" } : {};

// Frames per second of the rendered video: script.json "fps", else the project's own default
// (OUT_FPS in src/theme.ts, `?? 60` since 11 Oct 2026). Projects without OUT_FPS render at 30.
export const outFps = (() => {
  const script = JSON.parse(fs.readFileSync(path.join(root, "src/script.json"), "utf8"));
  if (script.fps) return Number(script.fps);
  const theme = path.join(root, "src/theme.ts");
  const m = fs.existsSync(theme) && fs.readFileSync(theme, "utf8").match(/OUT_FPS[^\n]*\?\?\s*(\d+)/);
  return m ? Number(m[1]) : 30;
})();
