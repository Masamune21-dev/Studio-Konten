import { interpolate, Easing } from "remotion";
import { useCurrentFrame } from "./components/Time";
import { display, label, K } from "./design";
import { Backdrop, Kicker, Reveal, useIn } from "./components/Kinetic";
import { Sfx, SfxTrain } from "./components/Sfx";
import { Character, useTalk } from "./components/Character";
import { AlarmPill, CutCable, House, Modem, OdpBox, OltRack, PROPS } from "./components/Props";
import { Cabinet, EXTRA_PROPS, FloorPlan, PowerMeter, Splicer } from "./components/PropsExtra";
import { at, big, Headline, idx, italic, P, Talker, themeOf } from "./components/Type";

// Scenes for Wi-Fi tips and field-story videos.
const ART: Record<string, React.FC<{ size: number }>> = { ...PROPS, ...EXTRA_PROPS };

/* ---------- Wi-Fi tips ---------- */

export const CabinetHook: React.FC<P> = ({ scene }) => {
  const t = themeOf(scene);
  const c = useIn(10, 13);
  return (
    <Backdrop theme={t}>
      <Kicker index={idx(scene)} text={scene.kicker} color={t.fg} />
      <Headline lines={scene.lines} t={t} />
      <div style={{ position: "absolute", left: 560, top: 760, transform: `scale(${c}) rotate(${interpolate(c, [0, 1], [10, 0])}deg)` }}>
        <Cabinet size={440} />
      </div>
      <div style={{ position: "absolute", left: 50, top: 820 }}>
        <Character who="user" mood="sad" pose="phone" width={360} />
      </div>
    </Backdrop>
  );
};

// MITOS (struck through) vs FAKTA, with an illustration underneath.
export const MythFact: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const myth = useIn(2, 14);
  const strikeAt = at(duration, 0.3);
  const strike = interpolate(f, [strikeAt, strikeAt + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const fact = useIn(strikeAt + 8, 13);
  const art = useIn(strikeAt + 14, 13);
  const dark = t.bg === K.night || t.bg === K.cobalt || t.bg === K.coral;
  const Art = ART[scene.art];
  return (
    <Backdrop theme={t}>
      <Sfx s="scribble" at={strikeAt} />
      <Sfx s="swipe" at={strikeAt + 8} />
      <Kicker index={idx(scene)} text={scene.kicker} color={t.fg} />
      <div style={{ position: "absolute", top: 270, left: 60, right: 60, opacity: myth, transform: `translateY(${interpolate(myth, [0, 1], [60, 0])}px)` }}>
        <div style={{ display: "inline-block", padding: "8px 22px", borderRadius: 999, background: dark ? "rgba(255,255,255,0.16)" : K.ink, color: K.white, fontFamily: label, fontWeight: 700, fontSize: 30, letterSpacing: 4 }}>
          ✗ MITOS
        </div>
        <div style={{ marginTop: 18 }}>
          {/* text-decoration strikes every wrapped line, unlike an overlay bar */}
          <span
            style={{
              ...big(78, t.fg),
              opacity: interpolate(strike, [0, 1], [1, 0.6]),
              textDecorationLine: "line-through",
              textDecorationThickness: 12,
              textDecorationColor: `rgba(${t.bg === K.coral ? "14,26,58" : "255,106,77"}, ${strike})`,
            }}
          >
            {scene.myth}
          </span>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 640,
          left: 60,
          right: 60,
          padding: "28px 34px",
          borderRadius: 34,
          background: K.white,
          boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
          opacity: fact,
          transform: `translateY(${interpolate(fact, [0, 1], [120, 0])}px) rotate(${interpolate(fact, [0, 1], [3, -1])}deg)`,
        }}
      >
        <div style={{ display: "inline-block", padding: "8px 22px", borderRadius: 999, background: K.mint, color: K.ink, fontFamily: label, fontWeight: 700, fontSize: 30, letterSpacing: 4 }}>✓ FAKTA</div>
        <div style={{ ...italic(66, K.ink, { lineHeight: 1.05, marginTop: 14 }) }}>{scene.fact}</div>
      </div>
      <div style={{ position: "absolute", top: 1020, left: 60, right: scene.character ? 380 : 60, display: "flex", justifyContent: scene.character ? "flex-start" : "center", gap: 30, opacity: art, transform: `scale(${interpolate(art, [0, 1], [0.8, 1])})` }}>
        {scene.art === "floor-compare" ? (
          <>
            <div style={{ textAlign: "center" }}>
              <FloorPlan size={300} good={false} />
              <div style={{ fontFamily: label, fontWeight: 700, fontSize: 30, color: t.fg, marginTop: 6 }}>✗ di pojok, ketutup</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <FloorPlan size={300} good />
              <div style={{ fontFamily: label, fontWeight: 700, fontSize: 30, color: t.fg, marginTop: 6 }}>✓ di tengah, terbuka</div>
            </div>
          </>
        ) : scene.art === "modem" ? (
          <Modem width={520} lights={[{ name: "POWER", state: "on" }, { name: "PON", state: "on" }, { name: "LOS", state: "off" }, { name: "LAN", state: "blink" }]} />
        ) : Art ? (
          <Art size={340} />
        ) : null}
      </div>
      <Talker spec={scene.character} scene={scene} width={290} style={{ right: 40, top: 960 }} flip seed={2} />
    </Backdrop>
  );
};

// 2.4 GHz vs 5 GHz: wide/weak vs short/strong waves against a wall.
export const Bands: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const bands: { name: string; points: string[] }[] = scene.bands;
  return (
    <Backdrop theme={t}>
      <Kicker index={idx(scene)} text={scene.kicker} color={t.fg} />
      {bands.map((b, i) => {
        const s = useIn(at(duration, i === 0 ? 0.05 : 0.45), 13);
        const wide = i === 0;
        const color = wide ? K.cobalt : K.coral;
        return (
          <div
            key={b.name}
            style={{
              position: "absolute",
              left: 50,
              right: 50,
              top: 260 + i * 560,
              height: 520,
              borderRadius: 40,
              background: wide ? "#EEF2FF" : "#FFF1EC",
              padding: "34px 40px",
              opacity: s,
              transform: `translateX(${interpolate(s, [0, 1], [wide ? -600 : 600, 0])}px)`,
              overflow: "hidden",
            }}
          >
            <div style={big(130, color)}>{b.name}</div>
            <div style={{ marginTop: 18 }}>
              {b.points.map((pt) => (
                <div key={pt} style={{ fontFamily: display, fontWeight: 700, fontSize: 44, color: K.ink, lineHeight: 1.35 }}>
                  {pt}
                </div>
              ))}
            </div>
            <svg width={420} height={460} viewBox="0 0 420 460" style={{ position: "absolute", right: 0, top: 30 }}>
              <rect x={wide ? 300 : 230} y={40} width={22} height={380} rx={6} fill="#94A3B8" />
              {Array.from({ length: wide ? 6 : 4 }).map((_, k) => {
                const r = ((f * (wide ? 2.2 : 3) + k * (wide ? 60 : 45)) % (wide ? 360 : 180)) + 20;
                const pastWall = r > (wide ? 280 : 210);
                return (
                  <circle
                    key={k}
                    cx={40}
                    cy={230}
                    r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth={wide ? 5 : 12}
                    opacity={(pastWall ? (wide ? 0.35 : 0) : wide ? 0.6 : 0.9) * (1 - r / (wide ? 380 : 200))}
                  />
                );
              })}
              <rect x={20} y={214} width={44} height={32} rx={8} fill={K.ink} />
            </svg>
          </div>
        );
      })}
    </Backdrop>
  );
};

// Devices join and the bandwidth bar splits between them; plan guide below.
export const Devices: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const devices: string[] = scene.devices;
  const plans: { speed: string; for: string; popular?: boolean }[] = scene.plans;
  const shown = devices.filter((_, i) => f >= at(duration, 0.08 + i * 0.1)).length;
  const segColors = [K.sun, K.mint, K.coral, K.cyan];
  return (
    <Backdrop theme={t}>
      <Kicker index={idx(scene)} text={scene.kicker} color={t.fg} />
      <div style={{ position: "absolute", top: 260, left: 70 }}>
        <Reveal delay={2}>
          <span style={big(120, t.fg)}>{scene.lines[0]} </span>
        </Reveal>
        <Reveal delay={8}>
          <span style={italic(120, K.sun)}>{scene.lines[1]}</span>
        </Reveal>
      </div>
      <div style={{ position: "absolute", top: 560, left: 60, right: 60, height: 54, borderRadius: 27, background: "rgba(255,255,255,0.15)", display: "flex", overflow: "hidden" }}>
        {Array.from({ length: Math.max(1, shown) }).map((_, i) => (
          <div key={i} style={{ flex: 1, background: shown ? segColors[i % 4] : "rgba(255,255,255,0.3)", borderRight: "4px solid " + K.cobalt }} />
        ))}
      </div>
      <div style={{ position: "absolute", top: 630, left: 60, right: 60, display: "flex", justifyContent: "space-between" }}>
        {devices.map((d, i) => {
          const s = useIn(at(duration, 0.08 + i * 0.1), 12);
          const Art = ART[d];
          return (
            <div key={i} style={{ transform: `scale(${s}) translateY(${interpolate(s, [0, 1], [80, 0])}px)`, opacity: s }}>
              {Art ? <Art size={210} /> : null}
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", top: 880, left: 60, right: 60 }}>
        {plans.map((p, i) => {
          const s = useIn(at(duration, 0.5 + i * 0.07), 14);
          return (
            <div
              key={p.speed}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                height: 110,
                padding: "0 34px",
                marginBottom: 14,
                borderRadius: 26,
                background: p.popular ? K.sun : "rgba(255,255,255,0.12)",
                color: p.popular ? K.ink : K.white,
                opacity: s,
                transform: `translateX(${interpolate(s, [0, 1], [-200, 0])}px)`,
              }}
            >
              <div style={{ fontFamily: display, fontWeight: 800, fontSize: 60 }}>{p.speed}</div>
              <div style={{ fontFamily: label, fontWeight: 700, fontSize: 38 }}>{p.for}</div>
            </div>
          );
        })}
      </div>
    </Backdrop>
  );
};

/* ---------- field story ---------- */

const Crescent: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <path d="M70 12 A40 40 0 1 0 88 72 A32 32 0 1 1 70 12 Z" fill={K.sun} />
  </svg>
);

export const ClockHook: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const notifAt = at(duration, 0.55);
  const notif = useIn(notifAt, 12);
  const buzz = f > notifAt && f < notifAt + 20 ? Math.sin(f * 2.5) * 8 : 0;
  const [hh, mm] = String(scene.time).split(":");
  return (
    <Backdrop theme={t}>
      <Sfx s="buzz" at={notifAt} />
      <Sfx s="notif" at={notifAt + 2} />
      {Array.from({ length: 18 }).map((_, i) => (
        <div key={i} style={{ position: "absolute", left: (i * 211) % 1040, top: 140 + ((i * 137) % 600), width: 6, height: 6, borderRadius: 3, background: "white", opacity: 0.3 + 0.5 * Math.abs(Math.sin(f / 20 + i)) }} />
      ))}
      <div style={{ position: "absolute", right: 80, top: 230 }}>
        <Crescent size={160} />
      </div>
      <Kicker index={idx(scene)} text={scene.kicker} color={K.cyan} />
      <div style={{ position: "absolute", top: 380, left: 60, fontFamily: label, fontWeight: 700, fontSize: 290, letterSpacing: -10, color: t.fg, lineHeight: 1 }}>
        {hh}
        <span style={{ opacity: Math.floor(f / 15) % 2 ? 0.2 : 1 }}>:</span>
        {mm}
      </div>
      <Reveal delay={10} style={{ position: "absolute", top: 690, left: 70 }}>
        <div style={italic(72, K.cyan)}>{scene.line}</div>
      </Reveal>
      {/* phone with an incoming alert */}
      <div
        style={{
          position: "absolute",
          left: 220,
          top: 860,
          width: 640,
          height: 470,
          borderRadius: "56px 56px 0 0",
          background: "#111827",
          padding: "26px 26px 0",
          transform: `translateX(${buzz}px)`,
        }}
      >
        <div style={{ height: "100%", borderRadius: "36px 36px 0 0", background: "linear-gradient(#1E293B, #0F172A)", padding: 24 }}>
          <div style={{ fontFamily: label, fontWeight: 700, fontSize: 30, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
            {scene.time}
          </div>
          <div
            style={{
              marginTop: 30,
              borderRadius: 28,
              background: "rgba(255,255,255,0.95)",
              padding: "22px 24px",
              opacity: notif,
              transform: `translateY(${interpolate(notif, [0, 1], [-120, 0])}px)`,
            }}
          >
            <AlarmPill />
            <div style={{ fontFamily: display, fontWeight: 800, fontSize: 44, color: K.ink, marginTop: 12 }}>{scene.alert.title}</div>
            <div style={{ fontFamily: label, fontWeight: 500, fontSize: 30, color: "#475569" }}>{scene.alert.body}</div>
          </div>
          <div style={{ fontFamily: label, fontSize: 20, color: "rgba(255,255,255,0.35)", marginTop: 14, textAlign: "right" }}>ilustrasi</div>
        </div>
      </div>
    </Backdrop>
  );
};

// NOC panel: ONU rows flip to LOS one by one; CS on duty watches.
export const NocAlert: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const talk = useTalk(scene.id);
  const rows = 6;
  const flipStart = at(duration, 0.15);
  const flipped = Math.min(rows, Math.max(0, Math.floor((f - flipStart) / 6)));
  const count = Math.round(interpolate(f, [flipStart, flipStart + 40], [0, Number(scene.count)], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return (
    <Backdrop theme={t}>
      <Sfx s="alarm" at={flipStart} />
      <Kicker index={idx(scene)} text={scene.kicker} color={t.fg} />
      <div style={{ position: "absolute", top: 250, left: 70, display: "flex", alignItems: "baseline", gap: 24 }}>
        <div style={big(250, K.coral)}>{count}</div>
        <div style={big(80, t.fg)}>{scene.unit}</div>
      </div>
      <Reveal delay={at(duration, 0.4)} style={{ position: "absolute", top: 500, left: 74 }}>
        <div style={italic(70, t.fg)}>{scene.note}</div>
      </Reveal>
      <div style={{ position: "absolute", top: 640, left: 50, right: 50, borderRadius: 34, background: K.night, padding: "26px 30px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: label, fontWeight: 700, fontSize: 26, color: "rgba(255,255,255,0.5)", letterSpacing: 2, marginBottom: 12 }}>
          <span>ONU · ODP-07</span>
          <span>STATUS</span>
        </div>
        {Array.from({ length: rows }).map((_, i) => {
          const los = i < flipped;
          return (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 64, borderTop: "2px solid rgba(255,255,255,0.08)" }}>
              <span style={{ fontFamily: label, fontWeight: 500, fontSize: 32, color: "white" }}>gpon-onu_1/1/7:{i + 1}</span>
              <span
                style={{
                  fontFamily: label,
                  fontWeight: 700,
                  fontSize: 28,
                  padding: "6px 18px",
                  borderRadius: 999,
                  background: los ? "#FEE2E2" : "#DCFCE7",
                  color: los ? "#B91C1C" : "#166534",
                }}
              >
                {los ? "LOS" : "online"}
              </span>
            </div>
          );
        })}
        <div style={{ fontFamily: label, fontSize: 20, color: "rgba(255,255,255,0.35)", marginTop: 8, textAlign: "right" }}>ilustrasi</div>
      </div>
      <div style={{ position: "absolute", left: 40, top: 1090 }}>
        <Character who="cs" mood="surprised" pose="headset" talk={talk} width={190} seed={3} />
      </div>
    </Backdrop>
  );
};

// Route from office to the fault, drawn as it is travelled.
export const Route: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const talk = useTalk(scene.id);
  const path = "M190 1180 C 300 1000, 520 1120, 600 940 S 760 720, 860 660";
  const prog = interpolate(f, [8, at(duration, 0.6)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const found = useIn(at(duration, 0.62), 11);
  return (
    <Backdrop theme={t}>
      <Kicker index={idx(scene)} text={scene.kicker} color={t.fg} />
      <Reveal delay={2} style={{ position: "absolute", top: 250, left: 70 }}>
        <div style={big(190, t.fg)}>{scene.title}</div>
      </Reveal>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <path d={path} stroke="rgba(14,26,58,0.15)" strokeWidth={34} fill="none" strokeLinecap="round" />
        <path d={path} stroke={K.ink} strokeWidth={10} fill="none" strokeDasharray="1 0" pathLength={1} strokeDashoffset={1 - prog} strokeLinecap="round" />
        <path d={path} stroke={K.white} strokeWidth={4} fill="none" strokeDasharray="0.02 0.02" pathLength={1} />
      </svg>
      <div style={{ position: "absolute", left: 90, top: 1120 }}>
        <OltRack size={150} />
        <div style={{ fontFamily: label, fontWeight: 700, fontSize: 28, color: t.fg, textAlign: "center" }}>KANTOR</div>
      </div>
      <div style={{ position: "absolute", left: 820, top: 520 }}>
        <OdpBox size={170} />
        <div style={{ fontFamily: label, fontWeight: 700, fontSize: 28, color: t.fg }}>ODP-07</div>
      </div>
      <div style={{ position: "absolute", left: 470, top: 660, transform: `scale(${found})` }}>
        <div style={{ background: K.white, borderRadius: 30, padding: 10, boxShadow: "0 16px 30px rgba(0,0,0,0.2)" }}>
          <CutCable size={200} />
        </div>
        <div style={{ display: "inline-block", marginTop: 10, padding: "6px 18px", borderRadius: 999, background: K.coral, ...big(40, K.white) }}>titik putus!</div>
      </div>
      <div style={{ position: "absolute", left: 600, top: 1000 }}>
        <Character who="tech" mood="excited" pose="point" talk={talk} width={280} flip />
      </div>
    </Backdrop>
  );
};

// Fusion splicer joining two fibres.
export const Splice: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const talk = useTalk(scene.id);
  const join = interpolate(f, [at(duration, 0.2), at(duration, 0.65)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Backdrop theme={t}>
      <Kicker index={idx(scene)} text={scene.kicker} color={t.fg} />
      <Reveal delay={2} style={{ position: "absolute", top: 250, left: 70 }}>
        <div style={big(170, t.fg)}>{scene.title}</div>
      </Reveal>
      <Reveal delay={10} style={{ position: "absolute", top: 430, left: 74, right: 70 }}>
        <div style={italic(66, K.cobalt, { lineHeight: 1.05 })}>{scene.note}</div>
      </Reveal>
      <div style={{ position: "absolute", left: 30, top: 640 }}>
        <Splicer size={680} join={join} />
      </div>
      <div style={{ position: "absolute", left: 90, top: 1250, fontFamily: label, fontWeight: 700, fontSize: 34, color: t.fg, letterSpacing: 2 }}>
        {join < 1 ? `MENYAMBUNG… ${Math.round(join * 100)}%` : "TERSAMBUNG ✓"}
      </div>
      <div style={{ position: "absolute", right: 40, top: 1000 }}>
        <Character who="tech" mood="happy" pose="thumbs" talk={talk} width={250} flip />
      </div>
    </Backdrop>
  );
};

// Power meter flips from LOS to a healthy reading; checklist ticks.
export const Meter: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const okAt = at(duration, 0.4);
  const ok = f >= okAt;
  const checks: string[] = scene.checks;
  return (
    <Backdrop theme={t}>
      <Sfx s="success" at={okAt} />
      <Kicker index={idx(scene)} text={scene.kicker} color={t.fg} />
      <div style={{ position: "absolute", left: -170, top: 330 }}>
        <PowerMeter size={900} reading={ok ? "-19.8" : "LOS"} ok={ok} />
      </div>
      <div style={{ position: "absolute", top: 300, right: 70, textAlign: "right", opacity: ok ? 1 : 0, transform: `scale(${ok ? 1 : 0.6})` }}>
        <div style={big(170, t.fg)}>{scene.title}</div>
      </div>
      <div style={{ position: "absolute", top: 700, left: 560, right: 50 }}>
        {checks.map((c, i) => {
          const s = useIn(okAt + 6 + i * 10, 12);
          return (
            <div key={c} style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 26, opacity: s, transform: `translateX(${interpolate(s, [0, 1], [120, 0])}px)` }}>
              <div style={{ width: 56, height: 56, borderRadius: 28, background: K.ink, color: K.mint, display: "grid", placeItems: "center", fontFamily: display, fontWeight: 800, fontSize: 36 }}>✓</div>
              <div style={{ fontFamily: display, fontWeight: 800, fontSize: 44, color: t.fg, lineHeight: 1.05 }}>{c}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 70, top: 1300, fontFamily: label, fontSize: 24, color: t.fg, opacity: 0.6 }}>angka contoh</div>
    </Backdrop>
  );
};

// Houses light up one by one; counter climbs; the sun starts to rise.
export const LightsBack: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const n: number = scene.count;
  const lit = Math.min(n, Math.floor(interpolate(f, [at(duration, 0.15), at(duration, 0.75)], [0, n], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  const sun = interpolate(f, [at(duration, 0.5), duration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Backdrop theme={t}>
      <SfxTrain s="blip" gap={3} from={at(duration, 0.15)} to={at(duration, 0.75)} count={(x) => Math.min(n, Math.floor(interpolate(x, [at(duration, 0.15), at(duration, 0.75)], [0, n], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })))} />
      <div style={{ position: "absolute", right: 80, top: 760 - sun * 140, width: 200, height: 200, borderRadius: 100, background: K.sun, opacity: sun, boxShadow: `0 0 120px ${K.sun}` }} />
      <Kicker index={idx(scene)} text={scene.kicker} color={t.fg} />
      <Headline lines={scene.lines} t={t} sizes={[110, 130, 170]} />
      <div style={{ position: "absolute", top: 760, left: 60, right: 60, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", rowGap: 0 }}>
        {Array.from({ length: n }).map((_, i) => (
          <div key={i} style={{ transform: `scale(${i < lit ? 1.06 : 1})`, filter: i < lit ? "none" : "grayscale(0.7) brightness(0.85)" }}>
            <House size={205} variant={i} lit={i < lit} />
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", top: 660, right: 70, fontFamily: label, fontWeight: 700, fontSize: 56, color: t.fg }}>
        {lit}/{n} <span style={{ color: "#16A34A" }}>online</span>
      </div>
    </Backdrop>
  );
};

export const MORE_SCENES: Record<string, React.FC<P>> = {
  cabinetHook: CabinetHook,
  mythFact: MythFact,
  bands: Bands,
  devices: Devices,
  clockHook: ClockHook,
  nocAlert: NocAlert,
  route: Route,
  splice: Splice,
  meter: Meter,
  lightsBack: LightsBack,
};
