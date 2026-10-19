import { Img, interpolate, staticFile, Easing } from "remotion";
import { useCurrentFrame } from "./components/Time";
import { accentItalic, display, serif, label, K, THEMES, Theme } from "./design";
import { Backdrop, Chip, Kicker, Marquee, Outline, Reveal, useIn } from "./components/Kinetic";
import { Sfx, SfxTrain } from "./components/Sfx";
import { Character, useTalk } from "./components/Character";
import { PROPS } from "./components/Props";

export type Scene = {
  id: string;
  kind: string;
  theme: string;
  onscreen: string[];
  vo: string;
  image?: string;
  places?: { name: string; note: string }[];
  nodes?: string[];
  origin?: string; // backbone: label of the home node
  apps?: { name: string; desc: string; prop: string }[];
  stats?: { value: number; suffix: string; label: string; decimals?: number }[];
  chips?: string[];
  cta?: { url: string; wa: string };
};

type P = { scene: Scene; duration: number };
const themeOf = (s: Scene): Theme => THEMES[s.theme] ?? THEMES.cream;
const idx = (s: Scene) => s.id.replace("s", "");

const big = (size: number, color: string, extra?: React.CSSProperties): React.CSSProperties => ({
  fontFamily: display,
  fontWeight: 800,
  fontSize: size,
  lineHeight: 0.92,
  letterSpacing: -size * 0.035,
  color,
  ...extra,
});
const italic = (size: number, color: string): React.CSSProperties => ({
  fontFamily: serif,
  fontStyle: accentItalic ? "italic" : "normal",
  fontWeight: 400,
  fontSize: size,
  lineHeight: 1,
  color,
});

const LogoCard: React.FC<{ width: number; delay?: number; style?: React.CSSProperties }> = ({ width, delay = 0, style }) => {
  const s = useIn(delay, 12);
  return (
    <div
      style={{
        background: "white",
        borderRadius: 28,
        padding: "18px 34px",
        boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
        transform: `scale(${s}) rotate(${interpolate(s, [0, 1], [-6, -2])}deg)`,
        ...style,
      }}
    >
      <Img src={staticFile("img/logo.webp")} style={{ width, display: "block" }} />
    </div>
  );
};

const hop = (s: number, from: number) => ({
  transform: `translateX(${interpolate(s, [0, 1], [from, 0])}px) translateY(${-Math.sin(Math.min(1, s) * Math.PI) * 50}px)`,
  opacity: Math.min(1, s * 2),
});

/* ---------- s01: hook (cream) ---------- */
export const Hook: React.FC<P> = ({ scene }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const dika = useIn(10, 14);
  const q = useIn(24, 9);
  return (
    <Backdrop theme={t}>
      <Outline text="WWW · WWW · WWW" color={t.soft.replace("0.08", "0.14")} top={1180} size={260} />
      <Kicker index={idx(scene)} text="TANYA DULU" color={t.fg} />
      <div style={{ position: "absolute", top: 290, left: 70, right: 70 }}>
        <Reveal delay={2}>
          <div style={big(150, t.fg)}>{scene.onscreen[0]}</div>
        </Reveal>
        <Reveal delay={9}>
          <div style={italic(150, t.fg)}>{scene.onscreen[1]}</div>
        </Reveal>
        <Reveal delay={16}>
          <div style={big(190, t.accent)}>{scene.onscreen[2]}</div>
        </Reveal>
      </div>
      <div style={{ position: "absolute", left: 560, top: 760, ...hop(dika, 500) }}>
        <Character who="user" mood="curious" pose="phone" width={400} flip />
      </div>
      <div
        style={{
          position: "absolute",
          left: 880,
          top: 600,
          ...big(200, K.cobalt),
          transform: `scale(${q}) rotate(${-12 + Math.sin(f / 8) * 6}deg) translateY(${Math.sin(f / 10) * 10}px)`,
        }}
      >
        ?
      </div>
    </Backdrop>
  );
};

/* ---------- s02: intro (cobalt) ---------- */
export const Intro: React.FC<P> = ({ scene }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const talk = useTalk(scene.id);
  const slideL = interpolate(f, [0, 16], [-900, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const slideR = interpolate(f, [4, 20], [900, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const tech = useIn(16, 13);
  const cs = useIn(24, 13);
  return (
    <Backdrop theme={t}>
      <Kicker index={idx(scene)} text="KENALIN" color={t.fg} />
      <div style={{ position: "absolute", top: 270, left: 60, ...big(200, t.fg), transform: `translateX(${slideL}px)` }}>{scene.onscreen[0]}</div>
      <div style={{ position: "absolute", top: 450, right: 60, ...big(200, t.accent), transform: `translateX(${slideR}px)` }}>{scene.onscreen[1]}</div>
      <div style={{ position: "absolute", top: 650, left: 70, display: "flex", alignItems: "center", gap: 24 }}>
        <Reveal delay={12}>
          <div style={italic(84, t.fg)}>{scene.onscreen[2]}</div>
        </Reveal>
        <LogoCard width={420} delay={16} />
      </div>
      <div style={{ position: "absolute", left: 40, top: 800, ...hop(tech, -500) }}>
        <Character who="tech" mood="happy" pose="wave" talk={talk} width={380} />
      </div>
      <div style={{ position: "absolute", right: 40, top: 810, ...hop(cs, 500) }}>
        <Character who="cs" mood="happy" pose="wave" width={370} flip seed={3} />
      </div>
    </Backdrop>
  );
};

/* ---------- s03: coverage (sun) ---------- */
const Pin: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg width={size} height={size * 1.3} viewBox="0 0 40 52">
    <path d="M20 0 C9 0 0 9 0 20 C0 34 20 52 20 52 C20 52 40 34 40 20 C40 9 31 0 20 0 Z" fill={color} />
    <circle cx={20} cy={20} r={8} fill="white" />
  </svg>
);

export const Coverage: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const photo = useIn(Math.round(duration * 0.55), 14);
  return (
    <Backdrop theme={t}>
      <Kicker index={idx(scene)} text={scene.onscreen[0].toUpperCase()} color={t.fg} />
      <div style={{ position: "absolute", top: 280, left: 0, right: 0 }}>
        {scene.places!.map((p, i) => {
          const start = Math.round(duration * [0.08, 0.22, 0.36][i]);
          const x = interpolate(f, [start, start + 16], [i % 2 ? 1200 : -1200, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          });
          return (
            <div
              key={p.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                padding: "0 60px",
                justifyContent: i % 2 ? "flex-end" : "flex-start",
                transform: `translateX(${x}px)`,
                marginBottom: 18,
              }}
            >
              {i % 2 === 0 && <Pin color={i === 0 ? K.cobalt : t.fg} size={70} />}
              <div>
                <div style={big(p.name.length > 6 ? 132 : 200, t.fg)}>{p.name}</div>
                <div style={{ ...italic(52, i === 0 ? K.cobalt : t.fg), textAlign: i % 2 ? "right" : "left" }}>— {p.note}</div>
              </div>
              {i % 2 === 1 && <Pin color={t.fg} size={70} />}
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 1070,
          width: 400,
          padding: "16px 16px 60px",
          background: "white",
          boxShadow: "0 24px 50px rgba(0,0,0,0.25)",
          transform: `rotate(${interpolate(photo, [0, 1], [-20, -6])}deg) scale(${photo})`,
        }}
      >
        <Img src={staticFile(scene.image!)} style={{ width: "100%", height: 230, objectFit: "cover", display: "block" }} />
        <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, textAlign: "center", ...italic(38, K.ink) }}>
          {scene.places?.[0] ? `${scene.places[0].note}, ${scene.places[0].name.charAt(0)}${scene.places[0].name.slice(1).toLowerCase()}` : ""}
        </div>
      </div>
      <Marquee text={`${(scene.places ?? []).map((p) => p.name).join(" · ")} · TERUS NAMBAH`} theme={{ ...t, accent: K.ink, bg: K.sun }} top={975} rotate={-4} speed={5} />
    </Backdrop>
  );
};

/* ---------- s04: backbone (night) ---------- */
export const Backbone: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const typed = scene.onscreen[0].slice(0, Math.max(0, Math.floor((f - 4) / 2)));
  const origin = { x: 200, y: 1080 };
  const ix = [
    { x: 820, y: 640 },
    { x: 860, y: 900 },
    { x: 820, y: 1160 },
  ];
  return (
    <Backdrop theme={t}>
      <SfxTrain count={(x) => Math.max(0, Math.floor((x - 4) / 2))} from={4} to={4 + 2 * scene.onscreen[0].length} text={scene.onscreen[0]} />
      {[0, 1, 2].map((i) => (
        <Sfx key={i} s="swipe" at={Math.round(duration * (0.35 + i * 0.1))} volume={0.7} />
      ))}
      <Outline text="10G 10G 10G 10G" color="rgba(59,213,245,0.12)" top={1180} size={240} drift={2} />
      <Kicker index={idx(scene)} text="JARINGAN SENDIRI" color={K.cyan} />
      <div style={{ position: "absolute", top: 280, left: 70, ...big(176, t.fg, { fontFamily: label, letterSpacing: -4 }) }}>
        {typed}
        <span style={{ color: K.cyan, opacity: Math.floor(f / 8) % 2 ? 0 : 1 }}>▌</span>
      </div>
      <div style={{ position: "absolute", top: 470, left: 74, ...italic(56, K.cyan) }}>nomor jaringan kami di internet</div>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {ix.map((n, i) => {
          const start = Math.round(duration * (0.35 + i * 0.1));
          const draw = interpolate(f, [start, start + 18], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const d = `M${origin.x} ${origin.y} C ${origin.x + 300} ${origin.y}, ${n.x - 320} ${n.y}, ${n.x - 120} ${n.y}`;
          return (
            <g key={i}>
              <path d={d} stroke="rgba(59,213,245,0.35)" strokeWidth={6} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={draw} />
              {draw === 0 &&
                [0, 1, 2].map((k) => (
                  <path
                    key={k}
                    d={d}
                    stroke={K.cyan}
                    strokeWidth={10}
                    strokeLinecap="round"
                    fill="none"
                    pathLength={1}
                    strokeDasharray="0.05 0.95"
                    strokeDashoffset={-(((f / 30 + k / 3 + i * 0.2) % 1))}
                  />
                ))}
            </g>
          );
        })}
        <circle cx={origin.x} cy={origin.y} r={70} fill={K.cobalt} />
        <circle cx={origin.x} cy={origin.y} r={70 + (f % 30) * 2} fill="none" stroke={K.cobalt} strokeWidth={4} opacity={1 - (f % 30) / 30} />
        <text x={origin.x} y={origin.y + 14} textAnchor="middle" fontFamily={display} fontWeight={800} fontSize={40} fill="white">
          {scene.origin ?? "PUSAT"}
        </text>
      </svg>
      {scene.nodes!.map((name, i) => {
        const s = useIn(Math.round(duration * (0.38 + i * 0.1)), 12);
        return (
          <div
            key={name}
            style={{
              position: "absolute",
              left: ix[i].x - 130,
              top: ix[i].y - 70,
              width: 300,
              padding: "18px 22px",
              borderRadius: 22,
              background: "rgba(255,255,255,0.06)",
              border: `3px solid ${K.cyan}`,
              transform: `scale(${s})`,
              fontFamily: display,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 38, color: t.fg }}>{name}</div>
            <div style={{ fontFamily: label, fontWeight: 700, fontSize: 30, color: K.cyan }}>10 Gbps</div>
          </div>
        );
      })}
    </Backdrop>
  );
};

/* ---------- s05: ecosystem (white) ---------- */
export const Ecosystem: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const tiles = [K.cobalt, K.sun, K.coral, K.ink, K.mint, K.cyan];
  const fgs = [K.white, K.ink, K.white, K.white, K.ink, K.ink];
  return (
    <Backdrop theme={t}>
      {scene.apps!.map((a, i) => (
        <Sfx key={a.name} s="pop" at={Math.round(duration * 0.12) + i * 7 + 1} />
      ))}
      <Kicker index={idx(scene)} text="EKOSISTEM DIGITAL" color={t.fg} />
      <div style={{ position: "absolute", top: 260, left: 70, right: 70 }}>
        <Reveal delay={2}>
          <span style={big(120, t.fg)}>{scene.onscreen[0]} </span>
        </Reveal>
        <Reveal delay={8}>
          <span style={italic(130, K.cobalt)}>{scene.onscreen[1]}.</span>
        </Reveal>
      </div>
      <div style={{ position: "absolute", top: 560, left: 60, right: 60, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {scene.apps!.map((a, i) => {
          const s = useIn(Math.round(duration * 0.12) + i * 7, 13);
          return (
            <div
              key={a.name}
              style={{
                height: 262,
                borderRadius: 34,
                background: tiles[i],
                color: fgs[i],
                padding: "26px 28px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                transform: `translateY(${interpolate(s, [0, 1], [120, 0])}px) scale(${interpolate(s, [0, 1], [0.8, 1])})`,
                opacity: s,
              }}
            >
              <div style={{ width: 110, height: 110 }}>
                {(() => {
                  const Art = PROPS[a.prop];
                  return Art ? <Art size={110} /> : null;
                })()}
              </div>
              <div>
                <div style={{ fontFamily: display, fontWeight: 800, fontSize: a.name.length > 12 ? 40 : 50, lineHeight: 1 }}>{a.name}</div>
                <div style={{ fontFamily: label, fontWeight: 500, fontSize: 26, opacity: 0.8, marginTop: 6 }}>{a.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Backdrop>
  );
};

/* ---------- s06: team (coral) ---------- */
export const Team: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const talk = useTalk(scene.id);
  const second = Math.round(duration * 0.42);
  const w1 = useIn(2, 12);
  const w2 = useIn(second, 12);
  return (
    <Backdrop theme={t}>
      <Kicker index={idx(scene)} text="TIM KAMI" color={t.fg} />
      <Marquee text="SURVEI CEPAT · PASANG 1–3 HARI · CS 24 JAM" theme={{ ...t, accent: K.ink, bg: K.coral }} top={735} rotate={3} speed={5} size={40} />
      <div style={{ position: "absolute", top: 270, left: 60, ...big(250, t.fg), opacity: Math.min(1, w1 * 1.6), transform: `translateX(${(1 - w1) * -160}px)` }}>
        {scene.onscreen[0]}
      </div>
      <div style={{ position: "absolute", top: 500, right: 60, ...big(250, K.ink), opacity: Math.min(1, w2 * 1.6), transform: `translateX(${(1 - w2) * 160}px)` }}>
        {scene.onscreen[1]}
      </div>
      <div style={{ position: "absolute", top: 830, left: 50 }}>
        <Character who="tech" mood="excited" pose="thumbs" talk={f < second ? talk : 0} width={340} />
      </div>
      <div style={{ position: "absolute", top: 840, right: 50 }}>
        <Character who="cs" mood="happy" pose="headset" talk={f >= second ? talk : 0} width={330} flip seed={2} />
      </div>
    </Backdrop>
  );
};

/* ---------- s07: stats (cream) ---------- */
export const Stats: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  return (
    <Backdrop theme={t}>
      <Kicker index={idx(scene)} text="BUKTI" color={t.fg} />
      <Reveal delay={0} style={{ position: "absolute", top: 260, left: 70 }}>
        <div style={italic(130, t.fg)}>{scene.onscreen[0]}</div>
      </Reveal>
      {scene.stats!.map((st, i) => {
        const start = Math.round(duration * [0.15, 0.5][i]);
        const v = interpolate(f, [start, start + 30], [0, st.value], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        const s = useIn(start, 14);
        return (
          <div key={st.label} style={{ position: "absolute", top: 470 + i * 430, left: 60, right: 60, opacity: s }}>
            <SfxTrain s="tick" from={start} to={start + 30} count={(x) => Math.round(interpolate(x, [start, start + 30], [0, st.value], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }) * 10 ** (st.decimals ?? 0))} />
            <div style={big(290, i ? K.cobalt : t.fg)}>
              {v.toFixed(st.decimals ?? 0).replace(".", ",")}
              <span style={{ color: t.accent }}>{st.suffix}</span>
            </div>
            <div style={{ height: 14, background: i ? K.cobalt : t.accent, width: `${s * 100}%`, borderRadius: 7, margin: "10px 0 14px" }} />
            <div style={{ fontFamily: label, fontWeight: 700, fontSize: 46, color: t.fg, letterSpacing: 2 }}>{st.label.toUpperCase()}</div>
          </div>
        );
      })}
    </Backdrop>
  );
};

/* ---------- s08: offer (mint) ---------- */
export const Offer: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const price = useIn(6, 10);
  return (
    <Backdrop theme={t}>
      <Sfx s="thud" at={10} />
      {scene.chips!.map((c, i) => (
        <Sfx key={c} s="pop" at={Math.round(duration * (0.3 + i * 0.13)) + 1} />
      ))}
      <Kicker index={idx(scene)} text="PAKET INTERNET" color={t.fg} />
      <div style={{ position: "absolute", top: 250, left: 70 }}>
        <Reveal delay={0}>
          <div style={italic(110, t.fg)}>{scene.onscreen[0]}</div>
        </Reveal>
        <div style={{ ...big(330, t.fg), opacity: Math.min(1, price * 1.6), transform: `translateY(${(1 - price) * 50}px) scale(${0.8 + 0.2 * price})`, transformOrigin: "left bottom" }}>
          {scene.onscreen[1]}
        </div>
        <div style={{ fontFamily: label, fontWeight: 700, fontSize: 54, color: K.cobalt }}>{scene.onscreen[2]}</div>
      </div>
      <div style={{ position: "absolute", top: 830, left: 60, width: 600, display: "flex", flexWrap: "wrap", gap: 16 }}>
        {scene.chips!.map((c, i) => (
          <Chip key={c} bg={[K.ink, K.cobalt, K.white, K.sun][i]} fg={[K.white, K.white, K.ink, K.ink][i]} delay={Math.round(duration * (0.3 + i * 0.13))}>
            ✓ {c}
          </Chip>
        ))}
      </div>
      <div style={{ position: "absolute", right: 30, top: 820, transform: `translateY(${Math.abs(Math.sin(f / 8)) * -20}px)` }}>
        <Character who="user" mood="excited" pose="cheer" width={360} flip seed={5} />
      </div>
    </Backdrop>
  );
};

/* ---------- s09: CTA (cobalt) ---------- */
export const Cta: React.FC<P> = ({ scene }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const talk = useTalk(scene.id);
  const btn = useIn(20, 12);
  const pulse = 1 + Math.max(0, Math.sin(f / 6)) * 0.04;
  return (
    <Backdrop theme={t}>
      <div style={{ position: "absolute", top: 190, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <LogoCard width={460} />
      </div>
      <div style={{ position: "absolute", top: 412, left: 70, right: 70, textAlign: "center" }}>
        <Reveal delay={6}>
          <div style={big(120, t.fg)}>{scene.onscreen[0]}</div>
        </Reveal>
        <Reveal delay={12}>
          <div style={italic(150, t.accent)}>{scene.onscreen[1]}</div>
        </Reveal>
      </div>
      <div style={{ position: "absolute", top: 680, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 0 }}>
        <Character who="cs" mood="happy" pose="wave" width={250} seed={1} />
        <Character who="tech" mood="excited" pose="thumbs" talk={talk} width={270} />
        <Character who="user" mood="excited" pose="cheer" width={250} flip seed={4} />
      </div>
      <div style={{ position: "absolute", top: 1175, left: 60, right: 60, display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            textAlign: "center",
            padding: "24px 0",
            borderRadius: 999,
            background: K.sun,
            color: K.ink,
            fontFamily: display,
            fontWeight: 800,
            fontSize: 46,
            transform: `scale(${btn * pulse})`,
          }}
        >
          {scene.cta!.url} →
        </div>
        <div
          style={{
            textAlign: "center",
            padding: "20px 0",
            borderRadius: 999,
            border: `4px solid ${t.fg}`,
            color: t.fg,
            fontFamily: label,
            fontWeight: 700,
            fontSize: 42,
            opacity: useIn(30),
          }}
        >
          WhatsApp {scene.cta!.wa}
        </div>
      </div>
    </Backdrop>
  );
};

export const SCENES: Record<string, React.FC<P>> = {
  hook: Hook,
  intro: Intro,
  coverage: Coverage,
  backbone: Backbone,
  ecosystem: Ecosystem,
  team: Team,
  stats: Stats,
  offer: Offer,
  cta: Cta,
};
