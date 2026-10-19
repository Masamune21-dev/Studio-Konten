import { AbsoluteFill, Audio, staticFile, getInputProps } from "remotion";
import { Sequence, useVideoConfig, useFrameRatio } from "./components/Time";
import script from "./script.json";
import durations from "./vo-durations.json";
import turnsJson from "./vo-turns.json";
import { Captions, captionLines, timeWords } from "./components/Captions";
import { CropCheck } from "./components/CropCheck";
import { Camera, CameraCfg, Punch, SceneFrame, Shake, Spot, SPOT_FULL, Spotlight, Trans, TRANS_SFX, WIPE, ZOOM_DEFAULT, ZOOM_IN, planTransitions } from "./components/Edit";
import { Sfx, SfxName, SfxScope, WIPE_SFX } from "./components/Sfx";
import { SCENES, Scene } from "./scenes";
import { CORE_SCENES } from "./components/Cover";
import { THEMES } from "./design";
import { FPS, LEAD_IN, TAIL } from "./theme";

// Scenes without narration yet get a 3 s placeholder so the project still loads
const voFrames = (id: string) => Math.ceil(((durations as Record<string, number>)[id] ?? 3) * FPS);
export const sceneFrames = (id: string) => LEAD_IN + voFrames(id) + TAIL;
export const totalFrames = () => script.scenes.reduce((s, sc) => s + sceneFrames(sc.id), 0);

// Editing cues written per scene in script.json, all timed the same way:
//   "sfx":     [{ "s": "ding", "kata": "gratis" }, { "s": "pop", "t": 1.2 }]
//   "sorot":   [{ "kata": "gratis", "x": 0.5, "y": 0.42, "w": 0.7, "h": 0.2, "xw": 0.3, "yw": 0.5, "ww": 0.4, "hw": 0.3, "lama": 1.5, "s": "blip" }]
//   "zoom":    [{ "kata": "gratis", "skala": 1.08, "x": 0.5, "y": 0.4, "xw": 0.3, "yw": 0.5, "lama": 1.5, "s": "swipe" }]
//   "guncang": [{ "kata": "putus", "kuat": 1, "s": "thud" }]
//   "tekan":   ["gratis", "5 hari"]   words/phrases coloured in the captions (numbers always are)
//   "transisi": "fade"                how this scene comes in (components/Edit.tsx)
// kata = when the captions highlight that word (first match; "ke": 2 for the second), t = seconds
// after the narration starts (added to kata when both are given); "v" = volume. x/y = focus point
// (zoom) or centre of the lit area (sorot) as a share of the 9:16 frame (default 0.5, 0.42), w/h the
// size of the lit area (default 0.7 × 0.22); xw/yw/ww/hw the same for the 16:9 YouTube layout, where
// the subject usually sits elsewhere (default 0.5, 0.45, 0.45, 0.35); lama = seconds held (default
// 1.5). Zoom skala defaults to 1.08 and is clamped to 1.12; prefer "sorot" or a new element as the
// beat and keep zooms to about 3 per video (npm run qa warns above that). An unknown word stops the
// render, so typos show up.
type When = { kata?: string; ke?: number; t?: number };
type Cue = When & { s: SfxName; v?: number };
type ZoomCue = When & { skala?: number; x?: number; y?: number; xw?: number; yw?: number; lama?: number; s?: SfxName };
type SpotCue = When & { x?: number; y?: number; w?: number; h?: number; xw?: number; yw?: number; ww?: number; hw?: number; lama?: number; s?: SfxName };
type ShakeCue = When & { kuat?: number; s?: SfxName };
type Cues = { sfx?: Cue[]; zoom?: ZoomCue[]; sorot?: SpotCue[]; guncang?: ShakeCue[]; tekan?: string[]; transisi?: string };
const cuesOf = (scene: Scene) => scene as Scene & Cues;

// Dialog scenes get one caption block per turn, timed to that speaker's clip.
const TURNS = turnsJson as Record<string, { start: number; end: number; vo: string }[]>;
const sceneCaptions = (scene: Scene) => {
  const turns = TURNS[scene.id];
  const emph = cuesOf(scene).tekan;
  if (!turns || turns.length < 2) return <Captions vo={scene.vo} from={LEAD_IN} frames={voFrames(scene.id)} emph={emph} />;
  return turns.map((t, i) => {
    const from = LEAD_IN + Math.round(t.start * FPS);
    const next = turns[i + 1];
    return <Captions key={i} vo={t.vo} from={from} frames={Math.round((t.end - t.start) * FPS)} until={next ? LEAD_IN + Math.round(next.start * FPS) : undefined} emph={emph} />;
  });
};

const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const cueFrame = (scene: Scene, cue: When, what: string) => {
  if (cue.kata === undefined) return LEAD_IN + Math.round((cue.t ?? 0) * FPS);
  const turns = TURNS[scene.id];
  const words =
    turns && turns.length > 1
      ? turns.flatMap((t) => timeWords(t.vo, LEAD_IN + Math.round(t.start * FPS), Math.round((t.end - t.start) * FPS)))
      : timeWords(scene.vo, LEAD_IN, voFrames(scene.id));
  const hit = words.filter((w) => norm(w.text) === norm(cue.kata!))[(cue.ke ?? 1) - 1];
  if (!hit) throw new Error(`${what} ${scene.id}: kata "${cue.kata}" tidak ada di narasi`);
  return Math.round(hit.start) + Math.round((cue.t ?? 0) * FPS);
};

const SceneSfx: React.FC<{ scene: Scene }> = ({ scene }) => {
  const c = cuesOf(scene);
  const all = [
    ...(c.sfx ?? []).map((q) => ({ s: q.s, at: cueFrame(scene, q, "sfx"), v: q.v })),
    ...(c.zoom ?? []).filter((q) => q.s).map((q) => ({ s: q.s!, at: cueFrame(scene, q, "zoom"), v: 1 })),
    ...(c.sorot ?? []).filter((q) => q.s).map((q) => ({ s: q.s!, at: cueFrame(scene, q, "sorot"), v: 1 })),
    ...(c.guncang ?? []).filter((q) => q.s).map((q) => ({ s: q.s!, at: cueFrame(scene, q, "guncang"), v: 1 })),
  ];
  return (
    <>
      {all.map((q, i) => (
        <Sfx key={i} s={q.s} at={q.at} volume={q.v} />
      ))}
    </>
  );
};

const CAMERA = (script as { kamera?: CameraCfg }).kamera;
// Seeded by the narration, so every video gets its own sequence of transitions.
const TRANS = planTransitions(script.scenes as { id: string; transisi?: string }[], (script as { transisi?: unknown }).transisi, script.scenes.map((s) => s.vo.slice(0, 24)).join("|"));

const cameraCues = (scene: Scene, wide: boolean) => {
  const c = cuesOf(scene);
  const punches: Punch[] = (c.zoom ?? []).map((z) => ({
    at: cueFrame(scene, z, "zoom"),
    scale: z.skala ?? ZOOM_DEFAULT,
    x: wide ? (z.xw ?? 0.5) : (z.x ?? 0.5),
    y: wide ? (z.yw ?? 0.45) : (z.y ?? 0.42),
    hold: Math.round((z.lama ?? 1.5) * FPS),
  }));
  const spots: Spot[] = (c.sorot ?? []).map((z) => ({
    at: cueFrame(scene, z, "sorot"),
    x: wide ? (z.xw ?? 0.5) : (z.x ?? 0.5),
    y: wide ? (z.yw ?? 0.45) : (z.y ?? 0.42),
    w: wide ? (z.ww ?? 0.45) : (z.w ?? 0.7),
    h: wide ? (z.hw ?? 0.35) : (z.h ?? 0.22),
    hold: Math.round((z.lama ?? 1.5) * FPS),
  }));
  const shakes: Shake[] = (c.guncang ?? []).map((g) => ({ at: cueFrame(scene, g, "guncang"), power: g.kuat ?? 1 }));
  return { punches, spots, shakes };
};

export type SceneComp = React.FC<{ scene: Scene; duration: number }>;

// One scene on the timeline: its transition in and out, the camera over its content, narration,
// sound cues and captions. The previous scene stays underneath for the WIPE frames of the cut.
const SceneShell: React.FC<{ scene: Scene; index: number; duration: number; enter: Trans | null; exit: Trans | null; Comp: SceneComp }> = ({ scene, index, duration, enter, exit, Comp }) => {
  const { width, height } = useVideoConfig();
  const { punches, spots, shakes } = cameraCues(scene, width > height);
  const edge = THEMES[scene.theme]?.accent ?? "#000";
  return (
    <SfxScope.Provider value={scene.id}>
      <SceneFrame enter={enter} exit={exit} duration={duration} edge={edge} bg={THEMES[scene.theme]?.bg}>
        {/* Before a match cut ("cut" + Handoff) the camera must not drift, or the shared shape would jump at the cut. */}
        <Camera cfg={exit?.name === "cut" && CAMERA !== false ? { ...(CAMERA ?? {}), drift: 0 } : CAMERA} duration={duration} odd={index % 2 === 1} punches={punches} shakes={shakes}>
          <Comp scene={scene} duration={duration} />
          <Spotlight spots={spots} color={edge} id={scene.id} />
        </Camera>
        <Sequence from={LEAD_IN}>
          <Audio src={staticFile(`vo/${scene.id}.${script.engine === "gemini" ? "wav" : "mp3"}`)} />
        </Sequence>
        {enter && WIPE_SFX && TRANS_SFX[enter.name][1] > 0 && <Sfx s={TRANS_SFX[enter.name][0]} volume={TRANS_SFX[enter.name][1]} />}
        <SceneSfx scene={scene} />
        {sceneCaptions(scene)}
      </SceneFrame>
    </SfxScope.Provider>
  );
};

// Shared by the TikTok (Video) and YouTube (VideoWide) compositions: same scenes,
// same narration, timing and edit; only the component drawn for each scene differs.
export const Timeline: React.FC<{ pick: (scene: Scene) => SceneComp }> = ({ pick }) => {
  let from = 0;
  const scenes = script.scenes as Scene[];
  const { width, height } = useVideoConfig();
  const k = useFrameRatio(); // logged frames are real frames (2 per logical frame at 60 fps)
  // check:crop also measures every zoom at full scale and every shake at its widest swing.
  if (getInputProps().checkCrop) {
    let at = 0;
    const peaks = scenes.flatMap((s) => {
      const { punches, shakes } = cameraCues(s, width > height);
      const list = [...punches.map((p) => at + p.at + ZOOM_IN), ...shakes.map((sh) => at + sh.at + 1)].map((frame) => ({ scene: s.id, frame: Math.round(frame * k) }));
      at += sceneFrames(s.id);
      return list;
    });
    console.log(`EDITCUES ${JSON.stringify(peaks)}`);
    // and the middle of every caption line, to check that no line sits on a face.
    at = 0;
    const lines = scenes.flatMap((s) => {
      const turns = TURNS[s.id];
      const spans =
        turns && turns.length > 1
          ? turns.flatMap((t) => captionLines(t.vo, LEAD_IN + Math.round(t.start * FPS), Math.round((t.end - t.start) * FPS), width > height))
          : captionLines(s.vo, LEAD_IN, voFrames(s.id), width > height);
      const list = spans.map((l) => ({ scene: s.id, frame: Math.round((at + (l.start + l.end) / 2) * k) }));
      at += sceneFrames(s.id);
      return list;
    });
    console.log(`CAPLINES ${JSON.stringify(lines)}`);
  }
  // npm run frames -- --isyarat: every zoom / sorot / guncang at its fullest, to check where it aims.
  if (getInputProps().listCues) {
    let at = 0;
    const cues = scenes.flatMap((s) => {
      const { punches, spots, shakes } = cameraCues(s, width > height);
      const list = [
        ...punches.map((p) => ({ kind: "zoom", frame: at + p.at + ZOOM_IN })),
        ...spots.map((p) => ({ kind: "sorot", frame: at + p.at + SPOT_FULL })),
        ...shakes.map((p) => ({ kind: "guncang", frame: at + p.at + 1 })),
      ].map((c) => ({ scene: s.id, kind: c.kind, frame: Math.round(c.frame * k) }));
      at += sceneFrames(s.id);
      return list;
    });
    console.log(`CUEFRAMES ${JSON.stringify(cues)}`);
  }
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {scenes.map((scene, i) => {
        const d = sceneFrames(scene.id);
        const last = i === scenes.length - 1;
        const seq = (
          <Sequence key={scene.id} from={from} durationInFrames={d + (last ? 0 : WIPE)} name={scene.id}>
            <SceneShell scene={scene} index={i} duration={d} enter={TRANS[i]} exit={TRANS[i + 1] ?? null} Comp={pick(scene)} />
          </Sequence>
        );
        from += d;
        return seq;
      })}
      {getInputProps().checkCrop ? <CropCheck /> : null}
    </AbsoluteFill>
  );
};

// Scene kinds shared by every library ("cover", components/Cover.tsx) back up the project's own SCENES.
export const pickScene = (scene: Scene): SceneComp => SCENES[scene.kind] ?? (CORE_SCENES[scene.kind] as unknown as SceneComp);
export const Video: React.FC = () => <Timeline pick={pickScene} />;
