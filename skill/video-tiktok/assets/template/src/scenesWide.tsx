import type { SceneComp } from "./Video";

// Landscape (1920×1080) scenes for the YouTube version, keyed by scene id (s01…) or by
// kind. Same props as the TikTok scenes ({ scene, duration }) and the same narration
// timing; only the layout changes. A scene missing here is shown as the TikTok scene
// centred on its theme colour (see VideoWide.tsx), so fill in every scene before the
// final `npm run render:yt`. Layout rules: "Versi YouTube" in the video-tiktok skill.
export const SCENES_WIDE: Record<string, SceneComp> = {};
