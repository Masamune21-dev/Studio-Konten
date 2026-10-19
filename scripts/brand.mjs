// The brand this Studio makes videos for. Everything brand-specific (name, social accounts,
// characters, brand profile, logo and template files) lives in one folder:
//   brand/          your own brand, not in git (copy brand.example/ to start)
//   brand.example/  the fictional example brand that ships with the repo
// The Studio server, the shared scripts and scripts/new-project.mjs all read it from here.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const BRAND_DIR = fs.existsSync(path.join(ROOT, "brand", "brand.mjs")) ? path.join(ROOT, "brand") : path.join(ROOT, "brand.example");
export const BRAND = (await import(pathToFileURL(path.join(BRAND_DIR, "brand.mjs")).href)).default;
export const TEMPLATE_DIR = path.join(ROOT, "skill", "video-tiktok", "assets", "template");

// Brand profile (fact source for ideas, captions and videos): the first value of settings.brand_profile.
export const brandProfile = () => {
  const file = path.join(BRAND_DIR, "profile.md");
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trimEnd() : "";
};

// A template file as a new project gets it: the brand's own copy (brand/template/…) wins.
export const templateFile = (rel) => {
  const own = path.join(BRAND_DIR, "template", rel);
  return fs.existsSync(own) ? own : path.join(TEMPLATE_DIR, rel);
};

// "<Nama> <peran>, …" for prompts.
export const hostList = () =>
  Object.values(BRAND.characters ?? {})
    .map((c) => `${c.name} ${c.role}`)
    .join(", ");

// "TikTok @x, Instagram @y" for follow prompts.
export const socialList = () =>
  [BRAND.social?.tiktok && `TikTok @${BRAND.social.tiktok}`, BRAND.social?.instagram && `Instagram @${BRAND.social.instagram}`].filter(Boolean).join(", ");
