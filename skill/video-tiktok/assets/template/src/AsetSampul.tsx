// Gallery of the cover system (components/Cover.tsx, since 19 Oct 2026): six covers cropped to 3:4
// the way the TikTok profile grid shows them, one per mode and kind of visual, plus the anatomy of
// one cover with the crop lines. Look at it before writing s01:
//   npx remotion still AsetSampul out/aset-sampul.png
// Hosts are taken from public/img when the project has them (<key>-*.png for the hosts in
// src/brand.ts: explain, ask, remind), otherwise a placeholder marks the spot.
import React from "react";
import { AbsoluteFill, getStaticFiles } from "remotion";
import { Acc, Big, COVER_LAYOUT, CoverComment, CoverFrame, CoverHostStill, CoverTitle, CoverViz, Tail, useCoverMode } from "./components/Cover";
import { display, label, K } from "./design";
import { mono } from "./theme";
import { BRAND } from "./brand";

const P = COVER_LAYOUT.portrait;
const files = (() => {
  try {
    return getStaticFiles().map((f) => f.name);
  } catch {
    return [];
  }
})();
// First existing pose of `who`, in order of preference.
const pose = (who: string, prefer: string[]) => {
  const have = files.filter((n) => n.startsWith(`img/${who}-`) && n.endsWith(".png") && !n.includes("-mulut-")).map((n) => n.slice(4, -4));
  return prefer.map((p) => `${who}-${p}`).find((p) => have.includes(p)) ?? have[0] ?? null;
};

const Host: React.FC<{ who: string; prefer: string[] }> = ({ who, prefer }) => {
  const src = pose(who, prefer);
  const m = useCoverMode();
  if (src) return <CoverHostStill src={src} />;
  return (
    <div style={{ position: "absolute", right: 60, top: P.h - P.host.height + 60, width: 420, height: P.host.height, borderRadius: "210px 210px 0 0", background: m.fg, opacity: 0.12, zIndex: 20 }}>
      <div style={{ position: "absolute", top: 120, width: "100%", textAlign: "center", fontFamily: label, fontWeight: 700, fontSize: 40, color: m.bg }}>host</div>
    </div>
  );
};

/* ---------- small props for the visual zone ---------- */
const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ background: "#FFFFFF", borderRadius: 30, padding: "22px 30px", boxShadow: "0 18px 36px rgba(0,0,0,0.28)", color: K.ink, ...style }}>{children}</div>
);
const Phone: React.FC<{ hue: number }> = ({ hue }) => (
  <div style={{ width: 82, height: 150, borderRadius: 18, border: "8px solid #FFFFFF", background: `linear-gradient(160deg, hsl(${hue} 90% 62%), hsl(${hue + 40} 85% 48%))`, boxShadow: "0 12px 24px rgba(0,0,0,0.35)" }} />
);
const Router: React.FC = () => (
  <div style={{ position: "relative", width: 440, height: 300 }}>
    {[-12, -4, 4, 12].map((r, i) => (
      <div key={i} style={{ position: "absolute", left: 50 + i * 104, top: 0, width: 22, height: 190, borderRadius: 11, background: K.ink, transform: `rotate(${r}deg)`, transformOrigin: "50% 100%" }} />
    ))}
    <div style={{ position: "absolute", left: 0, top: 170, width: 440, height: 130, borderRadius: 34, background: K.ink, boxShadow: "0 20px 34px rgba(14,26,58,0.28)" }}>
      {[K.mint, K.mint, K.cyan].map((c, i) => (
        <div key={i} style={{ position: "absolute", left: 44 + i * 46, top: 52, width: 26, height: 26, borderRadius: 13, background: c }} />
      ))}
      <div style={{ position: "absolute", right: 40, top: 40, padding: "8px 18px", borderRadius: 999, border: `3px solid ${K.cyan}`, fontFamily: label, fontWeight: 700, fontSize: 26, color: K.cyan }}>WiFi 6</div>
    </div>
  </div>
);

/* ---------- the six covers ---------- */
type Ex = { mode: string; tag?: string; name: string; views: string; body: React.ReactNode };
const EXAMPLES: Ex[] = [
  {
    mode: "tips",
    tag: "BALAS KOMEN",
    name: "tips · balas komen",
    views: "1.204",
    body: (
      <>
        <CoverTitle>
          Password
          <br />
          <Acc>vs Voucher</Acc>
        </CoverTitle>
        <CoverComment name="@pelanggan.setia" source="komentar di video Paket 20 Mbps (contoh)" text="bg bahas bedanya wifi pake password sama wifi voucher yang ada masa waktunya dong" top={720} />
        <Host who={BRAND.hosts.explain} prefer={["tunjuk", "menunjuk", "jelaskan", "hp"]} />
      </>
    ),
  },
  {
    mode: "hitungan",
    name: "hitungan",
    views: "14,5K",
    body: (
      <>
        <CoverTitle>
          <Big unit="Mbps">20</Big>÷ 5 HP
          <Tail tone="acc2">cukup nggak?</Tail>
        </CoverTitle>
        <CoverViz top={1180} style={{ display: "flex", gap: 22 }}>
          {[190, 20, 190, 20, 190].map((h, i) => (
            <Phone key={i} hue={h} />
          ))}
        </CoverViz>
        <Host who={BRAND.hosts.ask} prefer={["mikir", "berpikir", "bingung", "hp"]} />
      </>
    ),
  },
  {
    mode: "hitungan",
    name: "hitungan",
    views: "21,9K",
    body: (
      <>
        <CoverTitle>
          Link speed
          <Big unit="Mbps" tone="acc2">
            433
          </Big>
          <Tail tone="acc">bagus nggak?</Tail>
        </CoverTitle>
        <Host who={BRAND.hosts.explain} prefer={["mikir", "berpikir", "bingung"]} />
      </>
    ),
  },
  {
    mode: "tips",
    name: "tips",
    views: "7.926",
    body: (
      <>
        <CoverTitle>
          Router
          <br />
          <Acc>WiFi 6</Acc>
          <Tail>kayak gini?</Tail>
        </CoverTitle>
        <CoverViz top={1010}>
          <Router />
        </CoverViz>
        <Host who={BRAND.hosts.explain} prefer={["tunjuk", "menunjuk", "jelaskan"]} />
      </>
    ),
  },
  {
    mode: "aman",
    name: "aman",
    views: "5.493",
    body: (
      <>
        <CoverTitle>
          Kode WA
          <Tail tone="acc" scale={1.05}>
            kesasar?
          </Tail>
        </CoverTitle>
        <CoverViz top={760}>
          <Card style={{ width: 500 }}>
            <div style={{ fontFamily: label, fontWeight: 700, fontSize: 24, letterSpacing: 3, color: "#5B6478" }}>KODE VERIFIKASI</div>
            <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 92, letterSpacing: 4 }}>482-915</div>
          </Card>
          <div style={{ display: "inline-block", marginTop: -14, marginLeft: 150, padding: "14px 30px", borderRadius: 18, background: K.coral, color: "#FFFFFF", fontFamily: display, fontWeight: 800, fontSize: 44, whiteSpace: "nowrap", transform: "rotate(-5deg)", boxShadow: "0 14px 28px rgba(0,0,0,0.35)" }}>JANGAN DIKASIH</div>
        </CoverViz>
        <Host who={BRAND.hosts.remind} prefer={["ingat", "mengingatkan", "hp", "sambut"]} />
      </>
    ),
  },
  {
    mode: "promo",
    name: "promo",
    views: "384",
    body: (
      <>
        <CoverTitle>
          Daftar
          <br />
          <Acc>dari HP</Acc>
          <Tail>3 langkah aja</Tail>
        </CoverTitle>
        <CoverViz top={1010}>
          {["Cek jangkauan", "Isi data", "Kirim"].map((t, i) => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 22 }}>
              <div style={{ width: 84, height: 84, borderRadius: 24, background: K.sun, color: K.ink, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: display, fontWeight: 800, fontSize: 50 }}>{i + 1}</div>
              <div style={{ fontFamily: display, fontWeight: 700, fontSize: 50, color: "#FFFFFF" }}>{t}</div>
            </div>
          ))}
        </CoverViz>
        <Host who={BRAND.hosts.remind} prefer={["sambut", "menyambut", "lambai", "hp"]} />
      </>
    ),
  },
];

/* ---------- layout of the gallery ---------- */
const CW = 318;
const SC = CW / P.w;
const CH = Math.round((P.safe.bottom - P.safe.top) * SC);

const Cell: React.FC<{ ex: Ex }> = ({ ex }) => (
  <div>
    <div style={{ position: "relative", width: CW, height: CH, overflow: "hidden", borderRadius: 8, background: "#000" }}>
      <div style={{ position: "absolute", left: 0, top: -P.safe.top * SC, width: P.w, height: P.h, transform: `scale(${SC})`, transformOrigin: "0 0" }}>
        <CoverFrame mode={ex.mode} tag={ex.tag}>
          {ex.body}
        </CoverFrame>
      </div>
      {/* what TikTok prints on top */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 70, background: "linear-gradient(transparent, rgba(0,0,0,0.45))" }} />
      <div style={{ position: "absolute", left: 14, bottom: 10, fontFamily: label, fontWeight: 700, fontSize: 22, color: "#FFFFFF" }}>▷ {ex.views}</div>
    </div>
    <div style={{ fontFamily: label, fontWeight: 700, fontSize: 20, letterSpacing: 1, color: "#9AA3B2", marginTop: 8 }}>{ex.name}</div>
  </div>
);

const ZONES: { n: number; x: number; y: number; w: number; h: number; dashed?: boolean; text: string }[] = [
  { n: 1, x: P.tag.left - 10, y: P.tag.top - 10, w: 620, h: 94, text: `Label seri: wordmark ${BRAND.name} + seri, selalu di sini` },
  { n: 2, x: P.title.left - 10, y: P.title.top, w: 820, h: 560, text: "Judul ≤ 5 kata, 1 kata aksen, ekor serif miring; angka raksasa di blok ini" },
  { n: 3, x: P.viz.left - 10, y: P.viz.top, w: P.viz.width + 20, h: P.viz.bottom - P.viz.top, dashed: true, text: "Zona visual: satu-satunya bagian yang beda tiap video" },
  { n: 4, x: P.w - 470, y: P.h - P.host.height + 30, w: 460, h: P.safe.bottom - (P.h - P.host.height + 30), text: "Host: kanan bawah, tinggi tetap, wajah di dalam potongan" },
  { n: 5, x: P.views.left + 6, y: P.views.top, w: P.views.width, h: P.views.height, text: "Pojok angka views TikTok: kosongkan" },
];

export const AsetSampul: React.FC = () => {
  const A = 0.4; // anatomy scale
  return (
    <AbsoluteFill style={{ background: "#111318", padding: "44px 45px", color: "#FFFFFF" }}>
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 54, letterSpacing: -1.5 }}>Sistem sampul {BRAND.name}</div>
      <div style={{ fontFamily: label, fontSize: 22, color: "#9AA3B2", marginBottom: 22 }}>frame 0 = sampul · grid profil memotong 3:4 · components/Cover.tsx</div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(3, ${CW}px)`, gap: "16px 18px" }}>
        {EXAMPLES.map((ex, i) => (
          <Cell key={i} ex={ex} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 34, marginTop: 34 }}>
        <div style={{ position: "relative", width: P.w * A, height: P.h * A, flexShrink: 0 }}>
          <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: 10 }}>
            <div style={{ position: "absolute", left: 0, top: 0, width: P.w, height: P.h, transform: `scale(${A})`, transformOrigin: "0 0" }}>
              <CoverFrame mode={EXAMPLES[2].mode}>{EXAMPLES[2].body}</CoverFrame>
            </div>
          </div>
          {[P.safe.top, P.safe.bottom].map((y) => (
            <div key={y} style={{ position: "absolute", left: -10, right: -10, top: y * A, borderTop: "3px dashed #FF3BD4" }} />
          ))}
          {ZONES.map((z) => (
            <div key={z.n} style={{ position: "absolute", left: z.x * A, top: z.y * A, width: z.w * A, height: z.h * A, border: `3px ${z.dashed ? "dashed" : "solid"} #FF3BD4`, borderRadius: 8, background: z.n === 5 ? "rgba(255,59,212,0.2)" : undefined }}>
              <div style={{ position: "absolute", left: -15, top: -15, width: 30, height: 30, borderRadius: 15, background: "#FF3BD4", fontFamily: label, fontWeight: 700, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>{z.n}</div>
            </div>
          ))}
        </div>
        <div style={{ paddingTop: 10 }}>
          <div style={{ fontFamily: label, fontWeight: 700, fontSize: 22, color: "#FF3BD4", marginBottom: 18 }}>– – garis potong grid profil (y 240 &amp; 1680)</div>
          {ZONES.map((z) => (
            <div key={z.n} style={{ display: "flex", gap: 16, marginBottom: 22 }}>
              <div style={{ width: 36, height: 36, borderRadius: 18, background: "#FF3BD4", fontFamily: label, fontWeight: 700, fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{z.n}</div>
              <div style={{ fontFamily: label, fontSize: 25, lineHeight: 1.3, color: "#D7DCE5" }}>{z.text}</div>
            </div>
          ))}
          <div style={{ fontFamily: label, fontSize: 22, lineHeight: 1.35, color: "#9AA3B2", marginTop: 8 }}>
            Mode: hitungan (navy + cyan/kuning) · tips (kertas + kobalt) · aman (navy + koral) · promo (biru brand + kuning). Font: Bricolage, Instrument Serif, Space Grotesk.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

