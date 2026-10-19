import { interpolate, Easing } from "remotion";
import { useCurrentFrame } from "./components/Time";
import { accentItalic, display, serif, label, K } from "./design";
import { Backdrop, Chip, Kicker, Marquee, Reveal, useIn } from "./components/Kinetic";
import { Sfx } from "./components/Sfx";
import { Character, useTalk } from "./components/Character";
import { AlarmPill, CautionTape, House, LIGHT, LightState, Modem, PROPS } from "./components/Props";
import { EXTRA_PROPS } from "./components/PropsExtra";
import { MORE_SCENES } from "./scenesMore";
import { at, big, Headline, idx, italic, LogoCard, P, Talker, themeOf } from "./components/Type";
export type { Scene } from "./components/Type";

// Educational scene library (ODP, LOS, Wi-Fi tips, field stories). Content comes from script.json.
const ART: Record<string, React.FC<{ size: number }>> = { ...PROPS, ...EXTRA_PROPS };

/* ---------------- scenes ---------------- */

// Pole with an ODP box, a curious customer looking up.
export const PoleHook: React.FC<P> = ({ scene }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const pole = useIn(10, 15);
  const ring = (f % 40) / 40;
  return (
    <Backdrop theme={t}>
      <Kicker index={idx(scene)} text={scene.kicker} color={t.fg} />
      <Headline lines={scene.lines} t={t} />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, transform: `translateY(${interpolate(pole, [0, 1], [700, 0])}px)` }}>
        <path d="M-20 820 Q 380 900 800 790" stroke="#1F2937" strokeWidth={6} fill="none" />
        <path d="M-20 860 Q 380 950 800 830" stroke="#1F2937" strokeWidth={4} fill="none" />
        <rect x={770} y={740} width={60} height={760} rx={14} fill="#9CA3AF" />
        <rect x={700} y={770} width={200} height={20} rx={8} fill="#6B7280" />
        {/* the ODP box */}
        <rect x={700} y={880} width={200} height={240} rx={22} fill="#1F2937" />
        <rect x={720} y={900} width={160} height={30} rx={8} fill="#374151" />
        <circle cx={800} cy={1000} r={10} fill={K.cyan} />
        <path d="M740 1120 Q 680 1240 560 1300 M780 1120 Q 760 1260 700 1380 M860 1120 Q 900 1260 980 1330" stroke="#111827" strokeWidth={5} fill="none" />
        <rect x={690} y={870} width={220} height={260} rx={28} fill="none" stroke={t.accent} strokeWidth={8} opacity={1 - ring} transform={`translate(${800 * -ring * 0.12} ${1000 * -ring * 0.12}) scale(${1 + ring * 0.12})`} />
      </svg>
      {/* hand-drawn arrow from the headline to the box */}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <path
          d="M520 720 Q 640 760 680 900"
          stroke={K.cobalt}
          strokeWidth={10}
          fill="none"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={interpolate(f, [26, 40], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
        />
        <path d="M652 880 L682 910 L700 868" stroke={K.cobalt} strokeWidth={10} fill="none" strokeLinecap="round" opacity={f > 40 ? 1 : 0} />
      </svg>
      <div style={{ position: "absolute", left: 60, top: 860 }}>
        <Character who="user" mood="curious" pose="point" width={340} />
      </div>
    </Backdrop>
  );
};

// Giant acronym, each letter expanding into its word.
export const Acronym: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const word: string = scene.word;
  const expand: string[] = scene.expand;
  const note = useIn(at(duration, 0.55), 14);
  return (
    <Backdrop theme={t}>
      <Kicker index={idx(scene)} text={scene.kicker} color={t.fg} />
      <div style={{ position: "absolute", top: 240, left: 60, display: "flex" }}>
        {word.split("").map((ch, i) => {
          const s = useIn(2 + i * 5, 10, 170);
          return (
            <div key={i} style={{ ...big(380, i === 0 ? t.accent : t.fg), transform: `translateY(${interpolate(s, [0, 1], [300, 0])}px) rotate(${interpolate(s, [0, 1], [12, 0])}deg)`, opacity: s }}>
              {ch}
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", top: 640, left: 70 }}>
        {expand.map((w, i) => (
          <Reveal key={w} delay={at(duration, 0.18 + i * 0.09)}>
            <div style={big(110, t.fg)}>
              <span style={{ color: t.accent }}>{w[0]}</span>
              {w.slice(1)}
            </div>
          </Reveal>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          top: 1050,
          left: 70,
          maxWidth: scene.character ? 600 : 940,
          padding: "20px 30px",
          borderRadius: 28,
          background: t.soft,
          ...italic(52, t.fg, { lineHeight: 1.1 }),
          opacity: note,
          transform: `translateY(${interpolate(note, [0, 1], [40, 0])}px)`,
        }}
      >
        = {scene.note}
      </div>
      <Talker spec={scene.character} scene={scene} width={320} style={{ right: 40, top: 850 }} flip />
    </Backdrop>
  );
};

// One fibre in, many lines out to houses.
export const Splitter: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const outs: number = scene.outs ?? 8;
  const box = useIn(at(duration, 0.12), 13);
  const fan = interpolate(f, [at(duration, 0.25), at(duration, 0.5)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ys = Array.from({ length: outs }, (_, i) => 640 + (i * 700) / (outs - 1));
  return (
    <Backdrop theme={t}>
      <Kicker index={idx(scene)} text={scene.kicker} color={t.fg} />
      <div style={{ position: "absolute", top: 260, left: 70 }}>
        <Reveal delay={2}>
          <span style={big(150, t.fg)}>{scene.lines[0]}</span>
        </Reveal>
        <Reveal delay={9}>
          <span style={italic(130, t.accent)}>→ {scene.lines[1]}</span>
        </Reveal>
      </div>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <path d="M-10 990 L330 990" stroke={K.ink} strokeWidth={14} strokeLinecap="round" />
        <path d="M-10 990 L330 990" stroke={K.cyan} strokeWidth={8} strokeDasharray="30 60" strokeDashoffset={-f * 6} />
        {ys.map((y, i) => {
          const d = `M530 990 C 650 990, 700 ${y}, 840 ${y}`;
          const shown = fan * outs > i;
          return (
            <g key={i} opacity={shown ? 1 : 0}>
              <path d={d} stroke={K.ink} strokeWidth={6} fill="none" />
              <path d={d} stroke={K.cyan} strokeWidth={6} fill="none" pathLength={1} strokeDasharray="0.12 0.88" strokeDashoffset={-((f / 25 + i * 0.1) % 1)} />
            </g>
          );
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          left: 320,
          top: 910,
          width: 220,
          height: 160,
          borderRadius: 26,
          background: K.ink,
          color: K.white,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${box})`,
          fontFamily: label,
          fontWeight: 700,
        }}
      >
        <div style={{ fontSize: 30, letterSpacing: 2 }}>{scene.label}</div>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 64, color: K.cyan }}>1:{outs}</div>
      </div>
      {ys.map((y, i) => (
        <div key={i} style={{ position: "absolute", left: 850, top: y - 45, opacity: fan * outs > i ? 1 : 0, transform: `scale(${fan * outs > i ? 1 : 0.5})` }}>
          <House size={92} variant={i} lit={fan * outs > i + 0.5} />
        </div>
      ))}
      <div style={{ position: "absolute", left: 70, top: 1250, fontFamily: label, fontWeight: 500, fontSize: 26, color: t.fg, opacity: 0.6 }}>contoh splitter 1:{outs}</div>
    </Backdrop>
  );
};

// Vertical chain of steps joined by a line with a travelling pulse.
export const Chain: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const steps: { prop: string; title: string; desc: string }[] = scene.steps;
  const gapY = 270;
  const top = 300;
  let shownUntil = -1;
  steps.forEach((_, i) => {
    if (f >= at(duration, 0.06 + i * 0.18)) shownUntil = i;
  });
  const lineEnd = top + 70 + Math.max(0, shownUntil) * gapY;
  return (
    <Backdrop theme={t}>
      <Kicker index={idx(scene)} text={scene.kicker} color={t.fg} />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <line x1={160} y1={top + 70} x2={160} y2={lineEnd} stroke={t.fg} strokeWidth={10} strokeLinecap="round" />
        {shownUntil > 0 && <circle cx={160} cy={top + 70 + ((f * 8) % Math.max(1, lineEnd - top - 70))} r={16} fill={K.cobalt} />}
      </svg>
      {steps.map((s, i) => {
        const p = useIn(at(duration, 0.06 + i * 0.18), 13);
        return (
          <div key={s.title} style={{ position: "absolute", top: top + i * gapY, left: 70, display: "flex", alignItems: "center", gap: 36, opacity: p, transform: `translateX(${interpolate(p, [0, 1], [-120, 0])}px)` }}>
            <div
              style={{
                width: 210,
                height: 180,
                borderRadius: 40,
                background: K.white,
                border: i === 2 ? `6px solid ${K.cobalt}` : "6px solid transparent",
                display: "grid",
                placeItems: "center",
                boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
                transform: `scale(${p})`,
              }}
            >
              {(() => {
                const Art = ART[s.prop];
                return Art ? <Art size={165} /> : null;
              })()}
            </div>
            <div>
              <div style={big(86, t.fg)}>{s.title}</div>
              <div style={italic(50, i === 2 ? t.accent : t.fg, { marginTop: 6 })}>{s.desc}</div>
            </div>
          </div>
        );
      })}
    </Backdrop>
  );
};

// Stylised map: ODP boxes and the houses they feed; one goes red.
export const OdpMap: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const alertAt = at(duration, 0.45);
  const alert = useIn(alertAt + 6, 13);
  const odps = [
    { x: 260, y: 760 },
    { x: 760, y: 720 },
    { x: 300, y: 1130 },
    { x: 780, y: 1120 },
  ];
  const houses = (o: { x: number; y: number }, k: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2 + k;
      return { x: o.x + Math.cos(a) * 150, y: o.y + Math.sin(a) * 110 };
    });
  const appear = interpolate(f, [4, 30], [0, 1], { extrapolateRight: "clamp" });
  return (
    <Backdrop theme={t}>
      <Sfx s="alarm" at={alertAt + 6} />
      <Kicker index={idx(scene)} text={scene.kicker} color={K.cyan} />
      <div style={{ position: "absolute", top: 260, left: 70 }}>
        <Reveal delay={2}>
          <span style={big(130, t.fg)}>{scene.lines[0]} </span>
        </Reveal>
        <Reveal delay={8}>
          <span style={italic(130, K.cyan)}>{scene.lines[1]}.</span>
        </Reveal>
      </div>
      <div style={{ position: "absolute", left: 50, right: 50, top: 540, height: 820, borderRadius: 40, background: "rgba(255,255,255,0.05)", border: "3px solid rgba(59,213,245,0.3)", overflow: "hidden" }}>
        <svg width={980} height={820} viewBox="50 540 980 820" style={{ position: "absolute", inset: 0 }}>
          {[620, 940, 1260].map((y) => (
            <line key={y} x1={50} y1={y} x2={1030} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth={26} />
          ))}
          {[180, 540, 900].map((x) => (
            <line key={x} x1={x} y1={540} x2={x} y2={1360} stroke="rgba(255,255,255,0.08)" strokeWidth={26} />
          ))}
          {odps.map((o, k) => {
            const bad = k === 1 && f >= alertAt;
            const pulse = bad ? 0.5 + 0.5 * Math.sin(f / 3) : 1;
            return (
              <g key={k} opacity={appear}>
                {houses(o, k).map((h, i) => (
                  <g key={i}>
                    <line x1={o.x} y1={o.y} x2={h.x} y2={h.y} stroke={bad ? K.coral : K.cyan} strokeWidth={3} opacity={bad ? pulse : 0.6} />
                    <circle cx={h.x} cy={h.y} r={14} fill={bad ? K.coral : K.mint} />
                  </g>
                ))}
                <rect x={o.x - 34} y={o.y - 34} width={68} height={68} rx={14} fill={bad ? K.coral : K.sun} />
                {bad && <circle cx={o.x} cy={o.y} r={60 + ((f * 3) % 50)} fill="none" stroke={K.coral} strokeWidth={4} opacity={1 - ((f * 3) % 50) / 50} />}
              </g>
            );
          })}
        </svg>
        <div style={{ position: "absolute", right: 24, top: 20, fontFamily: label, fontSize: 22, color: "rgba(255,255,255,0.5)" }}>ilustrasi</div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 90,
          right: 90,
          top: 1180,
          padding: "22px 28px",
          borderRadius: 26,
          background: K.white,
          display: "flex",
          gap: 20,
          alignItems: "center",
          boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
          transform: `translateY(${interpolate(alert, [0, 1], [300, 0])}px)`,
          opacity: alert,
        }}
      >
        <AlarmPill />
        <div>
          <div style={{ fontFamily: display, fontWeight: 800, fontSize: 40, color: K.ink }}>{scene.alert.title}</div>
          <div style={{ fontFamily: label, fontWeight: 500, fontSize: 28, color: "#475569" }}>{scene.alert.body}</div>
        </div>
      </div>
    </Backdrop>
  );
};

// Big warning words with a character wagging a finger.
export const Warning: React.FC<P> = ({ scene }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const sign = useIn(20, 9);
  return (
    <Backdrop theme={t}>
      <Kicker index={idx(scene)} text={scene.kicker} color={t.fg} />
      <Headline lines={scene.lines} t={t} sizes={[200, 190, 200]} />
      <div style={{ position: "absolute", inset: 0, opacity: sign, transform: `translateX(${interpolate(sign, [0, 1], [-400, 0])}px)` }}>
        <CautionTape text={scene.tape ?? "AWAS · KABEL KACA"} top={960} rotate={-7 + Math.sin(f / 30)} />
      </div>
      <div style={{ position: "absolute", left: 70, top: 1180, maxWidth: 560, ...italic(52, t.fg, { lineHeight: 1.1 }) }}>isinya serat kaca setipis rambut</div>
      <Talker spec={scene.character} scene={scene} width={300} style={{ right: 50, top: 860 }} flip />
    </Backdrop>
  );
};

// Fibre modem with its red LOS light blinking, customer panicking.
export const ModemHook: React.FC<P> = ({ scene }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const m = useIn(8, 12);
  return (
    <Backdrop theme={t}>
      <Kicker index={idx(scene)} text={scene.kicker} color={t.fg} />
      <Headline lines={scene.lines} t={t} />
      <div style={{ position: "absolute", left: 400, top: 860, transform: `scale(${m}) rotate(${Math.sin(f * 1.3) * (f > 20 ? 1.5 : 0)}deg)` }}>
        <Modem
          width={600}
          lights={[
            { name: "POWER", state: "on" },
            { name: "PON", state: "off" },
            { name: "LOS", state: "red-blink" },
            { name: "LAN", state: "off" },
          ]}
        />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ position: "absolute", left: 620 + i * 110, top: 760 - Math.abs(Math.sin(f / 6 + i)) * 30, ...big(110, K.coral), opacity: f > 18 ? 1 : 0 }}>
          !
        </div>
      ))}
      <div style={{ position: "absolute", left: 40, top: 880 }}>
        <Character who="user" mood="surprised" pose="cheer" width={340} />
      </div>
    </Backdrop>
  );
};

// Modem with labelled lights and what "normal" looks like.
export const ModemLights: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const lights: { name: string; state: LightState; note: string }[] = scene.lights;
  return (
    <Backdrop theme={t}>
      <Kicker index={idx(scene)} text={scene.kicker} color={t.fg} />
      <Reveal delay={2} style={{ position: "absolute", top: 250, left: 70 }}>
        <div style={italic(130, t.fg)}>{scene.lines[0]}...</div>
      </Reveal>
      <div style={{ position: "absolute", left: 60, top: 420 }}>
        <Modem width={960} lights={lights} />
      </div>
      <div style={{ position: "absolute", left: 70, top: 1040, width: 620 }}>
        {lights.map((l, i) => {
          const s = useIn(at(duration, 0.3 + i * 0.08), 13);
          const key = l.name === "LOS" || l.name === "PON";
          return (
            <div key={l.name} style={{ display: "flex", alignItems: "center", gap: 20, height: 72, opacity: s, transform: `translateX(${interpolate(s, [0, 1], [-80, 0])}px)` }}>
              <div style={{ width: 30, height: 30, borderRadius: 15, background: l.state === "off" ? LIGHT.off : LIGHT.green, border: "3px solid #94A3B8" }} />
              <div style={{ fontFamily: label, fontWeight: 700, fontSize: 40, width: 200, color: t.fg }}>{l.name}</div>
              <div style={key ? big(48, l.name === "LOS" ? K.coral : K.cobalt) : italic(44, t.fg)}>{l.note}</div>
            </div>
          );
        })}
      </div>
      <Talker spec={scene.character} scene={scene} width={290} style={{ right: 40, top: 900 }} flip />
    </Backdrop>
  );
};

// Stacked cards that slide in as the narrator lists them.
export const Cards: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const cards: { prop: string; title: string; desc: string }[] = scene.cards;
  const bgs = [K.white, K.ink, K.cobalt];
  const fgs = [K.ink, K.white, K.white];
  return (
    <Backdrop theme={t}>
      {cards.map((c, i) => (
        <Sfx key={i} s="swipe" at={at(duration, 0.12 + i * 0.2) + 1} />
      ))}
      <Kicker index={idx(scene)} text={scene.kicker} color={t.fg} />
      <div style={{ position: "absolute", top: 260, left: 70 }}>
        <Reveal delay={2}>
          <span style={big(130, t.fg)}>{scene.lines[0]} </span>
        </Reveal>
        <Reveal delay={8}>
          <span style={italic(130, t.fg)}>{scene.lines[1]}</span>
        </Reveal>
      </div>
      {cards.map((c, i) => {
        const s = useIn(at(duration, 0.12 + i * 0.2), 13);
        return (
          <div
            key={c.title}
            style={{
              position: "absolute",
              left: 60,
              right: 60,
              top: 600 + i * 250,
              height: 220,
              borderRadius: 36,
              background: bgs[i % 3],
              color: fgs[i % 3],
              display: "flex",
              alignItems: "center",
              gap: 30,
              padding: "0 40px",
              transform: `translateX(${interpolate(s, [0, 1], [1100, 0])}px) rotate(${interpolate(s, [0, 1], [6, i % 2 ? 1 : -1])}deg)`,
              boxShadow: "0 18px 40px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ width: 180, height: 180, flexShrink: 0, borderRadius: 34, background: "#F1F5F9", display: "grid", placeItems: "center" }}>
              {(() => {
                const Art = ART[c.prop];
                return Art ? <Art size={170} /> : null;
              })()}
            </div>
            <div>
              <div style={{ fontFamily: display, fontWeight: 800, fontSize: 70, lineHeight: 1 }}>{c.title}</div>
              <div style={{ fontFamily: serif, fontStyle: accentItalic ? "italic" : "normal", fontSize: 46, opacity: 0.85, marginTop: 6 }}>{c.desc}</div>
            </div>
          </div>
        );
      })}
    </Backdrop>
  );
};

// Two modem states side by side (stacked) with their verdicts.
export const Compare: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const rows: { label: string; verdict: string; modem: "los" | "dead" }[] = scene.rows;
  return (
    <Backdrop theme={t}>
      <Kicker index={idx(scene)} text={scene.kicker} color={t.fg} />
      {rows.map((r, i) => {
        const s = useIn(at(duration, i === 0 ? 0.02 : 0.38), 13);
        return (
          <div
            key={r.label}
            style={{
              position: "absolute",
              left: 50,
              right: 50,
              top: 280 + i * 560,
              height: 520,
              borderRadius: 40,
              background: i === 0 ? K.white : "rgba(255,255,255,0.12)",
              color: i === 0 ? K.ink : K.white,
              padding: "36px 40px",
              transform: `translateY(${interpolate(s, [0, 1], [400, 0])}px)`,
              opacity: s,
            }}
          >
            <div style={big(96, i === 0 ? K.coral : K.white)}>{r.label}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 30 }}>
              <Modem
                width={420}
                lights={
                  r.modem === "los"
                    ? [
                        { name: "PWR", state: "on" },
                        { name: "PON", state: "off" },
                        { name: "LOS", state: "red-blink" },
                      ]
                    : [
                        { name: "PWR", state: "off" },
                        { name: "PON", state: "off" },
                        { name: "LOS", state: "off" },
                      ]
                }
              />
              <div style={italic(58, i === 0 ? K.ink : K.white, { lineHeight: 1.05 })}>→ {r.verdict}</div>
            </div>
          </div>
        );
      })}
    </Backdrop>
  );
};

// Numbered steps with a character on the side.
export const Checklist: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const steps: { title: string; desc: string }[] = scene.steps;
  return (
    <Backdrop theme={t}>
      {steps.map((st, i) => (
        <Sfx key={i} s="pop" at={at(duration, 0.1 + i * 0.25) + 1} />
      ))}
      <Kicker index={idx(scene)} text={scene.kicker} color={t.fg} />
      {steps.map((s, i) => {
        const p = useIn(at(duration, 0.1 + i * 0.25), 13);
        return (
          <div key={s.title} style={{ position: "absolute", left: 70, top: 280 + i * 280, width: 700, display: "flex", gap: 26, opacity: p, transform: `translateY(${interpolate(p, [0, 1], [60, 0])}px)` }}>
            <div style={big(170, [K.cobalt, K.coral, K.mint][i % 3], { WebkitTextStroke: i === 2 ? `3px ${K.ink}` : undefined })}>{String(i + 1).padStart(2, "0")}</div>
            <div style={{ paddingTop: 22 }}>
              <div style={big(70, t.fg)}>{s.title}</div>
              <div style={italic(48, t.fg, { marginTop: 8 })}>{s.desc}</div>
            </div>
          </div>
        );
      })}
      <Talker spec={scene.character} scene={scene} width={300} style={{ right: 40, top: 900 }} flip seed={2} />
    </Backdrop>
  );
};

// Closing call to action: logo, three-line headline, chips, characters.
export const Cta2: React.FC<P> = ({ scene, duration }) => {
  const t = themeOf(scene);
  const f = useCurrentFrame();
  const talk = useTalk(scene.id);
  const chips: string[] = scene.chips ?? [];
  const pulse = 1 + Math.max(0, Math.sin(f / 6)) * 0.05;
  return (
    <Backdrop theme={t}>
      <div style={{ position: "absolute", top: 190, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <LogoCard width={420} />
      </div>
      {/* the last line shrinks to fit on one line */}
      <Headline lines={scene.lines} t={t} sizes={[140, 130, Math.min(160, Math.floor(1900 / (scene.lines[2]?.length ?? 10)))]} top={380} align="center" />
      <div style={{ position: "absolute", top: 860, left: 60, right: 60, display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
        {chips.map((c, i) => (
          <Chip key={c} bg={i === 0 ? t.accent : t.fg} fg={t.bg} delay={at(duration, 0.2 + i * 0.1)} style={i === 0 ? { transform: `scale(${pulse})` } : undefined}>
            {c}
          </Chip>
        ))}
      </div>
      {scene.wa && (
        <div style={{ position: "absolute", top: 980, left: 60, right: 60, textAlign: "center", fontFamily: label, fontWeight: 700, fontSize: 40, color: t.fg, opacity: useIn(at(duration, 0.4)) }}>
          {scene.wa}
        </div>
      )}
      <div style={{ position: "absolute", top: scene.wa ? 1050 : 990, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
        {(scene.cast?.[0] ?? (scene.wa ? "cs" : "user")) === "cs" ? (
          <Character who="cs" mood="happy" pose="headset" talk={scene.wa ? talk : 0} width={210} seed={1} />
        ) : (
          <Character who="user" mood="excited" pose="cheer" width={220} seed={4} />
        )}
        <Character who="tech" mood="excited" pose="thumbs" talk={scene.wa ? 0 : talk} width={230} flip />
      </div>
    </Backdrop>
  );
};

export const SCENES: Record<string, React.FC<P>> = {
  ...MORE_SCENES,
  poleHook: PoleHook,
  acronym: Acronym,
  splitter: Splitter,
  chain: Chain,
  odpMap: OdpMap,
  warning: Warning,
  modemHook: ModemHook,
  modemLights: ModemLights,
  cards: Cards,
  compare: Compare,
  checklist: Checklist,
  cta2: Cta2,
};
