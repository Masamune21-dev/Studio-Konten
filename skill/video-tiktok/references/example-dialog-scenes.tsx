import { Img, interpolate, spring, staticFile, Easing } from "remotion";
import { useCurrentFrame, useVideoConfig } from "./components/Time";
import { display, serif, label, K } from "./design";
import { Backdrop, Chip, Kicker, Marquee, Outline, Reveal, useIn } from "./components/Kinetic";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import turnsJson from "./vo-turns.json";
import { LEAD_IN } from "./theme";
import { P, Scene, at, big, idx, italic, themeOf, Headline, LogoCard } from "./components/Type";

export type { Scene } from "./components/Type";

/* ---------- anime character (transparent PNG) ---------- */
// Pose files are named <who>-<pose>.png (who = bayu | sari). A pose with mouth
// frames also has <name>-mulut-closed/mid/open.png, identical except for the mouth.
// Only the character whose turn it is (src/vo-turns.json) tilts and moves its
// mouth; the other one just breathes.
type PoseAt = { at: number; src: string };
const MOUTHS = new Set(["bayu-hp-half", "bayu-jempol-half", "bayu-tunjuk", "bayu-lambai", "sari-hp", "sari-kerja", "sari-jempol"]);
const TURNS = turnsJson as Record<string, { who: string; start: number; end: number }[]>;

const speakingAt = (sceneId: string, who: string, sec: number) => {
  const turns = TURNS[sceneId];
  if (!turns) return false;
  return turns.some((t) => t.who === who && sec >= t.start - 0.05 && sec <= t.end + 0.05);
};

// Loudness of the scene narration at a given frame, 0..1.
const useLevel = (sceneId: string, frame: number) => {
  const { fps } = useVideoConfig();
  const audioData = useAudioData(staticFile(`vo/${sceneId}.wav`));
  if (!audioData || frame < 0 || frame / fps > audioData.durationInSeconds) return 0;
  const bins = visualizeAudio({ fps, frame, audioData, numberOfSamples: 16 });
  return Math.min(1, (bins.slice(0, 8).reduce((a, b) => a + b, 0) / 8) * 6);
};

const Anime: React.FC<{
  scene: Scene;
  duration: number;
  poses: PoseAt[];
  height: number;
  style: React.CSSProperties;
  flip?: boolean;
  from?: "left" | "right" | "up";
  delay?: number;
  seed?: number;
  disc?: string;
}> = ({ scene, duration, poses, height, style, flip, from = "up", delay = 6, seed = 0, disc }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - delay, fps, config: { damping: 14, stiffness: 120 } });
  const cur = [...poses].reverse().find((p) => f >= at(duration, p.at)) ?? poses[0];
  const who = cur.src.split("-")[0];
  const talking = speakingAt(scene.id, who, (f - LEAD_IN) / fps);
  // Mouth shapes change about 10 times a second, like hand-drawn lip flaps.
  const step = Math.floor((f - LEAD_IN) / 3) * 3;
  const level = useLevel(scene.id, step);
  const smooth = useLevel(scene.id, f - LEAD_IN);
  const mouth = !MOUTHS.has(cur.src) ? null : !talking || level < 0.12 ? "closed" : level < 0.42 ? "mid" : "open";
  const file = mouth ? `${cur.src}-mulut-${mouth}` : cur.src;
  const changed = at(duration, cur.at);
  const pop = changed > 0 ? spring({ frame: f - changed, fps, config: { damping: 11, stiffness: 200 } }) : 1;
  const breath = Math.sin(f / 18 + seed * 2) * (talking ? 1 : 0.6);
  const tilt = talking ? Math.sin(f / 9 + seed) * 1.6 * Math.min(1, smooth * 1.5) + smooth * 1.2 : 0;
  const off = interpolate(s, [0, 1], [1, 0]);
  const enter =
    from === "left" ? `translateX(${-off * 500}px)` : from === "right" ? `translateX(${off * 500}px)` : `translateY(${off * 400}px)`;
  return (
    <div style={{ position: "absolute", ...style, height, opacity: Math.min(1, s * 2), transform: enter }}>
      {disc && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: height * 0.06,
            width: height * 0.62,
            height: height * 0.62,
            marginLeft: -height * 0.31,
            borderRadius: "50%",
            background: disc,
            transform: `scale(${s})`,
          }}
        />
      )}
      <Img
        src={staticFile(`img/${file}.png`)}
        style={{
          height,
          display: "block",
          position: "relative",
          transformOrigin: "50% 100%",
          transform: `translateY(${breath * 5}px) scaleY(${1 + breath * 0.006}) rotate(${(flip ? -1 : 1) * tilt}deg) scaleX(${flip ? -1 : 1}) scale(${interpolate(pop, [0, 1], [0.94, 1])})`,
          filter: "drop-shadow(0 18px 24px rgba(0,0,0,0.22))",
        }}
      />
    </div>
  );
};

/* ---------- anime illustration card ---------- */
// Generated anime scenery in a rounded frame, slowly drifting (Ken Burns).
const Scenery: React.FC<{
  src: string;
  duration: number;
  style: React.CSSProperties;
  delay?: number;
  zoom?: [number, number];
  pan?: [number, number];
  radius?: number;
  border?: string;
  children?: React.ReactNode;
}> = ({ src, duration, style, delay = 6, zoom = [1.04, 1.14], pan = [0, 0], radius = 34, border, children }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - delay, fps, config: { damping: 15, stiffness: 110 } });
  const k = interpolate(f, [0, duration], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        overflow: "hidden",
        borderRadius: radius,
        border,
        boxShadow: "0 18px 40px rgba(0,0,0,0.25)",
        opacity: Math.min(1, s * 1.6),
        transform: `translateY(${(1 - s) * 90}px) scale(${interpolate(s, [0, 1], [0.94, 1])})`,
        ...style,
      }}
    >
      <Img
        src={staticFile(`img/${src}`)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${interpolate(k, [0, 1], zoom)}) translate(${pan[0] * k}px, ${pan[1] * k}px)`,
        }}
      />
      {children}
    </div>
  );
};

/* ---------- illustrative daily traffic curve ---------- */
// Not measured data: a typical household pattern, labelled "ilustrasi" on screen.
const DAY = [22, 15, 10, 8, 7, 9, 18, 30, 38, 42, 45, 48, 52, 50, 48, 50, 55, 62, 75, 88, 100, 95, 80, 55, 35];

const DayChart: React.FC<{
  w: number;
  h: number;
  progress: number;
  ink: string;
  line: string;
  fill: string;
  peak?: number;
  cap?: number;
  capColor?: string;
  ticks?: boolean;
}> = ({ w, h, progress, ink, line, fill, peak = 0, cap = 0, capColor = K.cobalt, ticks = true }) => {
  const f = useCurrentFrame();
  const pad = { l: 10, r: 10, t: 40, b: ticks ? 60 : 10 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const top = 125; // y scale max, leaves room for capacity line
  const x = (i: number) => pad.l + (i / 24) * iw;
  const y = (v: number) => pad.t + ih - (v / top) * ih;
  const pts = DAY.map((v, i) => [x(i), y(v)] as const);
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const mx = (x0 + x1) / 2;
    d += ` C${mx} ${y0} ${mx} ${y1} ${x1} ${y1}`;
  }
  const area = `${d} L${x(24)} ${y(0)} L${x(0)} ${y(0)} Z`;
  const p = Math.max(0, Math.min(1, progress));
  const hi = p * 24;
  const i0 = Math.min(23, Math.floor(hi));
  const headV = DAY[i0] + (DAY[i0 + 1] - DAY[i0]) * (hi - i0);
  const capY = y(112);
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <defs>
        <clipPath id={`reveal${w}`}>
          <rect x={0} y={0} width={pad.l + p * iw} height={h} />
        </clipPath>
      </defs>
      {[25, 50, 75, 100].map((v) => (
        <line key={v} x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke={ink} strokeOpacity={0.12} strokeWidth={2} />
      ))}
      <rect x={x(19)} y={pad.t - 10} width={x(22) - x(19)} height={ih + 10} rx={14} fill={K.coral} opacity={0.18 * peak} />
      <g clipPath={`url(#reveal${w})`}>
        <path d={area} fill={fill} />
        <path d={d} fill="none" stroke={line} strokeWidth={10} strokeLinecap="round" />
      </g>
      {p > 0 && p < 1 && <circle cx={x(hi)} cy={y(headV)} r={16} fill={line} stroke="white" strokeWidth={5} />}
      {cap > 0 && (
        <g opacity={Math.min(1, cap * 2)}>
          <line
            x1={pad.l}
            x2={pad.l + iw * cap}
            y1={capY}
            y2={capY}
            stroke={capColor}
            strokeWidth={8}
            strokeDasharray="22 14"
            strokeDashoffset={-f * 2}
            strokeLinecap="round"
          />
          {cap > 0.95 && (
            <g>
              <line x1={x(20)} x2={x(20)} y1={capY + 10} y2={y(100) - 12} stroke={capColor} strokeWidth={4} />
              <path d={`M${x(20) - 10} ${capY + 20} L${x(20)} ${capY + 8} L${x(20) + 10} ${capY + 20}`} stroke={capColor} strokeWidth={4} fill="none" />
            </g>
          )}
        </g>
      )}
      {ticks &&
        [0, 6, 12, 18, 24].map((hh) => (
          <text key={hh} x={x(hh)} y={h - 14} fill={ink} fontFamily={label} fontWeight={700} fontSize={30} textAnchor="middle" opacity={0.7}>
            {String(hh % 24).padStart(2, "0")}.00
          </text>
        ))}
      <line x1={pad.l} x2={w - pad.r} y1={y(0)} y2={y(0)} stroke={ink} strokeWidth={4} />
    </svg>
  );
};

const Tag: React.FC<{ text: string; color: string; style?: React.CSSProperties }> = ({ text, color, style }) => (
  <div style={{ position: "absolute", fontFamily: label, fontWeight: 700, fontSize: 24, letterSpacing: 3, color, opacity: 0.6, ...style }}>{text}</div>
);

/* ---------- s01: clock hook ---------- */
const ClockHook: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  // 19:57 → 20:00 during the first second
  const m = Math.min(60, Math.floor(interpolate(f, [4, 34], [57, 60], { extrapolateRight: "clamp" })));
  const hh = m >= 60 ? "20" : "19";
  const mm = String(m % 60).padStart(2, "0");
  const flash = m >= 60 ? Math.max(0, 1 - (f - 34) / 20) : 0;
  const clockIn = useIn(0, 12);
  return (
    <Backdrop theme={t}>
      <Outline text="ONLINE · ONLINE · ONLINE" color="rgba(255,255,255,0.07)" top={1060} size={240} drift={1.5} />
      <Kicker index={idx(scene)} text={scene.kicker} color={t.fg} />
      <div
        style={{
          position: "absolute",
          top: 270,
          left: 60,
          right: 60,
          textAlign: "center",
          ...big(290, K.sun, { fontFamily: label, letterSpacing: -6 }),
          transform: `scale(${clockIn * (1 + flash * 0.08)})`,
          textShadow: `0 0 ${40 + flash * 60}px rgba(255,210,63,${0.35 + flash * 0.4})`,
        }}
      >
        {hh}
        <span style={{ opacity: f % 30 < 18 ? 1 : 0.3 }}>:</span>
        {mm}
      </div>
      <div style={{ position: "absolute", top: 600, left: 70, width: 560 }}>
        {scene.lines.map((l: string, i: number) => (
          <Reveal key={i} delay={at(duration, 0.45) + i * 6}>
            <div style={i === 1 ? italic(150, t.accent) : big(118, t.fg)}>{l}</div>
          </Reveal>
        ))}
      </div>
      <Scenery src="malam.png" duration={duration} delay={at(duration, 0.4)} style={{ top: 1125, left: 40, width: 540, height: 290 }} pan={[-24, 0]} border={`5px solid ${K.sun}`} />
      <Anime
        scene={scene}
        duration={duration}
        poses={[{ at: 0, src: "bayu-hp-half" }]}
        height={720}
        style={{ right: -40, top: 700 }}
        from="right"
        delay={10}
        disc="rgba(59,213,245,0.22)"
      />
    </Backdrop>
  );
};

/* ---------- s02: daily curve ---------- */
const DayCurve: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const progress = interpolate(f, [at(duration, 0.12), at(duration, 0.8)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });
  const peak = interpolate(f, [at(duration, 0.78), at(duration, 0.88)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pin = useIn(at(duration, 0.82), 10);
  return (
    <Backdrop theme={t}>
      <Kicker index={idx(scene)} text={scene.kicker} color={t.fg} />
      <div style={{ position: "absolute", top: 270, left: 70, right: 70 }}>
        <Reveal delay={2}>
          <div style={big(108, t.fg)}>{scene.title}</div>
        </Reveal>
        <Reveal delay={9}>
          <div style={italic(110, t.accent)}>{scene.sub}</div>
        </Reveal>
      </div>
      <div style={{ position: "absolute", top: 640, left: 70 }}>
        <DayChart w={940} h={700} progress={progress} ink={t.fg} line={K.cobalt} fill="rgba(43,80,255,0.16)" peak={peak} />
      </div>
      {[
        { at: 0.2, x: 210, text: "Pagi: santai" },
        { at: 0.45, x: 470, text: "Siang: naik dikit" },
      ].map((c) => (
        <div key={c.text} style={{ position: "absolute", top: 1010, left: c.x - 130, width: 260, textAlign: "center" }}>
          <Chip bg={t.fg} fg={t.bg} delay={at(duration, c.at)} style={{ fontSize: 30, padding: "10px 20px", whiteSpace: "nowrap" }}>
            {c.text}
          </Chip>
        </div>
      ))}
      <div
        style={{
          position: "absolute",
          top: 560,
          left: 70 + (20 / 24) * 920 - 150,
          width: 300,
          textAlign: "center",
          transform: `scale(${pin}) translateY(${(1 - pin) * 40}px)`,
        }}
      >
        <div style={{ display: "inline-block", background: K.coral, color: "white", borderRadius: 22, padding: "10px 24px", ...big(52, "white") }}>MELONJAK</div>
      </div>
      <Tag text="*ILUSTRASI POLA UMUM" color={t.fg} style={{ top: 1350, right: 70 }} />
    </Backdrop>
  );
};

/* ---------- s03: who is online ---------- */
const WhoOnline: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const tiles: { label: string; img: string }[] = scene.tiles;
  const tints = [K.coral, K.cobalt, K.mint, K.white];
  return (
    <Backdrop theme={t}>
      <Kicker index={idx(scene)} text={scene.kicker} color={t.fg} />
      <Headline lines={["Lagi pada", "ngapain", "sih?"]} t={t} sizes={[110, 120, 130]} top={260} />
      <div style={{ position: "absolute", top: 720, left: 60, width: 640, display: "flex", flexWrap: "wrap", gap: 20 }}>
        {tiles.map((tile, i) => {
          const s = useIn(at(duration, 0.32 + i * 0.12), 12, 160);
          const drift = interpolate(f, [0, duration], [1.04, 1.16]);
          const dark = tints[i] === K.cobalt;
          return (
            <div
              key={tile.label}
              style={{
                width: 310,
                height: 300,
                borderRadius: 34,
                background: tints[i],
                boxShadow: "0 14px 0 rgba(14,26,58,0.9)",
                border: `4px solid ${K.ink}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                transform: `scale(${s}) rotate(${(i % 2 ? 2 : -2) * s}deg)`,
                position: "relative",
              }}
            >
              <div style={{ width: 272, height: 196, borderRadius: 22, overflow: "hidden", border: `3px solid ${K.ink}` }}>
                <Img src={staticFile(`img/${tile.img}`)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${drift})` }} />
              </div>
              <div style={{ fontFamily: display, fontWeight: 800, fontSize: 34, color: dark ? "white" : K.ink, marginTop: 12, textAlign: "center", lineHeight: 1 }}>{tile.label}</div>
              <div
                style={{
                  position: "absolute",
                  top: 20,
                  right: 22,
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  background: "#22C55E",
                  boxShadow: `0 0 0 ${6 + 5 * Math.sin(f / 5 + i)}px rgba(34,197,94,0.3)`,
                }}
              />
            </div>
          );
        })}
      </div>
      <Anime
        scene={scene}
        duration={duration}
        poses={[{ at: 0, src: "sari-hp" }]}
        height={880}
        style={{ right: -10, top: 520 }}
        from="right"
        delay={8}
        seed={1}
      />
    </Backdrop>
  );
};

/* ---------- s04: highway analogy ---------- */
const Road: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const legend = useIn(at(duration, 0.62), 12);
  return (
    <Backdrop theme={t}>
      <Kicker index={idx(scene)} text={scene.kicker} color={t.fg} />
      <div style={{ position: "absolute", top: 270, left: 70, right: 70 }}>
        <Reveal delay={2}>
          <div style={big(112, t.fg)}>{scene.lines[0]}</div>
        </Reveal>
        <Reveal delay={9}>
          <div style={italic(104, K.ink)}>{scene.lines[1]}</div>
        </Reveal>
      </div>
      <Scenery src="tol.png" duration={duration} delay={4} style={{ top: 690, left: 40, right: 40, height: 540 }} zoom={[1.06, 1.22]} pan={[-30, -10]} border={`5px solid ${K.ink}`} />
      <div
        style={{
          position: "absolute",
          top: 1262,
          left: 70,
          right: 70,
          display: "flex",
          gap: 20,
          justifyContent: "center",
          opacity: legend,
          transform: `translateY(${(1 - legend) * 40}px)`,
        }}
      >
        {[
          ["Mobil", "= data"],
          ["Jalan", "= kapasitas"],
        ].map(([a, b]) => (
          <div key={a} style={{ background: K.ink, color: "white", borderRadius: 26, padding: "16px 30px", display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontFamily: display, fontWeight: 800, fontSize: 48 }}>{a}</span>
            <span style={italic(48, K.sun)}>{b}</span>
          </div>
        ))}
      </div>
    </Backdrop>
  );
};

/* ---------- s05: capacity above the peak ---------- */
const Capacity: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const progress = interpolate(f, [0, 20], [0.6, 1], { extrapolateRight: "clamp" });
  const cap = interpolate(f, [at(duration, 0.4), at(duration, 0.62)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const spare = useIn(at(duration, 0.72), 11);
  return (
    <Backdrop theme={t}>
      <Kicker index={idx(scene)} text={scene.kicker} color={t.fg} />
      <Headline lines={scene.lines} t={t} sizes={[104, 118, 150]} top={260} />
      <div style={{ position: "absolute", top: 820, left: 60, width: 660, height: 500, background: "#F4F6FB", borderRadius: 34, border: `4px solid ${K.ink}` }}>
        <div style={{ position: "absolute", top: 34, left: 34 }}>
          <DayChart w={590} h={420} progress={progress} ink={t.fg} line={K.coral} fill="rgba(255,106,77,0.16)" peak={1} cap={cap} capColor={K.cobalt} ticks={false} />
        </div>
        <div style={{ position: "absolute", top: -34, left: 30, opacity: cap, ...big(40, "white"), background: K.cobalt, borderRadius: 16, padding: "8px 18px" }}>
          Kapasitas
        </div>
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 230,
            transform: `scale(${spare})`,
            background: K.sun,
            border: `3px solid ${K.ink}`,
            borderRadius: 16,
            padding: "6px 16px",
            ...big(34, K.ink),
          }}
        >
          + cadangan
        </div>
        <div style={{ position: "absolute", bottom: 20, right: 30, fontFamily: label, fontWeight: 700, fontSize: 30, color: K.coral }}>pemakaian</div>
      </div>
      <Tag text="*ILUSTRASI" color={t.fg} style={{ top: 1340, left: 70 }} />
      <Anime
        scene={scene}
        duration={duration}
        poses={[{ at: 0, src: "bayu-tunjuk" }]}
        height={760}
        style={{ right: -50, top: 640 }}
        flip
        from="right"
        delay={8}
        seed={2}
      />
    </Backdrop>
  );
};

/* ---------- s06: brand backbone ---------- */
const Backbone: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const nodes: string[] = scene.nodes;
  const num = useIn(4, 12);
  const hub = useIn(at(duration, 0.4), 12);
  const cx = 540;
  const hubY = 840;
  const nodeY = 1110;
  const xs = [200, 540, 880];
  return (
    <Backdrop theme={t}>
      <Kicker index={idx(scene)} text={scene.kicker} color={t.fg} />
      <div style={{ position: "absolute", top: 260, left: 70, right: 70, transform: `scale(${num})`, transformOrigin: "left center" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
          <span style={big(220, K.sun, { whiteSpace: "nowrap" })}>{scene.big}</span>
          <span style={italic(120, t.fg)}>{scene.unit}</span>
        </div>
        <div style={{ fontFamily: label, fontWeight: 700, fontSize: 40, letterSpacing: 2, color: t.accent, marginTop: 10 }}>{scene.note.toUpperCase()}</div>
      </div>
      <Scenery src="server.png" duration={duration} delay={2} radius={0} style={{ top: 600, left: 0, width: 1080, height: 800, opacity: 0.42, boxShadow: "none" }} zoom={[1.02, 1.12]}>
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(${t.bg} 0%, transparent 28%, transparent 70%, ${t.bg} 100%)` }} />
      </Scenery>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {xs.map((x, i) => {
          const s = Math.max(0, Math.min(1, (f - at(duration, 0.55 + i * 0.08)) / 12));
          const dashOff = -f * 4;
          return (
            <g key={i} opacity={s}>
              <path d={`M${cx} ${hubY} L${x} ${nodeY}`} stroke={K.cyan} strokeWidth={8} strokeOpacity={0.3} />
              <path d={`M${cx} ${hubY} L${x} ${nodeY}`} stroke={K.cyan} strokeWidth={8} strokeDasharray="20 30" strokeDashoffset={dashOff} />
            </g>
          );
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          top: hubY - 90,
          left: cx - 230,
          width: 460,
          height: 150,
          transform: `scale(${hub})`,
          background: "white",
          borderRadius: 30,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 0 60px rgba(59,213,245,0.45)",
        }}
      >
        <div style={big(60, K.ink)}>CONTOH FIBER</div>
        <div style={{ fontFamily: label, fontWeight: 700, fontSize: 28, color: K.cobalt, letterSpacing: 2 }}>AS64512</div>
      </div>
      {nodes.map((n, i) => {
        const s = useIn(at(duration, 0.58 + i * 0.08), 11, 170);
        return (
          <div
            key={n}
            style={{
              position: "absolute",
              top: nodeY - 10,
              left: xs[i] - 150,
              width: 300,
              textAlign: "center",
              transform: `scale(${s})`,
            }}
          >
            <div style={{ background: K.sun, color: K.ink, borderRadius: 24, padding: "18px 0", ...big(56, K.ink) }}>{n}</div>
            <div style={{ fontFamily: label, fontWeight: 700, fontSize: 32, color: t.fg, marginTop: 10 }}>10 Gbps</div>
          </div>
        );
      })}
      <div style={{ position: "absolute", top: 1290, left: 0, right: 0, textAlign: "center", ...italic(46, t.fg), opacity: useIn(at(duration, 0.8)) * 0.85 }}>
        titik pertukaran internet di Jakarta
      </div>
    </Backdrop>
  );
};

/* ---------- s07: monitored 24/7 ---------- */
const Monitor: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const panel = useIn(at(duration, 0.2), 13);
  const alert = useIn(at(duration, 0.55), 10, 180);
  return (
    <Backdrop theme={t}>
      <Kicker index={idx(scene)} text={scene.kicker} color={t.fg} />
      <Headline lines={scene.lines} t={t} sizes={[120, 120, 150]} top={260} />
      <div
        style={{
          position: "absolute",
          top: 820,
          left: 60,
          width: 600,
          padding: 30,
          background: K.night,
          borderRadius: 34,
          transform: `translateY(${(1 - panel) * 120}px)`,
          opacity: panel,
          boxShadow: "0 18px 0 rgba(14,26,58,0.35)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: label, fontWeight: 700, fontSize: 28, color: K.cyan, letterSpacing: 3 }}>
          <span>NMS</span>
          <span style={{ color: "#22C55E" }}>● LIVE</span>
        </div>
        <div style={{ marginTop: 14, height: 304, borderRadius: 20, overflow: "hidden" }}>
          <Img src={staticFile("img/noc.png")} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${interpolate(f, [0, duration], [1.05, 1.18])})` }} />
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 1200,
          left: 80,
          transform: `scale(${alert}) rotate(${-3 * alert}deg)`,
          background: K.coral,
          color: "white",
          borderRadius: 24,
          padding: "16px 28px",
          border: `4px solid ${K.ink}`,
          ...big(42, "white"),
        }}
      >
        Ada gangguan?
        <br />
        Tim langsung gerak
        <span style={{ opacity: f % 20 < 12 ? 1 : 0.3 }}> →</span>
      </div>
      <Anime
        scene={scene}
        duration={duration}
        poses={[{ at: 0, src: "sari-kerja" }]}
        height={860}
        style={{ right: -20, top: 520 }}
        from="right"
        delay={6}
        seed={3}
      />
    </Backdrop>
  );
};

/* ---------- s08: home Wi-Fi tip ---------- */
const HomeTip: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const plans: { name: string; speed: string; dev: string; hot?: boolean }[] = scene.plans;
  return (
    <Backdrop theme={t}>
      <Kicker index={idx(scene)} text={scene.kicker} color={t.fg} />
      <div style={{ position: "absolute", top: 260, left: 70, right: 70 }}>
        <Reveal delay={2}>
          <div style={big(112, t.fg)}>Wi-Fi rumah</div>
        </Reveal>
        <Reveal delay={9}>
          <div style={italic(120, K.sun)}>juga dibagi.</div>
        </Reveal>
      </div>
      <Scenery src="ruangkeluarga.png" duration={duration} delay={at(duration, 0.12)} style={{ top: 330, right: 50, width: 330, height: 220, rotate: "3deg" }} border="5px solid white" radius={24} />
      <div style={{ position: "absolute", top: 600, left: 60, width: 640, fontFamily: label, fontWeight: 700, fontSize: 26, letterSpacing: 3, color: t.fg, opacity: 0.75 }}>
        PAKET · KECEPATAN · PERANGKAT
      </div>
      <div style={{ position: "absolute", top: 650, left: 60, width: 640, display: "flex", flexDirection: "column", gap: 16 }}>
        {plans.map((p, i) => {
          const s = useIn(at(duration, 0.4 + i * 0.07), 13);
          return (
            <div
              key={p.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                padding: "20px 26px",
                borderRadius: 26,
                background: p.hot ? K.sun : "white",
                color: K.ink,
                border: p.hot ? `5px solid ${K.ink}` : "5px solid transparent",
                transform: `translateX(${(1 - s) * -700}px) scale(${p.hot ? 1.04 : 1})`,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={big(46, K.ink)}>{p.name}</div>
                {p.hot && <div style={{ fontFamily: label, fontWeight: 700, fontSize: 22, letterSpacing: 2, color: K.coral }}>PALING POPULER</div>}
              </div>
              <div style={{ ...big(54, K.cobalt), width: 170, textAlign: "right" }}>
                {p.speed}
                <span style={{ fontSize: 26 }}> Mbps</span>
              </div>
              <div style={{ ...big(40, K.ink), width: 140, textAlign: "right" }}>
                {p.dev}
                <span style={{ fontFamily: label, fontSize: 22 }}> prkt</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", top: 1290, left: 60, fontFamily: label, fontWeight: 700, fontSize: 26, color: t.fg, opacity: 0.8 }}>
        Unlimited tanpa FUP · gratis biaya pasang
      </div>
      <Anime
        scene={scene}
        duration={duration}
        poses={[
          { at: 0, src: "bayu-hp-half" },
          { at: 0.5, src: "bayu-jempol-half" },
        ]}
        height={620}
        style={{ right: -110, top: 790 }}
        from="right"
        delay={6}
        seed={4}
        disc="rgba(255,210,63,0.9)"
      />
    </Backdrop>
  );
};

/* ---------- s09: CTA ---------- */
const Cta: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const chips: string[] = scene.chips;
  const pulse = 1 + Math.max(0, Math.sin(f / 6)) * 0.05;
  return (
    <Backdrop theme={t}>
      <Marquee text="TIPS INTERNET · CONTOH FIBER" theme={t} top={1610} rotate={-4} size={40} />
      <div style={{ position: "absolute", top: 180, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <LogoCard width={400} />
      </div>
      <Headline lines={scene.lines} t={t} sizes={[130, 110, 110]} top={410} align="center" />
      <div style={{ position: "absolute", top: 810, left: 60, right: 60, display: "flex", justifyContent: "center", gap: 16 }}>
        {chips.map((c, i) => (
          <Chip key={c} bg={i === 0 ? t.accent : t.fg} fg={t.bg} delay={at(duration, 0.15 + i * 0.1)} style={i === 0 ? { transform: `scale(${pulse})` } : undefined}>
            {c}
          </Chip>
        ))}
      </div>
      <div style={{ position: "absolute", top: 910, left: 60, right: 60, textAlign: "center", fontFamily: label, fontWeight: 700, fontSize: 38, color: t.fg, opacity: useIn(at(duration, 0.4)) }}>
        {scene.wa}
      </div>
      <Anime scene={scene} duration={duration} poses={[{ at: 0, src: "bayu-lambai" }]} height={460} style={{ left: 170, top: 970 }} from="left" delay={4} seed={5} />
      <Anime scene={scene} duration={duration} poses={[{ at: 0, src: "sari-jempol" }]} height={460} style={{ right: 190, top: 970 }} from="right" delay={10} seed={6} />
    </Backdrop>
  );
};

export const SCENES: Record<string, React.FC<P>> = {
  clockHook: ClockHook,
  dayCurve: DayCurve,
  whoOnline: WhoOnline,
  road: Road,
  capacity: Capacity,
  backbone: Backbone,
  monitor: Monitor,
  homeTip: HomeTip,
  cta: Cta,
};
