import { useCallback, useEffect, useRef, useState } from "react";

/* ---------------- helpers ---------------- */
class LoginNeeded extends Error {}
async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: opts.body && !(opts.body instanceof FormData) ? { "Content-Type": "application/json" } : undefined,
    body: opts.body && !(opts.body instanceof FormData) ? JSON.stringify(opts.body) : opts.body,
  });
  if (res.status === 401 && path !== "/api/login") throw new LoginNeeded();
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data;
}

// Clipboard API needs https/localhost; fall back for phones on plain LAN http.
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const t = document.createElement("textarea");
    t.value = text;
    document.body.appendChild(t);
    t.select();
    document.execCommand("copy");
    t.remove();
  }
}

const STATUS = { ide: "Ide", produksi: "Diproduksi", selesai: "Selesai", upload: "Diupload", buang: "Dibuang" };
const JOB = { antri: "Antri", jalan: "Berjalan", selesai: "Selesai", gagal: "Gagal", batal: "Batal" };
const KINDS = [
  { key: "edukasi", name: "Edukasi / tips", hint: "mitos-fakta, cara kerja, tips" },
  { key: "promo", name: "Promosi", hint: "paket, brand, ajakan daftar" },
  { key: "cerita", name: "Cerita lapangan", hint: "behind the scenes, karakter" },
  { key: "klip", name: "Klip dari video", hint: "potong rekaman yang diupload" },
];
const fmtSize = (b) => (b > 1e9 ? (b / 1e9).toFixed(1) + " GB" : b > 1e6 ? (b / 1e6).toFixed(1) + " MB" : Math.round(b / 1e3) + " KB");
const fullCaption = (c, tags) => [c ?? "", (tags ?? []).join(" ")].filter(Boolean).join("\n\n");
const isWide = (v) => v.orientation === "landscape";
const FORMAT = { portrait: "TikTok 9:16", landscape: "YouTube 16:9" };

/* ---------------- app ---------------- */
export function App() {
  const [data, setData] = useState(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [page, setPage] = useState(() => localStorage.getItem("page") ?? "beranda");
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");
  const [logs, setLogs] = useState({});

  const say = useCallback((t) => {
    setToast(t);
    setTimeout(() => setToast(""), Math.max(2600, t.length * 70));
  }, []);
  const load = useCallback(async () => {
    try {
      setData(await api("/api/state"));
      setNeedLogin(false);
    } catch (e) {
      if (e instanceof LoginNeeded) setNeedLogin(true);
      else say(e.message);
    }
  }, [say]);

  useEffect(() => {
    load();
    const t = new URLSearchParams(location.search).get("tiktok");
    if (t) {
      setPage("atur");
      try {
        localStorage.setItem("atur.tab", JSON.stringify("tiktok"));
      } catch {}
      setTimeout(() => say(t === "ok" ? "Akun TikTok tersambung" : "TikTok: " + t), 300);
      history.replaceState(null, "", "/");
    }
  }, [load]);
  useEffect(() => {
    try {
      localStorage.setItem("page", page);
    } catch {}
  }, [page]);

  // Live job progress from the server.
  useEffect(() => {
    if (!data) return;
    const es = new EventSource("/api/events");
    es.onmessage = (m) => {
      const e = JSON.parse(m.data);
      if (e.type === "job") setData((d) => ({ ...d, jobs: [e.job, ...d.jobs.filter((j) => j.id !== e.job.id)].sort((a, b) => b.id - a.id) }));
      if (e.type === "log") setLogs((l) => ({ ...l, [e.jobId]: [...(l[e.jobId] ?? []), ...e.line.split("\n")] }));
      if (e.type === "gen") setData((d) => ({ ...d, imagegen: { ...d.imagegen, tasks: e.tasks } }));
      if (e.type === "gen-done") say(e.ok ? `Selesai: ${e.label}` : `Gagal menggambar ${e.label}: ${e.error}`);
      if (e.type === "refresh" || (e.type === "job" && ["selesai", "gagal", "batal", "jalan"].includes(e.job.status))) load();
    };
    return () => es.close();
  }, [!!data, load]);

  if (needLogin) return <Login onDone={load} />;
  if (!data) return <div className="login"><div className="empty">Memuat studio…</div></div>;

  const running = data.jobs.find((j) => j.status === "jalan");
  const queued = data.jobs.filter((j) => j.status === "antri").length;
  const ctx = { data, load, say, setModal, logs, setLogs, setPage };
  const pages = [
    ["beranda", "Beranda"],
    ["ide", "Ide"],
    ["video", "Video"],
    ["komentar", "Komentar"],
    ["media", "Media"],
    ["edit", "Edit video"],
    ["antrian", "Antrian"],
    ["atur", "Pengaturan"],
  ];

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          Studio <em>konten</em>
        </div>
        {pages.map(([k, name]) => (
          <button key={k} className={"nav" + (page === k ? " on" : "")} onClick={() => setPage(k)}>
            {name}
            <span className="num">
              {k === "ide" ? data.ideas.filter((i) => i.status === "ide").length : k === "edit" ? data.jobs.filter((j) => j.type === "edit" && ["antri", "jalan"].includes(j.status)).length || "" : k === "video" ? data.videos.length : k === "komentar" ? data.comments?.waiting || "" : k === "media" ? data.media.filter((m) => !m.mouth_of).length : k === "antrian" ? (running ? "jalan" : queued || "") : ""}
            </span>
          </button>
        ))}
      </aside>
      <main>
        {page === "beranda" && <Home {...ctx} running={running} />}
        {page === "ide" && <Ideas {...ctx} />}
        {page === "video" && <Videos {...ctx} />}
        {page === "komentar" && <Comments {...ctx} />}
        {page === "media" && <Media {...ctx} />}
        {page === "edit" && <EditPage {...ctx} />}
        {page === "antrian" && <Jobs {...ctx} />}
        {page === "atur" && <Settings {...ctx} />}
      </main>
      {modal?.type === "create" && <CreateVideo {...ctx} idea={modal.idea} close={() => setModal(null)} />}
      {modal?.type === "revise" && <Revise {...ctx} video={modal.video} close={() => setModal(null)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Login({ onDone }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  return (
    <div className="login">
      <form
        className="card"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api("/api/login", { method: "POST", body: { pin } });
            onDone();
          } catch (x) {
            setErr(x.message);
          }
        }}
      >
        <div className="brand" style={{ margin: "6px 0 18px" }}>
          Studio <em>konten</em>
        </div>
        <label className="f">PIN</label>
        <input className="in" inputMode="numeric" autoFocus value={pin} onChange={(e) => setPin(e.target.value)} style={{ textAlign: "center", fontSize: 28, letterSpacing: 8 }} />
        {err && <p style={{ color: "#b91c1c" }}>{err}</p>}
        <button className="btn blue" style={{ marginTop: 16, width: "100%" }}>
          Masuk
        </button>
        <p className="sub" style={{ margin: "16px 0 0", fontSize: 14 }}>
          PIN ada di Mac: studio/data/pin.txt
        </p>
      </form>
    </div>
  );
}

/* ---------------- pages ---------------- */
function Home({ data, setModal, setPage, running, logs }) {
  const count = (s) => data.ideas.filter((i) => i.status === s).length;
  const lines = running ? (logs[running.id] ?? []).slice(-10) : [];
  return (
    <>
      <div className="kicker">01 · Beranda</div>
      <h1>
        Konten TikTok, <em>tinggal klik.</em>
      </h1>
      <div className="stats">
        <div className="stat" style={{ background: "#eef2ff" }}>
          <b>{count("ide")}</b>
          <span>Ide siap</span>
        </div>
        <div className="stat" style={{ background: "#fff7d6" }}>
          <b>{data.jobs.filter((j) => j.status === "antri" || j.status === "jalan").length}</b>
          <span>Diproses</span>
        </div>
        <div className="stat" style={{ background: "#dcfce7" }}>
          <b>{data.videos.filter((v) => v.status === "siap").length}</b>
          <span>Siap upload</span>
        </div>
        <div className="stat" style={{ background: "var(--ink)", color: "var(--cream)" }}>
          <b>{data.videos.filter((v) => v.status === "upload").length}</b>
          <span>Sudah diupload</span>
        </div>
      </div>
      <div className="row" style={{ marginTop: 22 }}>
        <button className="btn blue" onClick={() => setModal({ type: "create" })}>
          + Buat video baru
        </button>
        <button className="btn ghost" onClick={() => setPage("ide")}>
          Lihat & generate ide
        </button>
        <button className="btn ghost" onClick={() => setPage("media")}>
          Upload foto / video
        </button>
      </div>
      <h2>Sedang dikerjakan</h2>
      {running ? (
        <div className="card job">
          <div>
            <span className="pill jalan">Berjalan</span>
            <h3>{running.title}</h3>
            <div className="when">mulai {running.started_at}</div>
          </div>
          <button className="btn small ghost" onClick={() => setPage("antrian")}>
            Detail
          </button>
          <LogView lines={lines} />
        </div>
      ) : (
        <div className="card idle">Belum ada yang dikerjakan. Pilih ide lalu klik “Buat video”.</div>
      )}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h2>Video terbaru</h2>
        {data.videos.length > 4 && (
          <button className="btn small ghost" onClick={() => setPage("video")}>
            Semua video ({data.videos.length})
          </button>
        )}
      </div>
      {data.videos.length === 0 && <div className="card idle">Belum ada video.</div>}
      <div className="latest">
        {data.videos.slice(0, 4).map((v) => (
          <div key={v.id} className="card">
            {v.exists ? <video className={isWide(v) ? "wide" : ""} src={v.url + "#t=1"} controls preload="metadata" playsInline /> : <div className="empty">File video hilang</div>}
            <h3>{v.title}</h3>
            <div className="row" style={{ gap: 6 }}>
              <span className={"pill " + v.status}>{v.status === "upload" ? "Diupload" : "Siap upload"}</span>
              <span className={"pill fmt " + v.orientation}>{FORMAT[v.orientation]}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// Seconds since `active` turned true, for buttons that wait on a slow AI model.
function useElapsed(active) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    setSecs(0);
    if (!active) return;
    const t0 = Date.now();
    const t = setInterval(() => setSecs(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(t);
  }, [active]);
  return secs;
}

// Per-viewer preferences (filters, open panels). Storage can be unavailable, so the page
// must work without it.
function usePref(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const s = localStorage.getItem(key);
      return s === null ? initial : JSON.parse(s);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);
  return [value, setValue];
}

// Short names for the idea formats in server/content.mjs (FORMATS).
const BENTUK = {
  tutorial: "Tutorial",
  mitos: "Mitos vs fakta",
  daftar: "Daftar",
  salah: "Kesalahan umum",
  banding: "Perbandingan",
  kenapa: "Explainer",
  sketsa: "Sketsa / POV",
  tanya: "Tanya-jawab",
  kasus: "Studi kasus",
  rekomendasi: "Rekomendasi",
  fakta: "Fakta unik",
  kuis: "Kuis",
};
const fmtDay = (s) => {
  const d = s ? new Date(s.replace(" ", "T")) : null;
  return d && !isNaN(d) ? d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : "";
};
const ideaText = (i) => ["#" + i.id, i.title, i.hook, ...(i.outline ?? []), i.format, i.caption, ...(i.hashtags ?? [])].join(" ").toLowerCase();

function Ideas({ data, load, say, setModal, setPage }) {
  const P = data.pillars ?? {};
  const [tab, setTab] = usePref("ide.tab", "ide");
  const [pillarView, setPillarView] = usePref("ide.pilar", "semua");
  const [sort, setSort] = usePref("ide.urut", "baru");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [sel, setSel] = useState(() => new Set());
  const [busy, setBusy] = useState(false);

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const pool = data.ideas.filter((i) => (pillarView === "semua" || i.pillar === pillarView) && words.every((w) => ideaText(i).includes(w)));
  const order = {
    baru: (a, b) => b.id - a.id,
    lama: (a, b) => a.id - b.id,
    pilar: (a, b) => (P[a.pillar] ?? "~").localeCompare(P[b.pillar] ?? "~") || b.id - a.id,
  };
  const list = pool.filter((i) => tab === "semua" || i.status === tab).sort(order[sort] ?? order.baru);
  const filtered = words.length > 0 || pillarView !== "semua";
  // Bulk actions only touch ideas still on screen, and never one in production.
  const picked = list.filter((i) => sel.has(i.id));
  const movable = picked.filter((i) => i.status !== "produksi");
  const allPicked = list.length > 0 && picked.length === list.length;
  const toggle = (id) => setSel((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));

  const bulk = async (done, fn) => {
    setBusy(true);
    let ok = 0;
    const errors = [];
    for (const i of movable) {
      try {
        await fn(i);
        ok++;
      } catch (e) {
        errors.push(`#${i.id}: ${e.message}`);
      }
    }
    setBusy(false);
    setSel(new Set());
    say(errors.length ? `${ok} ide ${done}, ${errors.length} gagal (${errors[0]})` : `${ok} ide ${done}`);
    load();
  };
  const setStatus = (status, done) => bulk(done, (i) => api(`/api/ideas/${i.id}`, { method: "PATCH", body: { status } }));

  return (
    <>
      <div className="kicker">02 · Ide konten</div>
      <h1>
        Bank <em>ide.</em>
      </h1>
      <IdeaMaker data={data} load={load} say={say} onAdded={(id) => (setTab("ide"), setQ(""), setPillarView("semua"), setOpen(id))} />

      <div className="tabs" style={{ marginTop: 22 }}>
        {[["semua", "Semua"], ...Object.entries(STATUS)].map(([k, n]) => (
          <button key={k} className={"tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>
            {n} <span style={{ opacity: 0.6 }}>{k === "semua" ? pool.length : pool.filter((i) => i.status === k).length}</span>
          </button>
        ))}
      </div>
      <div className="itools">
        <input className="in search" type="search" placeholder="Cari judul, hook, poin, hashtag, atau #nomor…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="in" value={pillarView} onChange={(e) => setPillarView(e.target.value)} aria-label="Pilar">
          <option value="semua">Semua pilar</option>
          {Object.entries(P).map(([k, n]) => (
            <option key={k} value={k}>
              {n} ({data.ideas.filter((i) => i.pillar === k).length})
            </option>
          ))}
        </select>
        <select className="in" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Urutan">
          <option value="baru">Terbaru dulu</option>
          <option value="lama">Terlama dulu</option>
          <option value="pilar">Per pilar</option>
        </select>
      </div>

      {list.length > 0 && (
        <div className={"bulk" + (picked.length ? " on" : "")}>
          <label className="pick">
            <input type="checkbox" aria-label="Pilih semua ide yang tampil" checked={allPicked} onChange={() => setSel(allPicked ? new Set() : new Set(list.map((i) => i.id)))} />
            {picked.length ? `${picked.length} dipilih` : `Pilih semua (${list.length})`}
          </label>
          {picked.length > 0 && (
            <>
              <span className="grow" />
              {picked.length > movable.length && <span className="hint" style={{ margin: 0 }}>{picked.length - movable.length} sedang diproduksi, dilewati</span>}
              {movable.some((i) => i.status !== "ide") && (
                <button className="btn small ghost" disabled={busy} onClick={() => setStatus("ide", "dikembalikan ke Ide")}>
                  Jadikan Ide
                </button>
              )}
              {movable.some((i) => i.status !== "buang") && (
                <button className="btn small ghost" disabled={busy} onClick={() => setStatus("buang", "dibuang")}>
                  Buang
                </button>
              )}
              <button
                className="btn small danger"
                disabled={busy || !movable.length}
                onClick={() => {
                  const withVideo = movable.some((i) => i.video_id) ? "\n\nVideo yang sudah dibuat dari ide-ide ini tidak ikut terhapus." : "";
                  if (confirm(`Hapus ${movable.length} ide? Tidak bisa dibatalkan.${withVideo}`)) bulk("dihapus", (i) => api(`/api/ideas/${i.id}`, { method: "DELETE" }));
                }}
              >
                Hapus
              </button>
              <button className="btn small ghost" onClick={() => setSel(new Set())}>
                Batal
              </button>
            </>
          )}
        </div>
      )}

      {list.length === 0 && (
        <div className="card idle">
          {filtered ? "Tidak ada ide yang cocok dengan pencarian/filter ini." : tab === "ide" ? "Belum ada ide siap. Generate atau tulis ide baru di atas." : "Kosong di sini."}
          {filtered && (
            <button className="btn small ghost" style={{ marginLeft: 12 }} onClick={() => (setQ(""), setPillarView("semua"))}>
              Hapus filter
            </button>
          )}
        </div>
      )}
      <div className="ilist">
        {list.map((i) => (
          <IdeaRow key={i.id} i={i} P={P} data={data} load={load} say={say} setModal={setModal} setPage={setPage} open={open === i.id} onToggle={() => setOpen(open === i.id ? null : i.id)} picked={sel.has(i.id)} onPick={() => toggle(i.id)} />
        ))}
      </div>
    </>
  );
}

// "Generate ide" (AI) and "Tulis ide" (manual) share one panel that folds away.
function IdeaMaker({ data, load, say, onAdded }) {
  const P = data.pillars ?? {};
  const [mode, setMode] = usePref("ide.buat", "");
  const [count, setCount] = useState(5);
  const [theme, setTheme] = useState("");
  const [pillars, setPillars] = useState([]); // empty = mix, the brand pillar about 1 in 5
  const [busy, setBusy] = useState(false);
  const secs = useElapsed(busy);
  const blank = { title: "", hook: "", pillar: "", outline: "", format: "" };
  const [draft, setDraft] = useState(blank);
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });

  if (!mode)
    return (
      <div className="row">
        <button className="btn blue" onClick={() => setMode("ai")}>
          Generate ide
        </button>
        <button className="btn ghost" onClick={() => setMode("manual")}>
          + Tulis ide sendiri
        </button>
      </div>
    );
  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 14 }}>
        <div className="chips">
          <button className={"tab" + (mode === "ai" ? " on" : "")} onClick={() => setMode("ai")}>
            Generate ide
          </button>
          <button className={"tab" + (mode === "manual" ? " on" : "")} onClick={() => setMode("manual")}>
            Tulis ide sendiri
          </button>
        </div>
        <span className="grow" />
        <button className="btn small ghost" onClick={() => setMode("")}>
          Tutup
        </button>
      </div>
      {mode === "ai" ? (
        <>
          <div className="row">
            <input className="in grow" placeholder="Tema (opsional): misal tips gaming, keamanan HP orang tua, MikroTik dari nol…" value={theme} onChange={(e) => setTheme(e.target.value)} />
            <select className="in" style={{ width: 110 }} value={count} onChange={(e) => setCount(e.target.value)}>
              {[1, 3, 5, 8, 10].map((n) => (
                <option key={n} value={n}>
                  {n} ide
                </option>
              ))}
            </select>
            <button
              className="btn blue"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await api("/api/ideas/generate", { method: "POST", body: { count, theme, pillars } });
                  say(`${r.ids.length} ide baru (${r.model})`);
                  onAdded(null);
                  await load();
                } catch (e) {
                  say(e.message);
                }
                setBusy(false);
              }}
            >
              {busy ? `Mikir… ${secs} dtk` : "Generate"}
            </button>
          </div>
          <div className="chips" style={{ marginTop: 12 }}>
            <button className={"tab" + (pillars.length === 0 ? " on" : "")} onClick={() => setPillars([])} title={`Semua pilar bergiliran; ${data.brand?.name ?? "brand"}/promosi paling banyak 1 dari 5 ide`}>
              Campur
            </button>
            {Object.entries(P).map(([k, n]) => (
              <button key={k} className={"tab" + (pillars.includes(k) ? " on" : "")} onClick={() => setPillars(pillars.includes(k) ? pillars.filter((x) => x !== k) : [...pillars, k])}>
                {n}
              </button>
            ))}
          </div>
          <p className="hint">{pillars.length ? `Hanya pilar: ${pillars.map((k) => P[k]).join(", ")}.` : `Campur: topik teknologi umum bergiliran (perangkat, AI, keamanan, dll.), promosi ${data.brand?.name ?? "brand"} paling banyak 1 dari 5 ide.`} Bentuknya (tutorial, mitos-fakta, perbandingan, sketsa…) dibuat berbeda-beda.</p>
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const outline = draft.outline.split("\n").map((s) => s.replace(/^\s*[-•*\d.)]+\s*/, "").trim()).filter(Boolean);
              const { id } = await api("/api/ideas", { method: "POST", body: { title: draft.title.trim(), hook: draft.hook.trim(), outline, format: draft.format.trim() } });
              if (draft.pillar) await api(`/api/ideas/${id}`, { method: "PATCH", body: { pillar: draft.pillar } });
              say(`Ide #${id} disimpan`);
              setDraft(blank);
              onAdded(id);
              await load();
            } catch (x) {
              say(x.message);
            }
            setBusy(false);
          }}
        >
          <div className="fgrid">
            <div>
              <label className="f">Judul</label>
              <input className="in" required value={draft.title} onChange={set("title")} placeholder="Judul pendek dengan kata kunci" />
            </div>
            <div>
              <label className="f">Pilar</label>
              <select className="in" value={draft.pillar} onChange={set("pillar")}>
                <option value="">Pilih pilar…</option>
                {Object.entries(P).map(([k, n]) => (
                  <option key={k} value={k}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="full">
              <label className="f">Hook (2 detik pertama)</label>
              <input className="in" value={draft.hook} onChange={set("hook")} placeholder="Kalimat pembuka yang langsung menyebut masalah atau janji" />
            </div>
            <div>
              <label className="f">Poin isi (satu per baris)</label>
              <textarea className="in" value={draft.outline} onChange={set("outline")} />
            </div>
            <div>
              <label className="f">Catatan produksi (opsional)</label>
              <textarea className="in" value={draft.format} onChange={set("format")} placeholder="Gaya visual, karakter, durasi, sumber riset…" />
            </div>
          </div>
          <div className="savebar">
            <button className="btn blue" disabled={busy || !draft.title.trim()}>
              {busy ? "Menyimpan…" : "Simpan ide"}
            </button>
            <span className="hint" style={{ margin: 0 }}>
              Caption dan hashtag bisa dibuat nanti dari detail ide.
            </span>
          </div>
        </form>
      )}
    </div>
  );
}

function IdeaRow({ i, P, data, load, say, setModal, setPage, open, onToggle, picked, onPick }) {
  const [edit, setEdit] = useState(null);
  const [capBusy, setCapBusy] = useState(false);
  const video = i.video_id ? data.videos.find((v) => v.id === i.video_id) : null;
  const canMake = i.status === "ide" || i.status === "buang";
  const patch = async (body) => {
    await api(`/api/ideas/${i.id}`, { method: "PATCH", body });
    await load();
  };
  const startEdit = () => setEdit({ title: i.title ?? "", hook: i.hook ?? "", pillar: i.pillar ?? "", outline: (i.outline ?? []).join("\n"), format: i.format ?? "" });
  const setE = (k) => (e) => setEdit({ ...edit, [k]: e.target.value });

  return (
    <div className={"irow" + (open ? " open" : "") + (picked ? " picked" : "")}>
      <div className="ihead">
        <input type="checkbox" checked={picked} onChange={onPick} aria-label={`Pilih ide #${i.id}`} />
        <div className="imain" role="button" tabIndex={0} onClick={onToggle} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onToggle())}>
          <div className="t">{i.title}</div>
          {i.hook && <div className="h">“{i.hook.replace(/^["“”']+|["“”']+$/g, "")}”</div>}
          <div className="m">
            <span className={"pill " + i.status}>{STATUS[i.status]}</span>
            {i.pillar && P[i.pillar] && <span className={"pill pillar " + i.pillar}>{P[i.pillar]}</span>}
            {i.bentuk && BENTUK[i.bentuk] && <span>{BENTUK[i.bentuk]}</span>}
            {!!i.riset && <span className="flag" title="Bergantung pada fitur aplikasi/AI atau berita yang bisa berubah; dicek ke web saat produksi">perlu riset</span>}
            {!i.caption && <span className="flag soft">belum ada caption</span>}
            {video && <span>video: {video.title.length > 40 ? video.title.slice(0, 40) + "…" : video.title}</span>}
            <span className="id">
              #{i.id}
              {fmtDay(i.created_at) && ` · ${fmtDay(i.created_at)}`}
            </span>
          </div>
        </div>
        <div className="iact">
          {canMake && (
            <button className="btn small blue" onClick={() => setModal({ type: "create", idea: i })}>
              Buat video
            </button>
          )}
          <button className="btn small ghost chev" onClick={onToggle} aria-expanded={open} aria-label={open ? "Tutup detail" : "Buka detail"}>
            {open ? "▴" : "▾"}
          </button>
        </div>
      </div>

      {open && !edit && (
        <div className="ibody">
          <div>
            {i.outline?.length > 0 && (
              <>
                <label className="f" style={{ marginTop: 0 }}>
                  Poin isi
                </label>
                <ul className="ipoints">
                  {i.outline.map((o, k) => (
                    <li key={k}>{o}</li>
                  ))}
                </ul>
              </>
            )}
            {i.format && (
              <>
                <label className="f">Catatan produksi</label>
                <div className="notes">{i.format}</div>
              </>
            )}
          </div>
          <div>
            <label className="f" style={{ marginTop: 0 }}>
              Caption
            </label>
            {i.caption ? (
              <>
                <div className="caption">{i.caption}</div>
                <div className="tags">
                  {(i.hashtags ?? []).map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="hint" style={{ marginBottom: 10 }}>
                Belum ada caption.
              </p>
            )}
            <div className="row">
              <button
                className="btn small ghost"
                disabled={capBusy}
                onClick={async () => {
                  setCapBusy(true);
                  try {
                    await api("/api/caption", { method: "POST", body: { ideaId: i.id } });
                    await load();
                  } catch (e) {
                    say(e.message);
                  }
                  setCapBusy(false);
                }}
              >
                {capBusy ? "Nulis…" : i.caption ? "Caption ulang" : "Buat caption"}
              </button>
              {i.caption && (
                <button className="btn small ghost" onClick={() => copy(fullCaption(i.caption, i.hashtags)).then(() => say("Caption disalin"))}>
                  Salin
                </button>
              )}
            </div>
          </div>
          <div className="ifoot">
            <button className="btn small ghost" onClick={startEdit}>
              Edit
            </button>
            <select
              className="in"
              value={i.status}
              aria-label="Status"
              onChange={async (e) => {
                try {
                  await patch({ status: e.target.value });
                } catch (x) {
                  say(x.message);
                }
              }}
            >
              {Object.entries(STATUS).map(([k, n]) => (
                <option key={k} value={k}>
                  {n}
                </option>
              ))}
            </select>
            {video && (
              <button className="btn small ghost" onClick={() => setPage("video")}>
                Lihat video
              </button>
            )}
            <span className="grow" />
            <button
              className="btn small danger"
              disabled={i.status === "produksi"}
              title={i.status === "produksi" ? "Sedang diproduksi, batalkan job-nya dulu" : undefined}
              onClick={async () => {
                const note = i.video_id ? "\n\nVideo yang sudah dibuat dari ide ini tidak ikut terhapus." : "";
                if (!confirm(`Hapus ide #${i.id} “${i.title}”? Tidak bisa dibatalkan.${note}`)) return;
                try {
                  await api(`/api/ideas/${i.id}`, { method: "DELETE" });
                  say("Ide dihapus");
                  load();
                } catch (e) {
                  say(e.message);
                }
              }}
            >
              Hapus
            </button>
          </div>
        </div>
      )}

      {open && edit && (
        <form
          className="ibody edit"
          onSubmit={async (e) => {
            e.preventDefault();
            const outline = edit.outline.split("\n").map((s) => s.trim()).filter(Boolean);
            const body = {};
            if (edit.title.trim() !== i.title) body.title = edit.title.trim();
            if (edit.hook.trim() !== (i.hook ?? "")) body.hook = edit.hook.trim();
            if (edit.format.trim() !== (i.format ?? "")) body.format = edit.format.trim();
            if (edit.pillar && edit.pillar !== i.pillar) body.pillar = edit.pillar;
            if (JSON.stringify(outline) !== JSON.stringify(i.outline ?? [])) body.outline = outline;
            try {
              if (Object.keys(body).length) await patch(body);
              setEdit(null);
              say(Object.keys(body).length ? "Ide disimpan" : "Tidak ada perubahan");
            } catch (x) {
              say(x.message);
            }
          }}
        >
          <div className="fgrid full">
            <div>
              <label className="f" style={{ marginTop: 0 }}>
                Judul
              </label>
              <input className="in" required value={edit.title} onChange={setE("title")} />
            </div>
            <div>
              <label className="f" style={{ marginTop: 0 }}>
                Pilar
              </label>
              <select className="in" value={edit.pillar} onChange={setE("pillar")}>
                {!i.pillar && <option value="">Tanpa pilar (ide lama)</option>}
                {Object.entries(P).map(([k, n]) => (
                  <option key={k} value={k}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="full">
              <label className="f">Hook</label>
              <input className="in" value={edit.hook} onChange={setE("hook")} />
            </div>
            <div>
              <label className="f">Poin isi (satu per baris)</label>
              <textarea className="in" rows={7} value={edit.outline} onChange={setE("outline")} />
            </div>
            <div>
              <label className="f">Catatan produksi</label>
              <textarea className="in" rows={7} value={edit.format} onChange={setE("format")} />
            </div>
          </div>
          <div className="ifoot">
            <button className="btn small blue">Simpan</button>
            <button type="button" className="btn small ghost" onClick={() => setEdit(null)}>
              Batal
            </button>
            {i.caption && <span className="hint" style={{ margin: 0 }}>Caption tidak ikut berubah; klik “Caption ulang” setelah menyimpan kalau isinya berubah banyak.</span>}
          </div>
        </form>
      )}
    </div>
  );
}

function Videos({ data, load, say, setModal }) {
  const [tab, setTab] = useState("semua");
  const [format, setFormat] = useState("semua");
  const list = data.videos.filter((v) => (tab === "semua" || v.status === tab) && (format === "semua" || v.orientation === format));
  return (
    <>
      <div className="kicker">03 · Video</div>
      <h1>
        Siap <em>tayang.</em>
      </h1>
      <div className="tabs">
        {[
          ["semua", "Semua"],
          ["siap", "Siap upload"],
          ["upload", "Diupload"],
        ].map(([k, n]) => (
          <button key={k} className={"tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>
            {n}
          </button>
        ))}
        <span className="grow" />
        {[["semua", "Semua format"], ...Object.entries(FORMAT)].map(([k, n]) => (
          <button key={k} className={"tab" + (format === k ? " on" : "")} onClick={() => setFormat(k)}>
            {n}
          </button>
        ))}
      </div>
      {list.length === 0 && <div className="empty">Belum ada video.</div>}
      <div style={{ display: "grid", gap: 18 }}>
        {list.map((v) => (
          <VideoCard key={v.id} v={v} load={load} say={say} setModal={setModal} tiktok={data.tiktok} owner={data.comments?.owner} videos={data.videos} jobs={data.jobs} />
        ))}
      </div>
    </>
  );
}

const TT = {
  MENGUNGGAH: ["Mengunggah ke TikTok…", "produksi"],
  PROCESSING_UPLOAD: ["Diproses TikTok…", "produksi"],
  PROCESSING_DOWNLOAD: ["Diproses TikTok…", "produksi"],
  SEND_TO_USER_INBOX: ["Masuk inbox TikTok: selesaikan di aplikasi", "selesai"],
  PUBLISH_COMPLETE: ["Terposting di TikTok", "upload"],
  FAILED: ["Gagal ke TikTok", "gagal"],
};
const ttBusy = (s) => ["MENGUNGGAH", "PROCESSING_UPLOAD", "PROCESSING_DOWNLOAD"].includes(s);

function TikTokBar({ v, tiktok, load, say }) {
  const [status, setStatus] = useState({ tiktok_status: v.tiktok_status, tiktok_error: v.tiktok_error, tiktok_mode: v.tiktok_mode });
  const [mode, setMode] = useState("draft");
  const [posting, setPosting] = useState(false);
  useEffect(() => setStatus({ tiktok_status: v.tiktok_status, tiktok_error: v.tiktok_error, tiktok_mode: v.tiktok_mode }), [v.tiktok_status, v.tiktok_error]);
  // Poll while TikTok is still receiving/processing the upload.
  useEffect(() => {
    if (!ttBusy(status.tiktok_status)) return;
    const t = setTimeout(async () => {
      try {
        const s = await api(`/api/videos/${v.id}/tiktok/status`, { method: "POST" });
        setStatus(s);
        if (!ttBusy(s.tiktok_status)) load();
      } catch (e) {
        say(e.message);
      }
    }, 4000);
    return () => clearTimeout(t);
  }, [status]);
  if (!tiktok?.connected) return null;
  const label = TT[status.tiktok_status];
  return (
    <div className="card" style={{ background: "var(--cream)", boxShadow: "none", padding: 14, marginTop: 14 }}>
      <div className="row">
        <b style={{ fontSize: 15 }}>TikTok</b>
        {label && <span className={"pill " + label[1]}>{label[0]}</span>}
        <span className="grow" />
        <select className="in" style={{ width: "auto", padding: "6px 10px", fontSize: 14 }} value={mode} onChange={(e) => setMode(e.target.value)} disabled={ttBusy(status.tiktok_status)}>
          <option value="draft">Ke draf / inbox</option>
          {tiktok.can_direct && <option value="direct">Posting langsung</option>}
        </select>
        <button
          className="btn small blue"
          disabled={ttBusy(status.tiktok_status)}
          onClick={async () => {
            if (mode === "direct") return setPosting(true);
            await copy(fullCaption(v.caption, v.hashtags));
            await api(`/api/videos/${v.id}/tiktok`, { method: "POST", body: { mode } });
            setStatus({ tiktok_status: "MENGUNGGAH" });
            say("Mengunggah ke draf TikTok. Caption sudah disalin, tinggal tempel di aplikasi.");
          }}
        >
          {ttBusy(status.tiktok_status) ? "Mengunggah…" : "Kirim ke TikTok"}
        </button>
      </div>
      {status.tiktok_mode === "direct" && ttBusy(status.tiktok_status) && (
        <div className="hint" style={{ marginTop: 8 }}>TikTok sedang memproses video. Bisa butuh beberapa menit sampai muncul di profil.</div>
      )}
      {status.tiktok_error && <div style={{ color: "#b91c1c", marginTop: 8, fontSize: 14 }}>{status.tiktok_error}</div>}
      {posting && <PostToTikTok v={v} close={() => setPosting(false)} started={() => setStatus({ tiktok_status: "MENGUNGGAH", tiktok_mode: "direct" })} />}
    </div>
  );
}

// Post to TikTok screen (Direct Post), built to TikTok's Content Sharing Guidelines
// (developers.tiktok.com/doc/content-sharing-guidelines), which the API audit checks from a screen
// recording: creator info fetched fresh on every open, nothing preset (privacy has no default,
// comment/duet/stitch start off), commercial content disclosure, the Music Usage Confirmation
// declaration, a preview, and nothing is sent before the user presses Post. The texts TikTok
// prescribes stay in English, so the whole screen is in English.
const PRIVACY = { PUBLIC_TO_EVERYONE: "Everyone", MUTUAL_FOLLOW_FRIENDS: "Friends", FOLLOWER_OF_CREATOR: "Followers", SELF_ONLY: "Only me" };
const MUSIC_URL = "https://www.tiktok.com/legal/page/global/music-usage-confirmation/en";
const BC_URL = "https://www.tiktok.com/legal/page/global/bc-policy/en";
const NO_CHOICE = "You need to indicate if your content promotes yourself, a third party, or both.";
const BC_PRIVATE = "Branded content visibility cannot be set to private.";

function PostToTikTok({ v, close, started }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [title, setTitle] = useState(fullCaption(v.caption, v.hashtags));
  const [privacy, setPrivacy] = useState("");
  const [allow, setAllow] = useState({ comment: false, duet: false, stitch: false });
  const [disclose, setDisclose] = useState(false);
  const [yourBrand, setYourBrand] = useState(false);
  const [branded, setBranded] = useState(false);
  const [aigc, setAigc] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  useEffect(() => {
    api("/api/tiktok/creator").then(setInfo, (e) => setError(e.message));
  }, []);
  const max = info?.max_video_post_duration_sec;
  const tooLong = Boolean(max && v.duration > max);
  const brandOrganic = disclose && yourBrand;
  const brandContent = disclose && branded;
  const noChoice = disclose && !yourBrand && !branded;
  const ready = info && !info.blocked && !tooLong && privacy && !noChoice && title.length <= 2200 && !busy;
  const interaction = (key, name, off) => (
    <label className={"check" + (off ? " off" : "")} key={key}>
      <input type="checkbox" disabled={off} checked={!off && allow[key]} onChange={(e) => setAllow({ ...allow, [key]: e.target.checked })} />
      <span>
        Allow {name}
        {off && <small>Turned off in this account's TikTok settings.</small>}
      </span>
    </label>
  );
  const publish = async () => {
    setBusy(true);
    setError("");
    try {
      const post = { title, privacy, ...allow, brandOrganic, brandContent, aigc };
      await api(`/api/videos/${v.id}/tiktok`, { method: "POST", body: { mode: "direct", post } });
      started();
      setSent(true);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };
  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && !busy && close()}>
      <div className="card ttpost-card">
        <h2>Post to TikTok</h2>
        {sent ? (
          <>
            <p>Your video is being posted. TikTok may take a few minutes to process it before it appears on your profile. You can follow its status on this video card.</p>
            <button className="btn blue" onClick={close}>
              Done
            </button>
          </>
        ) : (
          <div className="ttpost">
            <div>
              <video src={v.url} controls playsInline preload="metadata" />
              <small className="hint">Preview of the video that will be posted.</small>
            </div>
            <div>
              {!info && !error && <p className="hint">Loading your TikTok account…</p>}
              {info && !info.blocked && (
                <div className="row ttpost-who">
                  {info.creator_avatar_url && <img src={info.creator_avatar_url} alt="" />}
                  <span>
                    Posting to <b>{info.creator_nickname ?? "TikTok account"}</b>
                    {info.creator_username && <small> @{info.creator_username}</small>}
                  </span>
                </div>
              )}
              {info?.blocked ? (
                <p className="ttpost-warn">This TikTok account can't post right now. Please try again later.</p>
              ) : (
                info && (
                  <>
                    {tooLong && (
                      <p className="ttpost-warn">
                        This video is {Math.round(v.duration)} seconds long; this account can post videos up to {max} seconds.
                      </p>
                    )}
                    <label className="f">Title</label>
                    <textarea className="in" value={title} onChange={(e) => setTitle(e.target.value)} rows={5} />
                    <small className={"hint" + (title.length > 2200 ? " ttpost-bad" : "")}>{title.length} / 2200</small>

                    <label className="f">Who can view this video</label>
                    <select className="in" value={privacy} onChange={(e) => setPrivacy(e.target.value)} title={brandContent ? BC_PRIVATE : undefined}>
                      <option value="" disabled>
                        Select privacy
                      </option>
                      {(info.privacy_level_options ?? []).map((p) => (
                        <option key={p} value={p} disabled={p === "SELF_ONLY" && brandContent} title={p === "SELF_ONLY" && brandContent ? BC_PRIVATE : undefined}>
                          {PRIVACY[p] ?? p}
                          {p === "SELF_ONLY" && brandContent ? " (not available for branded content)" : ""}
                        </option>
                      ))}
                    </select>

                    <label className="f">Allow users to</label>
                    {interaction("comment", "Comment", info.comment_disabled)}
                    {interaction("duet", "Duet", info.duet_disabled)}
                    {interaction("stitch", "Stitch", info.stitch_disabled)}

                    <label className="check">
                      <input
                        type="checkbox"
                        checked={disclose}
                        onChange={(e) => {
                          setDisclose(e.target.checked);
                          if (!e.target.checked) (setYourBrand(false), setBranded(false));
                        }}
                      />
                      <span>
                        Disclose video content
                        <small>Turn on to disclose that this video promotes goods or services in exchange for something of value. Your video could promote yourself, a third party, or both.</small>
                      </span>
                    </label>
                    {disclose && (
                      <div className="ttpost-disclose">
                        <label className="check">
                          <input type="checkbox" checked={yourBrand} onChange={(e) => setYourBrand(e.target.checked)} />
                          <span>
                            Your brand
                            <small>You are promoting yourself or your own business. This video will be classified as Brand Organic.</small>
                          </span>
                        </label>
                        <label className={"check" + (privacy === "SELF_ONLY" ? " off" : "")} title={privacy === "SELF_ONLY" ? BC_PRIVATE : undefined}>
                          <input type="checkbox" disabled={privacy === "SELF_ONLY"} checked={branded} onChange={(e) => setBranded(e.target.checked)} />
                          <span>
                            Branded content
                            <small>{privacy === "SELF_ONLY" ? BC_PRIVATE : "You are promoting another brand or a third party. This video will be classified as Branded Content."}</small>
                          </span>
                        </label>
                        {noChoice && <p className="ttpost-warn">{NO_CHOICE}</p>}
                        {(brandOrganic || brandContent) && <p className="hint">Your photo/video will be labeled as '{brandContent ? "Paid partnership" : "Promotional content"}'</p>}
                      </div>
                    )}

                    <label className="check">
                      <input type="checkbox" checked={aigc} onChange={(e) => setAigc(e.target.checked)} />
                      <span>
                        AI-generated content
                        <small>Adds TikTok's "Creator labeled as AI-generated" label to the post.</small>
                      </span>
                    </label>

                    <p className="ttpost-consent">
                      By posting, you agree to TikTok's{" "}
                      {brandContent && (
                        <>
                          <a href={BC_URL} target="_blank" rel="noreferrer">
                            Branded Content Policy
                          </a>{" "}
                          and{" "}
                        </>
                      )}
                      <a href={MUSIC_URL} target="_blank" rel="noreferrer">
                        Music Usage Confirmation
                      </a>
                      .
                    </p>
                  </>
                )
              )}
              {error && <p className="ttpost-warn">{error}</p>}
              <div className="row" style={{ marginTop: 18 }}>
                <span title={noChoice ? NO_CHOICE : undefined}>
                  <button className="btn blue" disabled={!ready} onClick={publish}>
                    {busy ? "Posting…" : "Post"}
                  </button>
                </span>
                <button className="btn ghost" disabled={busy} onClick={close}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Result of `npm run qa` in the project: one line per check plus a still of every scene.
const QA_ICON = { ok: "✓", warn: "⚠", fail: "✗" };
function QaPanel({ qa, wide }) {
  const [open, setOpen] = useState(false);
  if (!qa)
    return (
      <div className="qa">
        <span className="pill qa none" title={`Jalankan npm run qa${wide ? " -- --yt" : ""} di folder proyek`}>
          Belum di-QA
        </span>
      </div>
    );
  const n = (k) => qa.checks.filter((c) => c.status === k).length;
  const label = qa.status === "ok" ? "Lolos QA" : qa.status === "warn" ? `QA: ${n("warn")} catatan` : `QA: ${n("fail")} gagal${n("warn") ? `, ${n("warn")} catatan` : ""}`;
  return (
    <div className="qa">
      <button className={"pill qa " + qa.status} onClick={() => setOpen(!open)} aria-expanded={open}>
        {QA_ICON[qa.status]} {label}
        {qa.stale ? " · sebelum render terakhir" : ""} {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="qabox">
          <ul>
            {qa.checks.map((c) => (
              <li key={c.key} className={c.status}>
                <b>
                  {QA_ICON[c.status]} {c.label}
                </b>
                {c.detail && <span> — {c.detail}</span>}
              </li>
            ))}
          </ul>
          {qa.stale && <p className="hint">MP4 sudah dirender ulang setelah pemeriksaan ini; jalankan npm run qa lagi untuk hasil terbaru.</p>}
          <div className={"qasheet" + (wide ? " wide" : "")}>
            {qa.sheet.map((x) => (
              <a key={x.scene} href={x.url} target="_blank" rel="noreferrer">
                <img src={x.url} alt={`Still ${x.scene}`} loading="lazy" />
                <span>{x.scene}</span>
              </a>
            ))}
          </div>
          <p className="hint">Diperiksa {new Date(qa.at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p>
        </div>
      )}
    </div>
  );
}

// This video's cover next to the latest five on the TikTok profile, cropped to 3:4 like the grid
// (cover system, 19 Oct 2026: the user found the grid "kaya ngga konsisten"). Covers come from the
// QA stills (frame 0); uploaded videos first, since those are the ones on the profile.
const coverOf = (x) => x.qa?.sheet?.find((s) => s.scene === "frame 0")?.url;
function GridPreview({ v, videos }) {
  const [open, setOpen] = useState(false);
  if (!coverOf(v)) return null;
  const others = videos.filter((x) => x.id !== v.id && !isWide(x) && coverOf(x));
  const row = [...others.filter((x) => x.status === "upload"), ...others.filter((x) => x.status !== "upload")].slice(0, 5);
  return (
    <div className="gridprev">
      <button className="btn small ghost" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? "Tutup pratinjau grid" : "Pratinjau grid profil"}
      </button>
      {open && (
        <div className="ttgrid">
          {[v, ...row].map((x) => (
            <figure key={x.id} className={x.id === v.id ? "new" : ""} title={x.title}>
              <img src={coverOf(x)} alt={`Sampul ${x.title}`} loading="lazy" />
              <figcaption>{x.id === v.id ? "video ini" : x.status === "upload" ? "diupload" : "belum diupload"}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

function VideoCard({ v, load, say, setModal, tiktok, owner, videos, jobs }) {
  const wide = isWide(v);
  // The TikTok video and its YouTube version share one project folder.
  const yt = !wide && videos.find((x) => x.source_id === v.id && isWide(x));
  const ytBusy = !wide && jobs.some((j) => j.type === "landscape" && j.video_id === v.id && (j.status === "antri" || j.status === "jalan"));
  const shared = v.project_dir && videos.some((x) => x.id !== v.id && x.project_dir === v.project_dir);
  const [edit, setEdit] = useState(false);
  const [cap, setCap] = useState(v.caption ?? "");
  const [tags, setTags] = useState((v.hashtags ?? []).join(" "));
  const [busy, setBusy] = useState(false);
  const secs = useElapsed(busy);
  useEffect(() => {
    setCap(v.caption ?? "");
    setTags((v.hashtags ?? []).join(" "));
  }, [v.caption, v.hashtags?.join(" ")]);
  return (
    <div className={"card vcard" + (wide ? " wide" : "")}>
      {v.exists ? <video src={v.url + "#t=1"} controls preload="metadata" playsInline /> : <div className="empty">File video hilang</div>}
      <div>
        <div className="row">
          <span className={"pill " + v.status}>{v.status === "upload" ? "Diupload" : "Siap upload"}</span>
          <span className={"pill fmt " + v.orientation}>{FORMAT[v.orientation]}</span>
          {v.duration && <span className="pill">{Math.round(v.duration)} detik</span>}
          {yt && <span className="pill">Ada versi YouTube</span>}
        </div>
        <h3>{v.title}</h3>
        <QaPanel qa={v.qa} wide={wide} />
        {!wide && <GridPreview v={v} videos={videos} />}
        {edit ? (
          <>
            <textarea className="in" value={cap} onChange={(e) => setCap(e.target.value)} />
            <label className="f">Hashtag (maks 5)</label>
            <input className="in" value={tags} onChange={(e) => setTags(e.target.value)} />
            <div className="row" style={{ marginTop: 12 }}>
              <button
                className="btn small blue"
                onClick={async () => {
                  await api(`/api/videos/${v.id}`, { method: "PATCH", body: { caption: cap, hashtags: tags } });
                  setEdit(false);
                  load();
                }}
              >
                Simpan
              </button>
              <button className="btn small ghost" onClick={() => setEdit(false)}>
                Batal
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="caption">{v.caption || "Belum ada caption."}</div>
            <div className="tags">
              {(v.hashtags ?? []).map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
          </>
        )}
        {!edit && (
          <div className="row">
            <button className="btn small blue" onClick={() => copy(fullCaption(v.caption, v.hashtags)).then(() => say(wide ? "Deskripsi + hashtag disalin" : "Caption + hashtag disalin"))}>
              {wide ? "Salin deskripsi" : "Salin caption"}
            </button>
            <button className="btn small ghost" onClick={() => setEdit(true)}>
              Edit
            </button>
            <button
              className="btn small ghost"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api("/api/caption", { method: "POST", body: { videoId: v.id } });
                  await load();
                  say("Caption baru dibuat");
                } catch (e) {
                  say(e.message);
                }
                setBusy(false);
              }}
            >
              {busy ? `Nulis… ${secs} dtk` : wide ? "Deskripsi ulang" : "Caption ulang"}
            </button>
            <button className="btn small ghost" onClick={() => setModal({ type: "revise", video: v })}>
              Revisi video
            </button>
            {!wide && !yt && (
              <button
                className="btn small ghost"
                disabled={ytBusy}
                title="Layout 16:9 untuk YouTube dari proyek yang sama; suaranya dipakai ulang, tanpa kuota Gemini"
                onClick={async () => {
                  try {
                    await api("/api/jobs", { method: "POST", body: { type: "landscape", videoId: v.id } });
                    say("Versi YouTube masuk antrian (suara dipakai ulang, tanpa kuota Gemini)");
                    load();
                  } catch (e) {
                    say(e.message);
                  }
                }}
              >
                {ytBusy ? "Versi YouTube diproses…" : "Buat versi YouTube"}
              </button>
            )}
            <a className="btn small ghost" href={v.url} download style={{ textDecoration: "none" }}>
              Unduh
            </a>
            <button
              className={"btn small " + (v.status === "upload" ? "ghost" : "sun")}
              onClick={async () => {
                await api(`/api/videos/${v.id}`, { method: "PATCH", body: { status: v.status === "upload" ? "siap" : "upload" } });
                load();
              }}
            >
              {v.status === "upload" ? "Batal tandai" : "Tandai diupload"}
            </button>
            <button
              className="btn small danger"
              onClick={async () => {
                const folder = v.project_dir ? v.project_dir.split("/").pop() : null;
                const what = folder && !shared ? `Folder proyek "${folder}" (naskah, suara, gambar) dan file mp4-nya` : `File mp4-nya${shared ? " (folder proyek tetap, karena dipakai versi lainnya)" : ""}`;
                if (!confirm(`Hapus video "${v.title}" (${FORMAT[v.orientation]})?\n\n${what} ikut dipindah ke Trash. Bisa dikembalikan dari Trash kalau berubah pikiran.`)) return;
                try {
                  const r = await api(`/api/videos/${v.id}`, { method: "DELETE" });
                  say(r.removed ? `Video dihapus, ${r.removed} dipindah ke Trash` : "Video dihapus dari daftar");
                } catch (e) {
                  say(e.message);
                }
                load();
              }}
            >
              Hapus
            </button>
          </div>
        )}
        {!wide && <TikTokLink v={v} owner={owner} load={load} say={say} />}
        {!wide && <TikTokBar v={v} tiktok={tiktok} load={load} say={say} />}
      </div>
    </div>
  );
}

// The post's TikTok link, pasted by hand because the Studio TikTok app cannot list posts. The
// Komentar page reads the comments of every linked video. Saving also marks the video uploaded.
function TikTokLink({ v, owner, load, say, onSaved }) {
  const [edit, setEdit] = useState(!v.tiktok_id);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setEdit(!v.tiktok_id), [v.tiktok_id]);
  const save = async (value) => {
    setBusy(true);
    try {
      const r = await api(`/api/videos/${v.id}/tiktok-link`, { method: "PUT", body: { url: value } });
      say(!r.tiktok_id ? "Link TikTok dihapus" : r.title ? `Tersambung ke TikTok: “${r.title.slice(0, 60)}…”` : "Link TikTok disimpan");
      setUrl("");
      await load();
      if (r.tiktok_id) onSaved?.(r);
    } catch (e) {
      say(e.message);
    }
    setBusy(false);
  };
  if (!edit)
    return (
      <div className="ttlink">
        <b>Link TikTok</b>
        <a href={`https://www.tiktok.com/@${owner}/video/${v.tiktok_id}`} target="_blank" rel="noreferrer">
          …/video/{v.tiktok_id}
        </a>
        <span className="grow" />
        <button className="btn small ghost" onClick={() => setEdit(true)}>
          Ubah
        </button>
      </div>
    );
  return (
    <form className="ttlink" onSubmit={(e) => (e.preventDefault(), save(url))}>
      <input className="in grow" placeholder="Tempel link TikTok (Bagikan › Salin tautan)" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Link TikTok" />
      <button className="btn small blue" disabled={busy || !url.trim()}>
        {busy ? "Mengecek…" : "Simpan link"}
      </button>
      {v.tiktok_id && (
        <>
          <button type="button" className="btn small ghost" onClick={() => setEdit(false)}>
            Batal
          </button>
          <button type="button" className="btn small danger" disabled={busy} onClick={() => save("")}>
            Hapus link
          </button>
        </>
      )}
      {!v.tiktok_id && <span className="hint full">Supaya komentarnya terbaca di halaman Komentar.{v.status !== "upload" ? " Video ikut ditandai Diupload." : ""}</span>}
    </form>
  );
}

/* ---------------- comments ---------------- */
const ago = (t) => {
  const s = Date.now() / 1000 - t;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} menit lalu`;
  if (s < 86400) return `${Math.round(s / 3600)} jam lalu`;
  if (s < 7 * 86400) return `${Math.round(s / 86400)} hari lalu`;
  return new Date(t * 1000).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
};
const fullTime = (t) => new Date(t * 1000).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
const RANGES = [
  [7, "7 hari"],
  [30, "30 hari"],
  [0, "Semua"],
];

// Latest TikTok comments per video, read from TikTok without login (server/comments.mjs). Replying
// stays in the TikTok app; from here a comment can become a reply video idea.
function Comments({ data, load, say, setPage }) {
  const [days, setDays] = usePref("komentar.hari", 7);
  const [only, setOnly] = usePref("komentar.lihat", "belum");
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const fetchList = useCallback(async () => {
    try {
      setRes(await api(`/api/comments?days=${days}`));
    } catch (e) {
      say(e.message);
    }
  }, [days, say]);
  const refresh = async (videoIds) => {
    setBusy(true);
    try {
      const r = await api("/api/comments/refresh", { method: "POST", body: { videoIds } });
      say(`${r.comments} komentar dari ${r.videos} video${r.errors.length ? `; ${r.errors.length} gagal: ${r.errors[0]}` : ""}`);
      await fetchList();
      load();
    } catch (e) {
      say(e.message);
    }
    setBusy(false);
  };
  useEffect(() => {
    fetchList();
  }, [fetchList]);
  const checked = res ? Math.max(0, ...res.videos.map((v) => (v.tiktok_checked_at ? Date.parse(v.tiktok_checked_at.replace(" ", "T")) : 0))) : 0;
  // Ask TikTok again on open when the last check is older than 30 minutes.
  useEffect(() => {
    if (res?.videos.length && Date.now() - checked > 30 * 60 * 1000) refresh();
  }, [!!res]);

  if (!res) return <div className="empty">Memuat komentar…</div>;
  const waiting = (c) => c.unanswered || c.followup;
  const span = days ? ` dalam ${days} hari terakhir` : "";
  const shown = res.comments.filter((c) => only === "semua" || waiting(c));
  const groups = res.videos
    .map((v) => ({ v, list: shown.filter((c) => c.video_id === v.id), all: res.comments.filter((c) => c.video_id === v.id) }))
    .filter((g) => g.list.length)
    .sort((a, b) => b.list[0].last_activity - a.list[0].last_activity);
  return (
    <>
      <div className="kicker">04 · Komentar</div>
      <h1>
        Komentar <em>terbaru.</em>
      </h1>
      <p className="sub">Dibaca langsung dari TikTok tanpa login, untuk video yang link TikTok-nya sudah ditempel. Membalas tetap dari aplikasi TikTok.</p>
      <div className="itools">
        <div className="chips">
          {[
            ["belum", `Belum dibalas (${res.comments.filter(waiting).length})`],
            ["semua", `Semua (${res.comments.length})`],
          ].map(([k, n]) => (
            <button key={k} className={"tab" + (only === k ? " on" : "")} onClick={() => setOnly(k)}>
              {n}
            </button>
          ))}
        </div>
        <div className="chips">
          {RANGES.map(([d, n]) => (
            <button key={d} className={"tab" + (days === d ? " on" : "")} onClick={() => setDays(d)}>
              {n}
            </button>
          ))}
        </div>
        <span className="grow" />
        {checked > 0 && <span className="hint" style={{ margin: 0 }}>dicek {ago(checked / 1000)}</span>}
        <button className="btn blue" disabled={busy || !res.videos.length} onClick={() => refresh()}>
          {busy ? "Mengambil dari TikTok…" : "Ambil komentar terbaru"}
        </button>
      </div>

      {!res.videos.length ? (
        <div className="card idle">Belum ada video yang punya link TikTok. Tempel link-nya di bawah atau di kartu video.</div>
      ) : (
        !groups.length && <div className="card idle">{only === "belum" ? `Semua komentar${span} sudah dibalas.` : `Belum ada komentar${span}.`}</div>
      )}
      <div className="cgroups">
        {groups.map(({ v, list, all }) => (
          <section key={v.id} className="card cgroup">
            <div className="chead">
              <div>
                <h3>{v.title}</h3>
                <div className="hint" style={{ margin: 0 }}>
                  {all.length} komentar · {all.filter(waiting).length} menunggu balasan
                  {v.tiktok_checked_at && ` · dicek ${ago(Date.parse(v.tiktok_checked_at.replace(" ", "T")) / 1000)}`}
                </div>
              </div>
              <a className="btn small ghost" href={v.url} target="_blank" rel="noreferrer">
                Buka video di TikTok ↗
              </a>
            </div>
            {list.map((c) => (
              <CommentItem key={c.cid} c={c} v={v} say={say} setPage={setPage} reload={fetchList} load={load} />
            ))}
          </section>
        ))}
      </div>

      {res.unlinked.length > 0 && (
        <details className="more card" open={!res.videos.length} style={{ marginTop: 22 }}>
          <summary>{res.unlinked.length} video sudah diupload tapi belum punya link TikTok</summary>
          <p className="hint">Di aplikasi TikTok buka videonya › Bagikan › Salin tautan, lalu tempel. Komentarnya langsung diambil.</p>
          {res.unlinked.map((v) => (
            <div key={v.id} className="unlinked">
              <b>{v.title}</b>
              <TikTokLink v={v} owner={res.owner} load={fetchList} say={say} onSaved={() => refresh([v.id])} />
            </div>
          ))}
        </details>
      )}
    </>
  );
}

function CommentItem({ c, v, say, setPage, reload, load }) {
  const [open, setOpen] = useState(c.followup);
  const [busy, setBusy] = useState(false);
  const makeIdea = async () => {
    setBusy(true);
    try {
      const r = await api(`/api/comments/${c.cid}/idea`, { method: "POST" });
      say(r.existing ? `Sudah jadi ide #${r.id}` : r.error ? `Ide #${r.id} disimpan tanpa AI (${r.error.slice(0, 80)}); lengkapi di halaman Ide` : `Ide #${r.id} masuk bank ide (${r.model})`);
      await reload();
      load();
    } catch (e) {
      say(e.message);
    }
    setBusy(false);
  };
  const pics = (list) =>
    list.length > 0 && (
      <div className="cimgs">
        {list.map((u) => (
          <a key={u} href={u} target="_blank" rel="noreferrer">
            <img src={u} alt="Gambar di komentar" loading="lazy" />
          </a>
        ))}
      </div>
    );
  return (
    <div className={"cmt" + (c.unanswered || c.followup ? " wait" : "")}>
      <div className="cwho">
        <b>@{c.user}</b>
        {c.nickname && c.nickname !== c.user && <span>{c.nickname}</span>}
        <span title={fullTime(c.time)}>{ago(c.time)}</span>
        {c.likes > 0 && <span>♥ {c.likes}</span>}
        {c.unanswered && <span className="pill buang">Belum dibalas</span>}
        {c.followup && <span className="pill produksi">Ada balasan baru</span>}
        {c.author_liked && <span className="pill">Disukai kreator</span>}
        {c.pinned && <span className="pill">Disematkan</span>}
      </div>
      {c.text && <div className="ctext">{c.text}</div>}
      {pics(c.images)}
      {c.replies.length > 0 && (
        <button className="linkbtn" onClick={() => setOpen(!open)}>
          {open ? "Sembunyikan" : "Lihat"} {c.replies.length} balasan
        </button>
      )}
      {open && (
        <div className="creplies">
          {c.replies.map((r) => (
            <div key={r.cid} className={"creply" + (r.mine ? " mine" : "")}>
              <div className="cwho">
                <b>@{r.user}</b>
                <span title={fullTime(r.time)}>{ago(r.time)}</span>
              </div>
              {r.text ? <div className="ctext">{r.text}</div> : !r.images.length && <div className="hint">(stiker)</div>}
              {pics(r.images)}
            </div>
          ))}
        </div>
      )}
      <div className="row cact">
        <a className="btn small ghost" href={v.url} target="_blank" rel="noreferrer">
          Buka di TikTok
        </a>
        {c.text && (
          <button className="btn small ghost" onClick={() => copy(c.text).then(() => say("Komentar disalin"))}>
            Salin
          </button>
        )}
        {c.idea_id ? (
          <button className="btn small ghost" onClick={() => setPage("ide")} title="Buka halaman Ide">
            Ide #{c.idea_id} · {STATUS[c.idea_status] ?? c.idea_status}
          </button>
        ) : (
          !c.mine && (
            <button className="btn small blue" disabled={busy} onClick={makeIdea}>
              {busy ? "Menulis ide…" : "Jadikan ide video balasan"}
            </button>
          )
        )}
      </div>
    </div>
  );
}

function Media({ data, load, say }) {
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState(null);
  const [filter, setFilter] = useState("semua");
  const [refId, setRefId] = useState(null);
  const input = useRef();
  const gen = useRef();
  const send = (files) => {
    if (!files.length) return;
    const form = new FormData();
    for (const f of files) form.append("files", f);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media");
    xhr.upload.onprogress = (e) => setProgress(e.loaded / e.total);
    xhr.onload = () => {
      setProgress(null);
      if (xhr.status === 200) say(`${files.length} file terupload`);
      else say("Upload gagal: " + xhr.responseText.slice(0, 120));
      load();
    };
    xhr.onerror = () => (setProgress(null), say("Upload gagal"));
    xhr.send(form);
  };
  const shown = data.media.filter((m) => !m.mouth_of);
  const mouthsOf = (id) => data.media.filter((m) => m.mouth_of === id);
  const aiCount = shown.filter((m) => m.prompt).length;
  const list = shown.filter((m) => filter === "semua" || (filter === "ai") === Boolean(m.prompt));
  const tasks = data.imagegen?.tasks ?? [];
  return (
    <>
      <div className="kicker">05 · Media</div>
      <h1>
        Foto, rekaman & <em>karakter.</em>
      </h1>
      <p className="sub">Upload foto asli atau rekaman, atau gambar karakter anime {data.brand?.name ?? "brand"} pakai AI. Karakter anime otomatis dipakai kalau video butuh karakter; media lain bisa dilampirkan saat membuat video.</p>
      <div className="mtop">
        <div ref={gen}>
          <Generator data={data} say={say} refId={refId} setRefId={setRefId} />
        </div>
        <div
          className={"drop" + (over ? " over" : "")}
          onClick={() => input.current.click()}
          onDragOver={(e) => (e.preventDefault(), setOver(true))}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => (e.preventDefault(), setOver(false), send([...e.dataTransfer.files]))}
        >
          <b>Upload foto / video</b>
          <div style={{ color: "var(--muted)", marginTop: 6 }}>Tarik file ke sini, atau ketuk untuk pilih dari HP / Mac · maks 4 GB per file</div>
          <input ref={input} type="file" multiple accept="image/*,video/*" hidden onChange={(e) => send([...e.target.files])} />
          {progress !== null && (
            <div className="bar">
              <i style={{ width: `${progress * 100}%` }} />
            </div>
          )}
        </div>
      </div>
      <div className="tabs" style={{ marginTop: 28 }}>
        {[
          ["semua", "Semua", shown.length],
          ["ai", "Gambar AI", aiCount],
          ["upload", "Upload", shown.length - aiCount],
        ].map(([k, name, n]) => (
          <button key={k} className={"tab" + (filter === k ? " on" : "")} onClick={() => setFilter(k)}>
            {name} · {n}
          </button>
        ))}
      </div>
      <div className="mgrid">
        {filter !== "upload" &&
          tasks.map((t) => (
            <div key={"t" + t.id} className="mitem">
              <div className="ph">
                <span>Menggambar…</span>
              </div>
              <div className="info">
                <div style={{ color: "var(--ink)", fontWeight: 700 }}>{t.label}</div>
                <Elapsed since={t.started} />
              </div>
            </div>
          ))}
        {list.map((m) => (
          <div key={m.id} className="mitem">
            {m.kind === "video" ? (
              <video src={m.url + "#t=0.5"} preload="metadata" muted playsInline />
            ) : (
              <a href={m.url} target="_blank" rel="noreferrer">
                <Talking m={m} mouths={mouthsOf(m.id)} />
              </a>
            )}
            <div className="info">
              <div style={{ color: "var(--ink)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.filename}</div>
              {fmtSize(m.size)} · {m.prompt ? "AI" : m.kind}
              {m.cutout ? " · transparan" : ""}
              {mouthsOf(m.id).length > 0 && <b style={{ color: "var(--cobalt)" }}> · bisa bicara</b>}
              <input
                className="in"
                style={{ marginTop: 8, padding: "6px 10px", fontSize: 13 }}
                placeholder="Catatan (isi foto ini apa)"
                defaultValue={m.note ?? ""}
                onBlur={(e) => api(`/api/media/${m.id}`, { method: "PATCH", body: { note: e.target.value } })}
              />
              <div className="row" style={{ gap: 6, marginTop: 8 }}>
                {m.kind === "image" && (
                  <button
                    className="btn small ghost"
                    title="Buat pose / versi lain dari gambar ini"
                    onClick={() => {
                      setRefId(m.id);
                      gen.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    Variasi
                  </button>
                )}
                {m.char && m.cutout ? (
                  <button
                    className="btn small ghost"
                    title="Buat 3 frame mulut (tutup, setengah, buka) dengan posisi identik, untuk animasi bicara"
                    onClick={async () => {
                      try {
                        await api(`/api/media/${m.id}/mouths`, { method: "POST" });
                        say("Membuat frame mulut… ±1 menit");
                      } catch (e) {
                        say(e.message);
                      }
                    }}
                  >
                    {mouthsOf(m.id).length ? "Ulang mulut" : "Mulut bicara"}
                  </button>
                ) : null}
                <a className="btn small ghost" href={m.url} download={m.filename} style={{ textDecoration: "none" }}>
                  Unduh
                </a>
                <button
                  className="btn small danger"
                  onClick={async () => {
                    if (!confirm(`Pindahkan ${m.filename} ke Trash?`)) return;
                    await api(`/api/media/${m.id}`, { method: "DELETE" });
                    load();
                  }}
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// Hovering a character that has mouth frames plays them like speech.
function Talking({ m, mouths }) {
  const [frame, setFrame] = useState(null);
  const timer = useRef();
  const order = ["closed", "mid", "open", "mid", "closed", "open", "mid", "closed"];
  const byKey = Object.fromEntries(mouths.map((x) => [x.mouth, x.url]));
  const start = () => {
    if (!mouths.length) return;
    let i = 0;
    clearInterval(timer.current);
    timer.current = setInterval(() => setFrame(byKey[order[i++ % order.length]] ?? null), 110);
  };
  const stop = () => (clearInterval(timer.current), setFrame(null));
  useEffect(() => () => clearInterval(timer.current), []);
  return <img src={frame ?? m.url} alt="" loading="lazy" className={m.cutout ? "cut" : ""} onMouseEnter={start} onMouseLeave={stop} onTouchStart={start} onTouchEnd={stop} />;
}

function Elapsed({ since }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return <span>{Math.round((Date.now() - since) / 1000)} detik · biasanya 20–40 detik</span>;
}

const GEN_MODES = [
  { key: "karakter", name: "Karakter", hint: null }, // hint = the brand's character names
  { key: "variasi", name: "Variasi", hint: "pose lain dari gambar yang ada" },
  { key: "bebas", name: "Bebas", hint: "latar, benda, adegan" },
];

function Generator({ data, say, refId, setRefId }) {
  const g = data.imagegen ?? { characters: [], poses: [], ratios: [], ready: false };
  const [mode, setMode] = useState("karakter");
  const [char, setChar] = useState(g.characters[0]?.key ?? "");
  const [pose, setPose] = useState("wave");
  const [frame, setFrame] = useState("full");
  const [extra, setExtra] = useState("");
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState("9:16");
  const [cutout, setCutout] = useState(false);
  const [count, setCount] = useState(2);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (refId) setMode("variasi");
  }, [refId]);
  const images = [...data.media.filter((m) => m.kind === "image" && !m.mouth_of)].sort((a, b) => Boolean(b.char) - Boolean(a.char));
  const go = async () => {
    setBusy(true);
    try {
      await api("/api/media/generate", { method: "POST", body: { mode, char, pose: mode === "bebas" ? null : pose || null, frame, extra, prompt, ratio, cutout, count, refId } });
      say(count > 1 ? `Menggambar ${count} gambar…` : "Menggambar…");
    } catch (e) {
      say(e.message);
    }
    setBusy(false);
  };
  return (
    <div className="card gen">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Gambar anime (AI)</h2>
        <span className="pill">Qwen-Image</span>
      </div>
      {!g.ready && <p style={{ color: "#b91c1c" }}>DASHSCOPE_API_KEY belum ada di .env (folder utama repo)</p>}
      <div className="choice" style={{ marginTop: 14 }}>
        {GEN_MODES.map((m) => (
          <button key={m.key} className={mode === m.key ? "on" : ""} onClick={() => setMode(m.key)}>
            {m.name}
            <small>{m.hint ?? g.characters.map((c) => c.name).join(" / ")}</small>
          </button>
        ))}
      </div>

      {mode === "karakter" && (
        <>
          <label className="f">Karakter</label>
          <div className="choice">
            {g.characters.map((c) => (
              <button key={c.key} className={char === c.key ? "on" : ""} onClick={() => setChar(c.key)}>
                {c.name}
                <small>{c.hint}</small>
              </button>
            ))}
          </div>
        </>
      )}

      {mode === "variasi" && (
        <>
          <label className="f">Gambar referensi</label>
          {images.length === 0 ? (
            <div style={{ color: "var(--muted)" }}>Belum ada gambar. Buat karakter dulu di mode Karakter.</div>
          ) : (
            <div className="refs">
              {images.map((m) => (
                <button key={m.id} className={refId === m.id ? "on" : ""} onClick={() => setRefId(m.id)} title={m.note || m.filename}>
                  <img src={m.url} alt="" loading="lazy" className={m.cutout ? "cut" : ""} />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {mode !== "bebas" && (
        <>
          <label className="f">Pose & ekspresi</label>
          <div className="chips">
            {mode === "variasi" && (
              <button className={"tab" + (pose === "" ? " on" : "")} onClick={() => setPose("")}>
                Tetap
              </button>
            )}
            {g.poses.map((p) => (
              <button key={p.key} className={"tab" + (pose === p.key ? " on" : "")} onClick={() => setPose(p.key)}>
                {p.name}
              </button>
            ))}
          </div>
          {mode === "karakter" && (
            <>
              <label className="f">Bingkai</label>
              <div className="chips">
                {[
                  ["full", "Seluruh badan"],
                  ["half", "Setengah badan"],
                ].map(([k, name]) => (
                  <button key={k} className={"tab" + (frame === k ? " on" : "")} onClick={() => setFrame(k)}>
                    {name}
                  </button>
                ))}
              </div>
            </>
          )}
          <label className="f">{mode === "variasi" ? "Perubahan lain (opsional)" : "Tambahan (opsional)"}</label>
          <input className="in" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={mode === "variasi" ? "mis. pakai helm kuning & rompi oranye" : "mis. pakai helm kuning & rompi oranye, bawa tas peralatan"} />
        </>
      )}

      {mode === "bebas" && (
        <>
          <label className="f">Gambar apa?</label>
          <textarea className="in" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="mis. tiang listrik di jalan desa dengan kotak ODP hitam, sore hari" style={{ minHeight: 80 }} />
          <label className="f">Rasio</label>
          <div className="chips">
            {g.ratios.map((r) => (
              <button key={r} className={"tab" + (ratio === r ? " on" : "")} onClick={() => setRatio(r)}>
                {r}
              </button>
            ))}
            <button className={"tab" + (cutout ? " on" : "")} onClick={() => setCutout(!cutout)} style={{ marginLeft: 8 }}>
              {cutout ? "✓ " : ""}Background transparan
            </button>
          </div>
        </>
      )}

      <div className="row" style={{ marginTop: 18 }}>
        <span style={{ fontFamily: "var(--label)", fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>JUMLAH</span>
        <div className="chips">
          {[1, 2, 3, 4].map((n) => (
            <button key={n} className={"tab" + (count === n ? " on" : "")} onClick={() => setCount(n)}>
              {n}
            </button>
          ))}
        </div>
        <div className="grow" />
        <button className="btn blue" disabled={busy || !g.ready || (mode === "variasi" && !refId)} onClick={go}>
          {busy ? "Mengirim…" : "Gambar sekarang"}
        </button>
      </div>
    </div>
  );
}

function LogView({ lines }) {
  const ref = useRef();
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines.length]);
  return (
    <div className="log" ref={ref}>
      {lines.length === 0 ? "Menunggu output…" : lines.map((l, i) => <div key={i} className={l.startsWith("[") ? "tool" : l.startsWith("!") ? "err" : ""}>{l}</div>)}
    </div>
  );
}

/* ---------------- edit video (uploaded footage) ---------------- */
// Same keys as EDIT_OPTIONS in server/jobs.mjs, which turns them into instructions for Claude.
const EDIT_OPTIONS = [
  { key: "subtitle", name: "Subtitle per kata", hint: "dari transkrip Whisper, ejaan dirapikan" },
  { key: "potong", name: "Potong jeda & salah ucap", hint: "bagian kosong dibuang" },
  { key: "judul", name: "Judul hook di awal", hint: "sudah terlihat di frame pertama" },
  { key: "ikon", name: "Ikon & grafik", hint: "ikon jaringan, gauge, panah, logo aplikasi" },
  { key: "sosmed", name: "Ajakan follow + logo sosmed", hint: "akun dari profil brand" },
  { key: "sfx", name: "Efek suara", hint: "pop, notif, whoosh pelan" },
  { key: "zoom", name: "Zoom / sorot halus", hint: "1–3 momen terpenting" },
];
const EDIT_FORMATS = [
  { key: "portrait", name: "TikTok 9:16", hint: "vertikal" },
  { key: "landscape", name: "YouTube 16:9", hint: "layar lebar" },
  { key: "asli", name: "Ikuti video asli", hint: "sesuai orientasi rekaman" },
];
const fmtDur = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

function ClipCard({ m, on, onToggle }) {
  const [info, setInfo] = useState(null);
  return (
    <div className={"clip" + (on ? " sel" : "")}>
      <video src={m.url + "#t=0.5"} preload="metadata" muted playsInline controls onLoadedMetadata={(e) => setInfo({ d: e.target.duration, w: e.target.videoWidth, h: e.target.videoHeight })} />
      <label className="clipinfo">
        <input type="checkbox" checked={on} onChange={onToggle} />
        <span>
          <b>{m.note || m.filename}</b>
          <small>{info ? `${fmtDur(info.d)} · ${info.w > info.h ? "rebah (16:9)" : "berdiri (9:16)"} · ${fmtSize(m.size)}` : fmtSize(m.size)}</small>
        </span>
      </label>
    </div>
  );
}

function EditPage({ data, load, say, setPage }) {
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState(null);
  const [picked, setPicked] = useState([]);
  const [extras, setExtras] = useState([]);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [format, setFormat] = usePref("editFormat", "portrait");
  const [duration, setDuration] = usePref("editDurasi", 0);
  const [opts, setOpts] = usePref("editOpsi", ["subtitle", "potong", "judul"]);
  const [showPics, setShowPics] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef();
  const clips = data.media.filter((m) => m.kind === "video" && !m.mouth_of);
  const pics = data.media.filter((m) => m.kind === "image" && !m.mouth_of && !m.char);
  const recent = data.jobs.filter((j) => j.type === "edit").slice(0, 6);
  // Upload straight from this page; what was just uploaded is selected (videos) or attached (photos).
  const send = (files) => {
    files = files.filter((f) => /^(video|image)\//.test(f.type));
    if (!files.length) return say("Pilih file video (atau foto untuk ditempel di video)");
    const form = new FormData();
    for (const f of files) form.append("files", f);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media");
    xhr.upload.onprogress = (e) => setProgress(e.loaded / e.total);
    xhr.onload = async () => {
      setProgress(null);
      if (xhr.status !== 200) return say("Upload gagal: " + xhr.responseText.slice(0, 120));
      const ids = JSON.parse(xhr.responseText).ids ?? [];
      const vids = ids.filter((_, i) => files[i]?.type.startsWith("video"));
      const imgs = ids.filter((_, i) => files[i]?.type.startsWith("image"));
      setPicked((p) => [...p, ...vids]);
      if (imgs.length) setExtras((p) => [...p, ...imgs]), setShowPics(true);
      say(`${files.length} file terupload`);
      await load();
    };
    xhr.onerror = () => (setProgress(null), say("Upload gagal"));
    xhr.send(form);
  };
  const toggle = (list, set, id) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  return (
    <>
      <div className="kicker">06 · Edit video</div>
      <h1>
        Upload rekaman, <em>Claude yang edit.</em>
      </h1>
      <p className="sub">Video apa saja dari HP atau Mac: rekaman ngobrol, tutorial, kegiatan lapangan, klip lucu. Tulis maunya, Claude memotong, memberi subtitle per kata, judul, ikon dan grafik, ajakan follow, lalu hasilnya masuk ke halaman Video lengkap dengan cek QA.</p>
      <div className="editgrid">
        <section className="card">
          <h3>1 · Rekaman</h3>
          <div
            className={"drop" + (over ? " over" : "")}
            onClick={() => input.current.click()}
            onDragOver={(e) => (e.preventDefault(), setOver(true))}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => (e.preventDefault(), setOver(false), send([...e.dataTransfer.files]))}
          >
            <b>Upload video</b>
            <div style={{ color: "var(--muted)", marginTop: 6 }}>Tarik file ke sini, atau ketuk untuk pilih dari HP / Mac · maks 4 GB per file</div>
            <input ref={input} type="file" multiple accept="video/*,image/*" hidden onChange={(e) => (send([...e.target.files]), (e.target.value = ""))} />
            {progress !== null && (
              <div className="bar">
                <i style={{ width: `${progress * 100}%` }} />
              </div>
            )}
          </div>
          {clips.length ? (
            <div className="clipgrid">
              {clips.map((m) => (
                <ClipCard key={m.id} m={m} on={picked.includes(m.id)} onToggle={() => toggle(picked, setPicked, m.id)} />
              ))}
            </div>
          ) : (
            <div className="empty" style={{ marginTop: 14 }}>Belum ada video. Upload dulu.</div>
          )}
          <button className="btn small ghost" style={{ marginTop: 14 }} onClick={() => setShowPics(!showPics)}>
            {showPics ? "Sembunyikan" : "Tambah"} foto / logo untuk ditempel (opsional){extras.length ? ` · ${extras.length} dipilih` : ""}
          </button>
          {showPics && (
            <div style={{ marginTop: 12 }}>
              <MediaPicker media={pics} value={extras} onChange={setExtras} only="image" />
            </div>
          )}
        </section>
        <section className="card">
          <h3>2 · Mau diapakan?</h3>
          <label className="f">Judul (opsional)</label>
          <input className="in" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Misal: Teknisi pasang ONT di rumah pelanggan" />
          <label className="f">Instruksi untuk Claude</label>
          <textarea
            className="in"
            rows={5}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={"Contoh: ambil bagian waktu aku jelasin lampu modem, buang bagian aku salah ngomong di awal, kasih ikon router pas nyebut router, tutup dengan ajakan follow TikTok."}
          />
          <label className="f">Pilihan cepat</label>
          <div className="choice">
            {EDIT_OPTIONS.map((o) => (
              <button key={o.key} className={opts.includes(o.key) ? "on" : ""} onClick={() => toggle(opts, setOpts, o.key)}>
                {o.name}
                <small>{o.hint}</small>
              </button>
            ))}
          </div>
          <label className="f">Format hasil</label>
          <div className="choice">
            {EDIT_FORMATS.map((o) => (
              <button key={o.key} className={format === o.key ? "on" : ""} onClick={() => setFormat(o.key)}>
                {o.name}
                <small>{o.hint}</small>
              </button>
            ))}
          </div>
          <label className="f">Durasi</label>
          <div className="choice">
            {[0, 15, 30, 60].map((d) => (
              <button key={d} className={duration === d ? "on" : ""} onClick={() => setDuration(d)}>
                {d ? `±${d} detik` : "Ikuti isi"}
              </button>
            ))}
          </div>
          <div className="row" style={{ marginTop: 22 }}>
            <button
              className="btn blue"
              disabled={!picked.length || busy || progress !== null}
              onClick={async () => {
                setBusy(true);
                try {
                  await api("/api/jobs", { method: "POST", body: { type: "edit", title: title || "Edit video", mediaIds: [...picked, ...extras], instructions, format, duration: duration || null, options: opts } });
                  say("Masuk antrian, Claude Code mulai mengedit");
                  setPicked([]);
                  setExtras([]);
                  setInstructions("");
                  setTitle("");
                  await load();
                  setPage("antrian");
                } catch (e) {
                  say(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Kirim ke Claude Code
            </button>
            <span style={{ color: "var(--muted)", fontSize: 14 }}>{picked.length ? `${picked.length} rekaman dipilih` : "pilih minimal satu rekaman"}</span>
          </div>
        </section>
      </div>
      {recent.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <h3>Edit terakhir</h3>
          <div className="editjobs">
            {recent.map((j) => (
              <div key={j.id} className="editjob">
                <b>{j.title}</b>
                <span className={"pill " + j.status}>{JOB[j.status] ?? j.status}</span>
                {j.video_id ? (
                  <button className="btn small ghost" onClick={() => setPage("video")}>
                    Lihat hasil
                  </button>
                ) : j.status === "gagal" ? (
                  <small style={{ color: "#b91c1c" }}>{String(j.error ?? "").slice(0, 90)}</small>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function Jobs({ data, say, logs, setLogs, load }) {
  const [open, setOpen] = useState(() => data.jobs.find((j) => j.status === "jalan")?.id ?? null);
  useEffect(() => {
    if (!open || logs[open]) return;
    api(`/api/jobs/${open}`).then((j) => setLogs((l) => ({ ...l, [open]: (j.log ?? "").split("\n").filter(Boolean) })));
  }, [open]);
  return (
    <>
      <div className="kicker">07 · Antrian</div>
      <h1>
        Dapur <em>Claude Code.</em>
      </h1>
      <p className="sub">Setiap video dikerjakan Claude Code satu per satu: riset, naskah, suara, visual, cek frame, render. Satu video biasanya 10–25 menit.</p>
      {data.jobs.length === 0 && <div className="empty">Belum ada job.</div>}
      <div style={{ display: "grid", gap: 14 }}>
        {data.jobs.map((j) => (
          <div key={j.id} className="card job">
            <div>
              <div className="row">
                <span className={"pill " + j.status}>{JOB[j.status]}</span>
                <span className="pill">{j.type === "tes" ? "Tes" : j.type === "revisi" ? "Revisi" : j.type === "landscape" ? "Versi YouTube" : j.type === "edit" ? "Edit video" : KINDS.find((k) => k.key === j.input?.kind)?.name ?? "Video"}</span>
                {j.input?.duration ? <span className="pill">target {j.input.duration} detik</span> : j.input?.duration === null && <span className="pill">durasi bebas</span>}
              </div>
              <h3>{j.title}</h3>
              <div className="when">
                #{j.id} · dibuat {j.created_at}
                {j.finished_at ? ` · selesai ${j.finished_at}` : ""}
              </div>
              {j.error && <div style={{ color: "#b91c1c", marginTop: 6 }}>{j.error}</div>}
            </div>
            <div className="row">
              <button className="btn small ghost" onClick={() => setOpen(open === j.id ? null : j.id)}>
                {open === j.id ? "Tutup log" : "Log"}
              </button>
              {(j.status === "antri" || j.status === "jalan") && (
                <button
                  className="btn small danger"
                  onClick={async () => {
                    if (!confirm("Batalkan job ini?")) return;
                    await api(`/api/jobs/${j.id}/cancel`, { method: "POST" });
                    say("Dibatalkan");
                    load();
                  }}
                >
                  Batalkan
                </button>
              )}
            </div>
            {open === j.id && <LogView lines={logs[j.id] ?? []} />}
          </div>
        ))}
      </div>
    </>
  );
}

// Model chain for ideas & captions: "anthropic:<id>" = Anthropic API, anything else = 9router.
const PROVIDERS = { router: "9router", anthropic: "Anthropic" };
const parseChain = (text) =>
  String(text ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean)
    .map((m) => (m.startsWith("anthropic:") ? { provider: "anthropic", model: m.slice(10) } : { provider: "router", model: m }));
const chainText = (chain) =>
  chain
    .filter((r) => r.model)
    .map((r) => (r.provider === "anthropic" ? "anthropic:" : "") + r.model)
    .join(", ");

// Model lists for both providers; `version` > 0 asks the server to fetch them again (after a key change).
function useModelLists(version) {
  const [lists, setLists] = useState({ router: { loading: true }, anthropic: { loading: true } });
  useEffect(() => {
    let live = true;
    for (const p of Object.keys(PROVIDERS)) {
      setLists((l) => ({ ...l, [p]: { ...l[p], loading: true } }));
      api(`/api/llm/models?provider=${p}${version ? "&fresh=1" : ""}`)
        .then((r) => live && setLists((l) => ({ ...l, [p]: { models: r.models } })))
        .catch((e) => live && setLists((l) => ({ ...l, [p]: { error: e.message } })));
    }
    return () => {
      live = false;
    };
  }, [version]);
  return lists;
}

function ModelSelect({ provider, list, value, onChange }) {
  const models = list.models ?? [];
  const known = models.some((m) => m.id === value);
  const groups = provider === "router" ? [...new Set(models.map((m) => m.group || "lainnya"))] : [null];
  const label = (m) => (m.name ? `${m.name} · ${m.id}` : m.id);
  return (
    <select className="in" value={value} disabled={list.loading && !value} onChange={(e) => onChange(e.target.value)}>
      <option value="" disabled>
        {list.loading ? "Memuat daftar model…" : list.error ?? "Pilih model…"}
      </option>
      {value && !known && <option value={value}>{value}{list.models ? " (tidak ada di daftar)" : ""}</option>}
      {groups.map((g) =>
        g === null ? (
          models.map((m) => (
            <option key={m.id} value={m.id}>
              {label(m)}
            </option>
          ))
        ) : (
          <optgroup key={g} label={g}>
            {models
              .filter((m) => (m.group || "lainnya") === g)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {label(m)}
                </option>
              ))}
          </optgroup>
        ),
      )}
    </select>
  );
}

function ModelChain({ chain, setChain, lists }) {
  const put = (i, row) => setChain(chain.map((r, k) => (k === i ? row : r)));
  // A new provider starts on Claude Opus 5.5 when the Anthropic key has it, otherwise empty.
  const firstModel = (p) => (p === "anthropic" && lists.anthropic.models?.some((m) => m.id === "claude-opus-5-5") ? "claude-opus-5-5" : "");
  return (
    <div className="chain">
      {chain.map((r, i) => (
        <div key={i} className="chainrow">
          <span className="pill">{i === 0 ? "Utama" : `Cadangan ${i}`}</span>
          <select className="in prov" value={r.provider} onChange={(e) => put(i, { provider: e.target.value, model: firstModel(e.target.value) })}>
            {Object.entries(PROVIDERS).map(([k, n]) => (
              <option key={k} value={k}>
                {n}
              </option>
            ))}
          </select>
          <ModelSelect provider={r.provider} list={lists[r.provider]} value={r.model} onChange={(model) => put(i, { ...r, model })} />
          <button className="btn small ghost" disabled={i === 0} title="Coba lebih dulu" onClick={() => setChain(chain.map((x, k) => (k === i - 1 ? chain[i] : k === i ? chain[i - 1] : x)))}>
            ↑
          </button>
          <button className="btn small danger" disabled={chain.length === 1} onClick={() => setChain(chain.filter((_, k) => k !== i))}>
            Hapus
          </button>
        </div>
      ))}
      <button className="btn small ghost" onClick={() => setChain([...chain, { provider: "router", model: "" }])}>
        + Tambah cadangan
      </button>
    </div>
  );
}

function KeyStatus({ list }) {
  if (list.loading) return <span className="hint">Memeriksa…</span>;
  if (list.error) return <span className="hint keyerr">{list.error}</span>;
  return <span className="hint keyok">Tersambung · {list.models.length} model</span>;
}

function AiKeys({ data, load, say, lists, refresh }) {
  const k = data.ai_keys;
  const [f, setF] = useState({ router_base_url: k.router.base_url, router_api_key: "", anthropic_api_key: "" });
  const set = (key) => (e) => setF({ ...f, [key]: e.target.value });
  const dirty = f.router_base_url.trim() !== k.router.base_url.trim() || Boolean(f.router_api_key.trim() || f.anthropic_api_key.trim());
  const send = async (body, msg) => {
    try {
      await api("/api/settings", { method: "PATCH", body });
      setF((x) => ({ ...x, router_api_key: "", anthropic_api_key: "" }));
      say(msg);
      await load();
      refresh();
    } catch (e) {
      say(e.message);
    }
  };
  const clear = (key, name) => confirm(`Hapus API key ${name} dari studio?`) && send({ clear_keys: [key] }, `API key ${name} dihapus`);
  return (
    <div className="card">
      <div className="fgrid">
        <div>
          <label className="f">9router · Base URL</label>
          <input className="in" placeholder={k.router.env_base_url || "https://…/v1"} value={f.router_base_url} onChange={set("router_base_url")} />
          <p className="hint">Kosong = pakai ROUTER_BASE_URL dari .env.</p>
        </div>
        <div>
          <label className="f">9router · API key</label>
          <input
            className="in"
            type="password"
            autoComplete="off"
            placeholder={k.router.has_key ? "tersimpan (isi untuk mengganti)" : k.router.env_key ? "memakai ROUTER_API_KEY dari .env" : ""}
            value={f.router_api_key}
            onChange={set("router_api_key")}
          />
          <div className="row keyrow">
            <KeyStatus list={lists.router} />
            {k.router.has_key && (
              <button className="linkbtn" onClick={() => clear("router_api_key", "9router")}>
                Hapus key
              </button>
            )}
          </div>
        </div>
        <div className="full">
          <label className="f">Anthropic · API key</label>
          <input className="in" type="password" autoComplete="off" placeholder={k.anthropic.has_key ? "tersimpan (isi untuk mengganti)" : "sk-ant-…"} value={f.anthropic_api_key} onChange={set("anthropic_api_key")} />
          <div className="row keyrow">
            {k.anthropic.has_key ? <KeyStatus list={lists.anthropic} /> : <span className="hint">Dari console.anthropic.com. Hanya dipakai untuk ide & caption, bukan untuk job video.</span>}
            {k.anthropic.has_key && (
              <button className="linkbtn" onClick={() => clear("anthropic_api_key", "Anthropic")}>
                Hapus key
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="savebar">
        <button className="btn blue" disabled={!dirty} onClick={() => send(f, "Kunci API tersimpan")}>
          Simpan kunci
        </button>
        {dirty && <span className="unsaved">Belum disimpan</span>}
        <span className="grow" />
        <button className="btn ghost" onClick={refresh}>
          Muat ulang daftar model
        </button>
      </div>
    </div>
  );
}

const BRAND_KEYS = ["brand_profile"];
const AI_KEYS = ["llm_models"];
const VIDEO_KEYS = ["claude_model", "tts_daily_limit", "permission_mode"];
// Pengaturan tabs. Every panel stays mounted (only hidden), so unsaved edits survive a tab switch.
const SETTINGS_TABS = [
  ["brand", "Profil brand"],
  ["ai", "Model AI"],
  ["video", "Job video & suara"],
  ["tiktok", "TikTok"],
  ["hp", "Akses HP"],
];
function Settings({ data, load, say }) {
  const [s, setS] = useState(data.settings);
  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });
  const [chain, setChainRows] = useState(() => parseChain(data.settings.llm_models));
  const setChain = (rows) => {
    setChainRows(rows);
    setS((x) => ({ ...x, llm_models: chainText(rows) }));
  };
  const [listVersion, setListVersion] = useState(0);
  const lists = useModelLists(listVersion);
  const [tab, setTab] = usePref("atur.tab", "brand");
  const dirty = (keys) => keys.some((k) => String(s[k]).trim() !== String(data.settings[k]).trim());
  const tabDirty = { brand: dirty(BRAND_KEYS), ai: dirty(AI_KEYS), video: dirty(VIDEO_KEYS) };
  const save = async (keys) => {
    try {
      await api("/api/settings", { method: "PATCH", body: Object.fromEntries(keys.map((k) => [k, s[k]])) });
      say("Tersimpan");
      load();
    } catch (e) {
      say(e.message);
    }
  };
  return (
    <div className="settings">
      <div className="kicker">08 · Pengaturan</div>
      <h1>
        Atur <em>studio.</em>
      </h1>
      <div className="tabs settabs">
        {SETTINGS_TABS.map(([k, n]) => (
          <button key={k} className={"tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>
            {n}
            {tabDirty[k] && <span className="dot" title="Belum disimpan" />}
          </button>
        ))}
      </div>

      <section hidden={tab !== "brand"}>
        <div className="card">
          <p className="hint" style={{ marginTop: 0 }}>
            Sumber fakta untuk ide, caption, dan video. AI hanya boleh memakai fakta yang tertulis di sini.
          </p>
          <textarea className="in brandtext" value={s.brand_profile} onChange={set("brand_profile")} />
          <div className="savebar">
            <button className="btn blue" disabled={!dirty(BRAND_KEYS)} onClick={() => save(BRAND_KEYS)}>
              Simpan profil
            </button>
            {dirty(BRAND_KEYS) && <span className="unsaved">Belum disimpan</span>}
            <span className="grow" />
            <span className="hint">{s.brand_profile.split("\n").length} baris · {s.brand_profile.length.toLocaleString("id-ID")} karakter</span>
          </div>
        </div>
      </section>

      <section hidden={tab !== "ai"}>
        <AiKeys data={data} load={load} say={say} lists={lists} refresh={() => setListVersion((v) => v + 1)} />
        <div className="card">
          <label className="f">Model AI untuk ide & caption</label>
          <ModelChain chain={chain} setChain={setChain} lists={lists} />
          <p className="hint">Dicoba berurutan: kalau model utama gagal, lanjut ke cadangan berikutnya.</p>
          <div className="savebar">
            <button className="btn blue" disabled={!dirty(AI_KEYS) || !s.llm_models} onClick={() => save(AI_KEYS)}>
              Simpan model
            </button>
            {dirty(AI_KEYS) && <span className="unsaved">{s.llm_models ? "Belum disimpan" : "Pilih minimal satu model AI"}</span>}
          </div>
        </div>
      </section>

      <section hidden={tab !== "video"}>
        {data.tts && <VoiceQuota tts={data.tts} />}
        <div className="card">
          <div className="fgrid">
            <div>
              <label className="f">Model Claude Code untuk video</label>
              <input className="in" placeholder="misal: opus atau sonnet" value={s.claude_model} onChange={set("claude_model")} />
              <p className="hint">Kosong = bawaan Claude Code.</p>
            </div>
            <div>
              <label className="f">Batas suara Gemini per hari</label>
              <input className="in" type="number" min="1" max="1000" value={s.tts_daily_limit} onChange={set("tts_daily_limit")} />
              <p className="hint">Per model per key. Dipakai menghitung kuota di atas.</p>
            </div>
            <div className="full">
              <label className="f">Izin Claude Code saat jalan otomatis</label>
              <select className="in" value={s.permission_mode} onChange={set("permission_mode")}>
                <option value="bypassPermissions">Penuh (bypassPermissions): perlu supaya bisa jalan tanpa ditunggui</option>
                <option value="acceptEdits">Hanya edit file (acceptEdits): perintah terminal bisa tertahan</option>
              </select>
            </div>
          </div>
          <div className="savebar">
            <button className="btn blue" disabled={!dirty(VIDEO_KEYS)} onClick={() => save(VIDEO_KEYS)}>
              Simpan
            </button>
            {dirty(VIDEO_KEYS) && <span className="unsaved">Belum disimpan</span>}
            <span className="grow" />
            <button
              className="btn ghost"
              onClick={async () => {
                try {
                  await api("/api/jobs", { method: "POST", body: { type: "tes" } });
                  say("Tes dikirim, cek menu Antrian");
                  load();
                } catch (e) {
                  say(e.message);
                }
              }}
            >
              Tes koneksi Claude Code
            </button>
          </div>
        </div>
      </section>

      <section hidden={tab !== "tiktok"}>
        <TikTokSettings data={data} load={load} say={say} />
      </section>

      <section hidden={tab !== "hp"}>
        <div className="card">
          <p className="hint" style={{ marginTop: 0 }}>
            Buka salah satu alamat ini di browser HP yang tersambung ke WiFi yang sama, lalu masukkan PIN dari file <code>studio/data/pin.txt</code> di Mac. Di Mac ini sendiri tidak perlu PIN.
          </p>
          {data.lan.length === 0 && <p className="hint">Mac sedang tidak tersambung ke jaringan.</p>}
          {data.lan.map((u) => (
            <div key={u} className="lanrow">
              <span>{u}</span>
              <button className="btn small ghost" onClick={() => copy(u).then(() => say("Alamat disalin"))}>
                Salin
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ---------------- cover mode & voice quota ---------------- */
// Cover system (19 Oct 2026): one brand palette and three fonts for every video; the mode only sets
// the cover colours and series tag. "auto" lets the server pick it from the pillar.
function ModePicker({ modes, value, onChange, pillar }) {
  const auto = modes.find((m) => m.pillars?.includes(pillar));
  return (
    <>
      <label className="f">Mode sampul</label>
      <div className="looks">
        <button className={"look" + (value.mode === "auto" ? " on" : "")} onClick={() => onChange({ mode: "auto" })}>
          <span className="sw">
            {(auto?.swatch ?? ["#e5e7eb", "#cbd5e1", "#94a3b8"]).map((c, i) => (
              <i key={i} style={{ background: c }} />
            ))}
          </span>
          <b>Otomatis</b>
          <small>{auto ? `dari pilar: ${auto.name}` : "dipilih dari pilar/topik"}</small>
        </button>
        {modes.map((m) => (
          <button key={m.key} className={"look" + (value.mode === m.key ? " on" : "")} onClick={() => onChange({ mode: m.key })}>
            <span className="sw">
              {m.swatch.map((c, i) => (
                <i key={i} style={{ background: c }} />
              ))}
            </span>
            <b>{m.name}</b>
            <small>{m.hint}</small>
          </button>
        ))}
      </div>
      <p className="sub" style={{ margin: "8px 0 0", fontSize: 13 }}>Palet brand dan font sama untuk semua video; mode hanya mengatur warna sampul dan label seri.</p>
    </>
  );
}

// "Rate limit exceeded ... (limit: 10 requests per day on Free Tier)" → "batas 10 request/hari"
const shortTtsError = (e) => {
  const day = e.match(/limit: (\d+) requests? per day/i);
  return day ? `batas ${day[1]} request/hari` : e.length > 80 ? e.slice(0, 80) + "…" : e;
};
const wib = (iso) => new Date(iso).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });
function VoiceQuota({ tts, compact }) {
  const [check, setCheck] = useState(null);
  const [busy, setBusy] = useState(false);
  if (compact) {
    const [flash, lite] = tts.models;
    const low = tts.videosLeft < 1;
    return (
      <p className="sub" style={{ margin: "16px 0 0", fontSize: 14, color: low ? "#b91c1c" : undefined }}>
        Kuota suara Gemini hari ini: Flash sisa {flash.left}/{flash.limit} · Flash-Lite sisa {lite.left}/{lite.limit} · cukup ±{tts.videosLeft} video dialog · reset {wib(tts.reset)} WIB
        {low && ". Kemungkinan suaranya gagal sampai reset."}
      </p>
    );
  }
  return (
    <div className="card quota">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <b style={{ fontSize: 20 }}>Kuota suara Gemini hari ini</b>
          <div className="hint">
            Cukup ±{tts.videosLeft} video dialog (2 suara per video) · reset {wib(tts.reset)} WIB{tts.keyCount > 1 ? ` · ${tts.keyCount} key, pindah otomatis kalau satu habis` : ""}
          </div>
        </div>
        <button
          className="btn small ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setCheck(await api("/api/tts/check", { method: "POST" }));
            } catch (e) {
              setCheck({ ok: false, error: e.message, models: [] });
            }
            setBusy(false);
          }}
        >
          {busy ? "Mengecek…" : "Cek koneksi"}
        </button>
      </div>
      {tts.models.map((m) => (
        <div key={m.model} className="qrow">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>
              <b>{m.label}</b> <span className="mono">{m.model}</span>
            </span>
            <span className={"pill " + (m.exhausted ? "gagal" : m.left <= 2 ? "antri" : "selesai")}>{m.exhausted ? "Habis" : `${m.left} sisa`}</span>
          </div>
          <div className="bar">
            <i style={{ width: `${Math.min(100, (m.used / m.limit) * 100)}%`, background: m.exhausted ? "#dc2626" : m.left <= 2 ? "#d97706" : "var(--cobalt)" }} />
          </div>
          <div className="hint">
            terpakai {m.used} dari ±{m.limit} request
            {m.keys?.length > 1 && ` · ${m.keys.map((k) => `key ${k.key}: ${k.exhausted ? "habis" : `${k.used}/${tts.limit}`}`).join(" · ")}`}
            {m.lastError && (
              <span title={m.lastError}>
                {" "}
                · terakhir ditolak: {shortTtsError(m.lastError)}
              </span>
            )}
          </div>
        </div>
      ))}
      {check && (
        <div className="hint" style={{ marginTop: 12, color: check.ok ? "#166534" : "#b91c1c" }}>
          {check.ok
            ? `${check.keyCount > 1 ? `Semua ${check.keyCount} key` : "Key"} Gemini aktif, kedua model TTS bisa diakses.`
            : (check.error ?? check.models.filter((m) => !m.ok).map((m) => `key ${m.key} ${m.label}: ${m.error}`).join(" · "))}
        </div>
      )}
      <div className="hint foot">
        Google tidak menyediakan angka sisa kuota, jadi ini hitungan dari catatan studio{tts.since ? ` sejak ${new Date(tts.since).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}` : ""}; request yang ditolak "per day" langsung ditandai habis.
      </div>
    </div>
  );
}

/* ---------------- modals ---------------- */
function MediaPicker({ media, value, onChange, only }) {
  const list = media.filter((m) => !m.mouth_of && (!only || m.kind === only));
  if (list.length === 0) return <div style={{ color: "var(--muted)" }}>Belum ada media. Upload dulu di menu Media.</div>;
  return (
    <div className="mgrid" style={{ marginTop: 0, gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))" }}>
      {list.map((m) => (
        <div key={m.id} className={"mitem" + (value.includes(m.id) ? " sel" : "")} onClick={() => onChange(value.includes(m.id) ? value.filter((x) => x !== m.id) : [...value, m.id])} style={{ cursor: "pointer" }}>
          {m.kind === "video" ? <video src={m.url + "#t=0.5"} preload="metadata" muted playsInline /> : <img src={m.url} alt="" className={m.cutout ? "cut" : ""} />}
          <div className="info" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.note || m.filename}</div>
        </div>
      ))}
    </div>
  );
}

function CreateVideo({ data, idea, close, say, load, setPage }) {
  const [title, setTitle] = useState(idea?.title ?? "");
  const [kind, setKind] = useState("edukasi");
  const [brief, setBrief] = useState("");
  // Remembered per browser (it used to reset to 30 every time, 9 Oct 2026: a 60 s pick was lost).
  // 0 = "Bebas" (18 Oct 2026): no target, the length follows the content and QA only reports it.
  const [duration, setDuration] = usePref("durasi", 60);
  const [mediaIds, setMediaIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [look, setLook] = useState({ mode: "auto" });
  const [wide, setWide] = useState(false);
  const [pillar, setPillar] = useState(idea?.pillar ?? "");
  const needsVideo = kind === "klip" && !mediaIds.some((id) => data.media.find((m) => m.id === id)?.kind === "video");
  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="card">
        <h2>Buat video</h2>
        <label className="f">Judul / ide</label>
        <input className="in" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Misal: Kenapa internet lemot pas hujan?" />
        {idea && <div style={{ fontFamily: "var(--serif)", fontSize: 20, color: "var(--cobalt)", marginTop: 8 }}>“{idea.hook}”</div>}
        <label className="f">Jenis video</label>
        <div className="choice">
          {KINDS.map((k) => (
            <button key={k.key} className={kind === k.key ? "on" : ""} onClick={() => setKind(k.key)}>
              {k.name}
              <small>{k.hint}</small>
            </button>
          ))}
        </div>
        <label className="f">Pilar konten</label>
        <select className="in" value={pillar} onChange={(e) => setPillar(e.target.value)}>
          <option value="">Otomatis dari judul (bukan tentang {data.brand?.name ?? "brand"} = tanpa promosi)</option>
          {Object.entries(data.pillars ?? {}).map(([k, n]) => (
            <option key={k} value={k}>
              {n}
              {k === "brand" ? " (promosi & layanan)" : " (edukasi umum, tanpa promosi)"}
            </option>
          ))}
        </select>
        <label className="f">Brief / catatan tambahan (opsional)</label>
        <textarea className="in" value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Poin wajib, gaya, larangan, karakter yang dipakai…" />
        <label className="f">Target durasi</label>
        <div className="choice">
          {[20, 30, 45, 60, 90, 0].map((d) => (
            <button key={d} className={duration === d ? "on" : ""} onClick={() => setDuration(d)}>
              {d ? `${d} detik` : "Bebas"}
            </button>
          ))}
        </div>
        {!duration && <p className="sub" style={{ margin: "10px 0 0", fontSize: 14 }}>Tanpa target: panjangnya mengikuti isi dan boleh lebih dari 60 detik. QA hanya mencatat durasinya; tempo bicara tetap santai.</p>}
        {kind !== "klip" && data.looks?.modes && <ModePicker modes={data.looks.modes} value={look} onChange={setLook} pillar={pillar} />}
        <label className="f">Lampirkan media {kind === "klip" ? "(wajib pilih video)" : "(opsional)"}</label>
        <MediaPicker media={data.media} value={mediaIds} onChange={setMediaIds} only={kind === "klip" ? "video" : null} />
        {kind === "klip" && <p className="sub" style={{ margin: "12px 0 0", fontSize: 14 }}>Mau edit dengan instruksi lengkap (potong, subtitle, ikon, ajakan follow)? Pakai halaman Edit video.</p>}
        {kind !== "klip" && (
          <label className="check">
            <input type="checkbox" checked={wide} onChange={(e) => setWide(e.target.checked)} />
            <span>
              <b>Sekalian buat versi YouTube 16:9</b>
              <small>Setelah video TikTok jadi, job kedua menata ulang scene untuk layar lebar dan memakai suara yang sama (tanpa kuota Gemini tambahan).</small>
            </span>
          </label>
        )}
        {data.tts && <VoiceQuota tts={data.tts} compact />}
        <div className="row" style={{ marginTop: 22 }}>
          <button
            className="btn blue"
            disabled={!title || busy || needsVideo}
            onClick={async () => {
              setBusy(true);
              try {
                await api("/api/jobs", { method: "POST", body: { title, kind, brief, duration: duration || null, mediaIds, ideaId: idea?.id, look, wide: wide && kind !== "klip", pillar } });
                say("Masuk antrian, Claude Code mulai bekerja");
                close();
                await load();
                setPage("antrian");
              } catch (e) {
                say(e.message);
                setBusy(false);
              }
            }}
          >
            Kirim ke Claude Code
          </button>
          <button className="btn ghost" onClick={close}>
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}

function Revise({ data, video, close, say, load, setPage }) {
  const [feedback, setFeedback] = useState("");
  const [mediaIds, setMediaIds] = useState([]);
  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="card">
        <h2>Revisi: {video.title}</h2>
        <label className="f">Apa yang mau diubah?</label>
        <textarea className="in" autoFocus value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Misal: scene 3 terlalu cepat, ganti warna latar scene 5, kata 'ODP' kurang jelas…" />
        <label className="f">Tambah media (opsional)</label>
        <MediaPicker media={data.media} value={mediaIds} onChange={setMediaIds} />
        <div className="row" style={{ marginTop: 22 }}>
          <button
            className="btn blue"
            disabled={!feedback.trim()}
            onClick={async () => {
              await api("/api/jobs", { method: "POST", body: { type: "revisi", videoId: video.id, feedback, mediaIds } });
              say("Revisi masuk antrian");
              close();
              await load();
              setPage("antrian");
            }}
          >
            Kirim revisi
          </button>
          <button className="btn ghost" onClick={close}>
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}

function TikTokSettings({ data, load, say }) {
  const tt = data.tiktok;
  const saved = { tiktok_client_key: tt.client_key, tiktok_client_secret: "", tiktok_redirect_uri: tt.redirect_uri, tiktok_scopes: tt.scopes };
  const [f, setF] = useState(saved);
  const [code, setCode] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const dirty = Object.keys(saved).some((k) => String(f[k]).trim() !== String(saved[k]).trim());
  return (
    <>
      <div className="card">
        <div className="row">
          {tt.connected ? (
            <>
              <span className="pill selesai">Tersambung</span>
              <b>{tt.user?.name ?? "akun TikTok"}</b>
            </>
          ) : (
            <span className="pill">{tt.configured ? "Belum login" : "Belum diatur"}</span>
          )}
          <span className="grow" />
          {tt.configured &&
            data.local &&
            (dirty ? (
              <button className="btn small sun" disabled title="Simpan perubahan dulu">
                {tt.connected ? "Login ulang" : "Sambungkan akun TikTok"}
              </button>
            ) : (
              <a className="btn small sun" href="/api/tiktok/login" style={{ textDecoration: "none" }}>
                {tt.connected ? "Login ulang" : "Sambungkan akun TikTok"}
              </a>
            ))}
          {tt.connected && (
            <button
              className="btn small danger"
              onClick={async () => {
                if (!confirm("Putuskan akun TikTok dari studio?")) return;
                await api("/api/tiktok/disconnect", { method: "POST" });
                load();
              }}
            >
              Putuskan
            </button>
          )}
        </div>
        {tt.configured && !data.local && <p className="hint">Login TikTok dilakukan dari Mac (localhost:4321).</p>}

        <div className="fgrid" style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
          <div>
            <label className="f">Client Key</label>
            <input className="in" value={f.tiktok_client_key} onChange={set("tiktok_client_key")} />
          </div>
          <div>
            <label className="f">Client Secret</label>
            <input className="in" type="password" placeholder={tt.has_secret ? "tersimpan (isi untuk mengganti)" : ""} value={f.tiktok_client_secret} onChange={set("tiktok_client_secret")} />
          </div>
          <div className="full">
            <label className="f">Redirect URI</label>
            <input className="in" placeholder="https://domainkamu/tiktok-callback.html" value={f.tiktok_redirect_uri} onChange={set("tiktok_redirect_uri")} />
            <p className="hint">Halaman tiktok-callback.html di domain kamu, wajib https.</p>
          </div>
          <div className="full">
            <label className="f">Izin yang diminta</label>
            <select className="in" value={f.tiktok_scopes} onChange={set("tiktok_scopes")}>
              <option value="user.info.basic,video.upload">Draf saja: user.info.basic, video.upload (disarankan)</option>
              <option value="user.info.basic,video.upload,video.publish">Draf + posting langsung: tambah video.publish</option>
            </select>
          </div>
        </div>
        <div className="savebar">
          <button
            className="btn blue"
            disabled={!dirty}
            onClick={async () => {
              try {
                await api("/api/settings", { method: "PATCH", body: f });
                setF({ ...f, tiktok_client_secret: "" });
                say("Pengaturan TikTok tersimpan");
                load();
              } catch (e) {
                say(e.message);
              }
            }}
          >
            Simpan
          </button>
          {dirty && <span className="unsaved">Belum disimpan</span>}
        </div>

        {tt.configured && (
          <details className="more">
            <summary>Halaman callback tidak berpindah? Tempel kodenya di sini</summary>
            <div className="row" style={{ marginTop: 10 }}>
              <input className="in grow" value={code} onChange={(e) => setCode(e.target.value)} placeholder="kode dari halaman callback" />
              <button
                className="btn"
                disabled={!code}
                onClick={async () => {
                  try {
                    await api("/api/tiktok/code", { method: "POST", body: { code } });
                    setCode("");
                    say("Akun TikTok tersambung");
                    load();
                  } catch (e) {
                    say(e.message);
                  }
                }}
              >
                Sambungkan
              </button>
            </div>
          </details>
        )}
      </div>
    </>
  );
}
