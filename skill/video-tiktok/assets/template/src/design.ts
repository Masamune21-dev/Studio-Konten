import { loadFont as loadBricolage } from "@remotion/google-fonts/BricolageGrotesque";
import { loadFont as loadInstrument } from "@remotion/google-fonts/InstrumentSerif";
import { loadFont as loadSpace } from "@remotion/google-fonts/SpaceGrotesk";
import script from "./script.json";
import coverModes from "./components/cover-modes.json";

// House style (since 19 Oct 2026). Until then every video drew a random palette (6) and
// type set (5, 12 faces in all) from `look`, and the opener layout and host position changed too;
// on the TikTok profile grid that read as many different channels and the user called it "jelek,
// kaya ngga konsisten". Now there is one brand palette and one type set. What changes between
// videos is the cover mode (`look.mode`, from the content pillar) and the content itself.
//   "look": { "mode": "hitungan", "tag": "HITUNGAN" }
// Old projects keep their own copy of this file, so their look does not change.
// Scenes keep using the same theme names (cream, cobalt, sun, night, white, coral, mint). K.ink
// stays dark and K.cream / K.white light, so cards and text keep contrast. cobalt, night and coral
// are dark backgrounds with light text, the others light with dark text.
// Text on a background should use t.fg / t.accent, never a raw K colour.
type Look = { mode?: string; tag?: string };
const look = ((script as { look?: Look }).look ?? {}) as Look;

/* ---------- typography: three faces, always ---------- */
// display = headlines and big numbers (800), serif = the italic second voice in a headline (the
// question tail: "bagus nggak?"), label = small caps, units and data. Code/OTP/IP text uses `mono`
// from theme.ts. No other faces in scenes (npm run qa warns).
const sub = { subsets: ["latin"] as ["latin"] };
export const display = loadBricolage("normal", { weights: ["500", "700", "800"], ...sub }).fontFamily;
export const serif = loadInstrument("italic", { weights: ["400"], ...sub }).fontFamily;
export const label = loadSpace("normal", { weights: ["500", "700"], ...sub }).fontFamily;
// Kept for scene libraries written before the house style: the accent face always has an italic now.
export const accentItalic = true;

/* ---------- the brand palette ---------- */
type Base = { cream: string; ink: string; cobalt: string; cyan: string; sun: string; coral: string; mint: string; white: string; night: string; brand: string };
export type Theme = { bg: string; fg: string; accent: string; soft: string };
const DARK_SOFT = "rgba(255,255,255,0.10)";
const LIGHT_SOFT = "rgba(14,26,58,0.08)";

// brand = brand blue (cover of the promo mode), night = navy of the dark covers.
export const K: Base = {
  cream: "#F3EFE6",
  ink: "#0E1A3A",
  cobalt: "#2B50FF",
  cyan: "#3BD5F5",
  sun: "#FFD23F",
  coral: "#FF5A4D",
  mint: "#4FD6A6",
  white: "#FFFFFF",
  night: "#0B1B3A",
  brand: "#1F4FD8",
};

export const THEMES: Record<string, Theme> = {
  cream: { bg: K.cream, fg: K.ink, accent: K.cobalt, soft: LIGHT_SOFT },
  cobalt: { bg: K.brand, fg: K.white, accent: K.sun, soft: "rgba(255,255,255,0.12)" },
  sun: { bg: K.sun, fg: K.ink, accent: K.cobalt, soft: LIGHT_SOFT },
  night: { bg: K.night, fg: K.white, accent: K.cyan, soft: DARK_SOFT },
  white: { bg: K.white, fg: K.ink, accent: K.cobalt, soft: "rgba(14,26,58,0.06)" },
  coral: { bg: K.coral, fg: K.white, accent: K.ink, soft: "rgba(255,255,255,0.14)" },
  // light sky blue: the brand has no green background
  mint: { bg: "#DCEEFF", fg: K.ink, accent: K.cobalt, soft: LIGHT_SOFT },
};

/* ---------- cover mode ---------- */
// The first scene doubles as the TikTok cover (components/Cover.tsx). Its mode follows the content
// pillar: hitungan (numbers, navy), tips (paper), aman (navy + coral), promo (brand blue).
export type CoverMode = {
  key: string;
  name: string;
  theme: string;
  bg: string;
  fg: string;
  accent: string;
  accent2: string;
  tagBg: string;
  tagFg: string;
  tag: string;
};
const MODES = coverModes.modes as Record<string, Omit<CoverMode, "key">>;
export const MODE_NAMES = Object.keys(MODES);
export const COVER_TAGS = coverModes.tags;
// A mode by key (unknown keys fall back to "tips"); `tag` must be one of COVER_TAGS.
export const coverMode = (key?: string, tag?: string): CoverMode => {
  const k = key && MODES[key] ? key : "tips";
  return { key: k, ...MODES[k], tag: tag && COVER_TAGS.includes(tag) ? tag : MODES[k].tag };
};
export const MODE: CoverMode = coverMode(look.mode, look.tag);
