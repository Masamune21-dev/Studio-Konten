// Vector outlines of the brand logo for the series tag on the cover (components/Cover.tsx). The
// generic template ships none, so the tag shows the brand name as text. A brand can ship its own
// copy of this file in brand/template/src/components/logoGlyphs.ts (same exports, outlines in the
// pixels of a 600-wide logo image, y down) and scripts/new-project.mjs puts it in every new project.
export type Pt = [number, number];
export type Glyph = { id: string; outer: Pt[]; holes: Pt[][] };

// Baseline of the letters, in logo-image pixels.
export const BASE = 156.3;
export const GLYPHS: Glyph[] = [];
