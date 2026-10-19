// Logical time. All scene code is written in FPS (30) frames per second: delays, durations, cue
// frames, spring/interpolate ranges. The video itself renders at OUT_FPS (script.json "fps": 60 for
// smoother motion). These three replace Remotion's own: useCurrentFrame returns the logical frame
// (fractional at 60 fps, so every animation is computed twice per logical frame instead of held),
// useVideoConfig reports the logical fps and length, and Sequence takes logical from/durationInFrames.
// At "fps": 30 they behave exactly like Remotion's.
import React from "react";
import * as R from "remotion";
import { FPS } from "../theme";

// Real frames per logical frame (1 at 30 fps, 2 at 60 fps).
export const useFrameRatio = () => R.useVideoConfig().fps / FPS;

export const useCurrentFrame = () => {
  const k = useFrameRatio();
  return R.useCurrentFrame() / k;
};

export const useVideoConfig = () => {
  const c = R.useVideoConfig();
  const k = c.fps / FPS;
  return { ...c, fps: FPS, durationInFrames: Math.round(c.durationInFrames / k) };
};

type SeqProps = React.ComponentProps<typeof R.Sequence>;
export const Sequence: React.FC<SeqProps> = (props) => {
  const k = useFrameRatio();
  const { from, durationInFrames, ...rest } = props as SeqProps & { from?: number; durationInFrames?: number };
  const real = {
    ...rest,
    from: from === undefined ? undefined : Math.round(from * k),
    durationInFrames: durationInFrames === undefined || !Number.isFinite(durationInFrames) ? durationInFrames : Math.max(1, Math.round(durationInFrames * k)),
  } as SeqProps;
  return <R.Sequence {...real} />;
};
