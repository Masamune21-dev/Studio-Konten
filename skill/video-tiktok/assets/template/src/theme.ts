import script from "./script.json";
import { loadFont as loadSans } from "@remotion/google-fonts/PlusJakartaSans";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

export const sans = loadSans("normal", { weights: ["500", "700", "800"], subsets: ["latin"] }).fontFamily;
export const mono = loadMono("normal", { weights: ["500", "700"], subsets: ["latin"] }).fontFamily;

// Colours of a dark network-dashboard theme
export const C = {
  bg: "#050b1a",
  bg2: "#0a1a36",
  panel: "rgba(13, 28, 56, 0.85)",
  border: "rgba(56, 189, 248, 0.28)",
  cyan: "#22d3ee",
  sky: "#0ea5e9",
  green: "#10b981",
  red: "#ef4444",
  amber: "#f59e0b",
  violet: "#a78bfa",
  text: "#eaf2ff",
  muted: "#8ea3c4",
};

// Logical frames per second: all scene code counts in these (components/Time.tsx).
export const FPS = 30;
// Frames per second of the rendered video: 60 by default since 11 Oct 2026 (smoother motion, renders
// about twice as long); script.json "fps": 30 for a faster render.
export const OUT_FPS: number = (script as { fps?: number }).fps ?? 60;
export const W = 1080;
export const H = 1920;
// YouTube version (VideoWide)
export const WIDE_W = 1920;
export const WIDE_H = 1080;

// Frames of silence before narration starts / after it ends in each scene
export const LEAD_IN = 6;
export const TAIL = 12;
