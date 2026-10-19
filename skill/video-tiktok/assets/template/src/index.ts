import { Composition, Still, registerRoot } from "remotion";
import { createElement, Fragment } from "react";
import { Video, totalFrames } from "./Video";
import { VideoWide } from "./VideoWide";
import { Sheet } from "./Sheet";
import { AsetIkon, AsetMotion, AsetSvg } from "./Aset";
import { AsetSampul } from "./AsetSampul";
import { EditVideo, editFrames } from "./Footage";
import { FPS, OUT_FPS, W, H, WIDE_W, WIDE_H } from "./theme";

// Scenes count logical FPS frames; the video renders at OUT_FPS (components/Time.tsx).
const frames = () => Math.round((totalFrames() * OUT_FPS) / FPS);

const Root = () =>
  createElement(
    Fragment,
    null,
    createElement(Composition, { id: "Video", component: Video, durationInFrames: frames(), fps: OUT_FPS, width: W, height: H }),
    createElement(Composition, { id: "VideoWide", component: VideoWide, durationInFrames: frames(), fps: OUT_FPS, width: WIDE_W, height: WIDE_H }),
    createElement(Still, { id: "Sheet", component: Sheet, width: W, height: H }),
    // Edited footage (src/Footage.tsx + src/edit.json): 9:16 and 16:9.
    createElement(Composition, { id: "Edit", component: EditVideo, durationInFrames: Math.round((editFrames() * OUT_FPS) / FPS), fps: OUT_FPS, width: W, height: H }),
    createElement(Composition, { id: "EditWide", component: EditVideo, durationInFrames: Math.round((editFrames() * OUT_FPS) / FPS), fps: OUT_FPS, width: WIDE_W, height: WIDE_H }),
    // Icon and SVG galleries (src/Aset.tsx).
    createElement(Still, { id: "AsetIkon", component: AsetIkon, width: W, height: H }),
    createElement(Composition, { id: "AsetSvg", component: AsetSvg, durationInFrames: Math.round(6 * OUT_FPS), fps: OUT_FPS, width: W, height: H }),
    createElement(Composition, { id: "AsetMotion", component: AsetMotion, durationInFrames: Math.round(10 * OUT_FPS), fps: OUT_FPS, width: W, height: H }),
    // Cover system gallery (src/AsetSampul.tsx): six covers as the profile grid shows them + anatomy.
    createElement(Still, { id: "AsetSampul", component: AsetSampul, width: W, height: H }),
  );

registerRoot(Root);
