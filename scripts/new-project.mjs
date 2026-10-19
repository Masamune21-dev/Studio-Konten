// Create a new video project next to the other projects:
//   1. copy the template (skill/video-tiktok/assets/template),
//   2. lay the brand's own template files over it (brand/template/…: logo, logo outlines, cover
//      modes, pronunciation, example script),
//   3. write src/brand.ts (brand name, character keys, cover hosts) from brand/brand.mjs,
//   4. name the package after the folder.
// Usage, from anywhere: node <repo>/scripts/new-project.mjs <slug>
import fs from "node:fs";
import path from "node:path";
import { BRAND, BRAND_DIR, ROOT, TEMPLATE_DIR } from "./brand.mjs";

const slug = process.argv[2];
if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
  console.error("Pakai: node scripts/new-project.mjs <slug>  (huruf kecil, angka, tanda minus)");
  process.exit(1);
}
const dest = path.join(ROOT, slug);
if (fs.existsSync(dest)) {
  console.error(`${dest} sudah ada`);
  process.exit(1);
}

// node_modules and out/ never belong in a new project (dependencies are shared in the repo root).
fs.cpSync(TEMPLATE_DIR, dest, { recursive: true, filter: (src) => !/^(node_modules|out)(\/|$)/.test(path.relative(TEMPLATE_DIR, src)) });
const own = path.join(BRAND_DIR, "template");
if (fs.existsSync(own)) fs.cpSync(own, dest, { recursive: true });

const keys = Object.keys(BRAND.characters ?? {});
const brand = { name: BRAND.name, characters: keys, hosts: { explain: BRAND.hosts?.explain ?? keys[0], ask: BRAND.hosts?.ask ?? keys.at(-1), remind: BRAND.hosts?.remind ?? keys[1] ?? keys[0] } };
fs.writeFileSync(
  path.join(dest, "src/brand.ts"),
  `// This project's brand. scripts/new-project.mjs writes this file from brand/brand.mjs (or
// brand.example/brand.mjs) when the project is created. Character images in public/img are named
// <key>-<pose>.png with these keys; hosts are who explains, who asks and who reminds/welcomes in the
// cover gallery (AsetSampul).
export const BRAND = ${JSON.stringify(brand, null, 2).replace(/"(\w+)":/g, "$1:")};
`,
);

const pkg = path.join(dest, "package.json");
fs.writeFileSync(pkg, fs.readFileSync(pkg, "utf8").replace('"name": "tiktok-video"', `"name": "${slug}"`));
console.log(`Proyek baru: ${dest} (brand ${BRAND.name}${fs.existsSync(own) ? ", file brand dari " + path.relative(ROOT, own) : ""})`);
