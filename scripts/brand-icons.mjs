// Packs a chosen set of brand logos from Simple Icons (CC0, https://simpleicons.org) into the
// template as plain path data, so projects need no extra package and render offline:
//   npm pack simple-icons@16.32.0 && tar xzf simple-icons-16.32.0.tgz
//   node scripts/brand-icons.mjs <unpacked simple-icons/package> [slug …]
// Writes skill/video-tiktok/assets/template/src/components/brandIcons.ts. The logos stay trademarks
// of their owners: only for naming a platform or a follow/share call to action, never altered
// (SKILL.md "Ikon & SVG").
import fs from "node:fs";
import path from "node:path";

const [pkg, ...extra] = process.argv.slice(2);
if (!pkg || !fs.existsSync(path.join(pkg, "icons"))) {
  console.error("Pakai: node scripts/brand-icons.mjs <folder package simple-icons> [slug …]");
  process.exit(1);
}
const SLUGS = [
  // social & chat
  "tiktok", "instagram", "youtube", "whatsapp", "facebook", "messenger", "x", "threads", "telegram", "discord", "line", "snapchat", "pinterest", "reddit", "twitch", "zoom",
  // Google, devices, browsers
  "google", "gmail", "googlemaps", "googlechrome", "android", "apple",
  // network & internet
  "mikrotik", "speedtest", "cloudflare",
  // streaming, games, shopping, rides
  "netflix", "spotify", "steam", "playstation", "shopee", "gojek", "grab",
  // AI
  "claude", "anthropic", "googlegemini",
  ...extra,
];
const meta = JSON.parse(fs.readFileSync(path.join(pkg, "data/simple-icons.json"), "utf8"));
const list = Array.isArray(meta) ? meta : meta.icons;
const version = JSON.parse(fs.readFileSync(path.join(pkg, "package.json"), "utf8")).version;
const slugOf = (m) => m.slug ?? m.title.toLowerCase().replace(/[^a-z0-9]/g, "");

const out = [];
for (const slug of SLUGS) {
  const file = path.join(pkg, "icons", `${slug}.svg`);
  if (!fs.existsSync(file)) {
    console.warn(`lewati ${slug}: tidak ada di simple-icons ${version}`);
    continue;
  }
  const d = fs.readFileSync(file, "utf8").match(/<path d="([^"]+)"/)?.[1];
  const m = list.find((x) => slugOf(x) === slug);
  if (!d || !m) {
    console.warn(`lewati ${slug}: path atau data tidak terbaca`);
    continue;
  }
  out.push({ slug, title: m.title, hex: `#${m.hex}`, path: d, guidelines: m.guidelines ?? null });
}

const dest = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../skill/video-tiktok/assets/template/src/components/brandIcons.ts");
const body = out.map((b) => `  ${JSON.stringify(b.slug)}: { title: ${JSON.stringify(b.title)}, hex: ${JSON.stringify(b.hex)}, path: ${JSON.stringify(b.path)}${b.guidelines ? `, guidelines: ${JSON.stringify(b.guidelines)}` : ""} },`).join("\n");
fs.writeFileSync(
  dest,
  `// Brand logos from Simple Icons ${version} (CC0 1.0, https://simpleicons.org), packed by
// scripts/brand-icons.mjs. 24×24 viewBox, one filled path each. Trademarks of their owners: use only
// to name a platform or in a follow/share call to action, in the brand colour or plain white/black,
// never redrawn, recoloured into another brand, or combined into a new logo.
export type Brand = { title: string; hex: string; path: string; guidelines?: string };
export const BRANDS = {
${body}
} satisfies Record<string, Brand>;
export type BrandName = keyof typeof BRANDS;
`,
);
console.log(`${out.length} logo → ${path.relative(process.cwd(), dest)}`);
