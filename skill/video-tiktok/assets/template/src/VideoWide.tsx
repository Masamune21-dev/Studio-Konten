import { AbsoluteFill } from "remotion";
import { Timeline, SceneComp, pickScene } from "./Video";
import { Scene } from "./scenes";
import { CoverOrientation } from "./components/Cover";
import { SCENES_WIDE } from "./scenesWide";
import { THEMES } from "./design";
import { W, H, WIDE_W, WIDE_H } from "./theme";

// YouTube version (16:9). Reuses the TikTok narration, timing and captions; each scene
// is drawn by its landscape component from scenesWide.tsx (by scene id, then kind).

// Fallback for a scene that has no landscape layout yet: the TikTok scene, scaled to
// full height and centred on its own theme colour, so the render never breaks.
const S = WIDE_H / H;
const Pillar: SceneComp = ({ scene, duration }) => {
  const Comp = pickScene(scene);
  return (
    <AbsoluteFill style={{ background: THEMES[scene.theme]?.bg ?? "#000" }}>
      <div style={{ position: "absolute", left: (WIDE_W - W * S) / 2, top: 0, width: W, height: H, transform: `scale(${S})`, transformOrigin: "0 0", overflow: "hidden", boxShadow: "0 0 80px rgba(0,0,0,0.35)" }}>
        <CoverOrientation.Provider value="portrait">
          <Comp scene={scene} duration={duration} />
        </CoverOrientation.Provider>
      </div>
    </AbsoluteFill>
  );
};

const pick = (scene: Scene) => SCENES_WIDE[scene.id] ?? SCENES_WIDE[scene.kind] ?? Pillar;

export const VideoWide: React.FC = () => <Timeline pick={pick} />;
