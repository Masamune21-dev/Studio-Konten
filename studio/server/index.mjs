import fs from "node:fs";
import path from "node:path";
import express from "express";
import multer from "multer";
import { DATA, MEDIA, OUTPUT, PIN, PORT, ROOT, STUDIO, lanUrls } from "./config.mjs";
import { all, get, parse, run, setting, setSetting } from "./db.mjs";
import { chatJson, cleanTags, DEFAULT_MODELS, keyStatus, listModels } from "./llm.mjs";
import { cancel, emit, enqueue, onEvent, resume, enqueueLandscape } from "./jobs.mjs";
import { IDEA_SYSTEM, PILLARS, pillarNote, planIdeas, planText, profileSections } from "./content.mjs";
import { imageOptions, pendingTasks, startGenerate, startMouths } from "./imagegen.mjs";
import { checkTts, ttsStatus } from "./tts.mjs";
import { coverModes, resolveLook } from "./looks.mjs";
import { seed } from "./seed.mjs";
import * as tiktok from "./tiktok.mjs";
import * as comments from "./comments.mjs";
import { BRAND } from "../../scripts/brand.mjs";

seed();
const app = express();
app.use(express.json({ limit: "2mb" }));

/* ---------- auth: this Mac is trusted, other devices need the PIN ---------- */
const isLocal = (req) => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress);
const cookie = (req, name) => (req.headers.cookie ?? "").split(";").map((c) => c.trim().split("=")).find(([k]) => k === name)?.[1];
app.post("/api/login", (req, res) => {
  if (String(req.body?.pin) !== PIN) return res.status(401).json({ error: "PIN salah" });
  res.setHeader("Set-Cookie", `studio_pin=${PIN}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 24 * 90}`);
  res.json({ ok: true });
});
app.use(["/api", "/files"], (req, res, next) => {
  if (isLocal(req) || cookie(req, "studio_pin") === PIN) return next();
  res.status(401).json({ error: "login" });
});

// Catches sync throws too, since fn runs inside the promise chain.
const wrap = (fn) => (req, res) => Promise.resolve().then(() => fn(req, res)).catch((e) => res.status(500).json({ error: e.message }));
const toUrl = (p) => (p && p.startsWith(ROOT) ? "/files/" + path.relative(ROOT, p).split(path.sep).map(encodeURIComponent).join("/") : null);
// QA report from `npm run qa` in the project (out/qa for TikTok, out/qa-yt for YouTube). It is
// "stale" when the MP4 was rendered again after the check.
const qaOut = (v) => {
  if (!v.project_dir) return null;
  const dir = path.join(v.project_dir, v.orientation === "landscape" ? "out/qa-yt" : "out/qa");
  try {
    const r = JSON.parse(fs.readFileSync(path.join(dir, "report.json"), "utf8"));
    const rendered = fs.existsSync(v.path) ? fs.statSync(v.path).mtimeMs : 0;
    const bust = `?t=${Date.parse(r.at)}`;
    return {
      status: r.status,
      at: r.at,
      stale: rendered > Date.parse(r.at) + 5000,
      checks: r.checks ?? [],
      sheet: (r.sheet ?? []).map((x) => ({ scene: x.scene, url: toUrl(path.join(v.project_dir, x.file)) + bust })),
    };
  } catch {
    return null;
  }
};
const videoOut = (v) => ({ ...parse(v), url: toUrl(v.path), exists: fs.existsSync(v.path), qa: qaOut(v) });
const mediaOut = (m) => ({ ...m, url: toUrl(m.path) });

/* ---------- state ---------- */
app.get(
  "/api/state",
  wrap((req, res) => {
    res.json({
      ideas: all("SELECT * FROM ideas ORDER BY CASE status WHEN 'produksi' THEN 0 WHEN 'ide' THEN 1 WHEN 'selesai' THEN 2 WHEN 'upload' THEN 3 ELSE 4 END, id").map(parse),
      videos: all("SELECT * FROM videos ORDER BY id DESC").map(videoOut),
      media: all("SELECT * FROM media ORDER BY id DESC").map(mediaOut),
      jobs: all("SELECT id, type, status, title, input, session_id, error, video_id, idea_id, created_at, started_at, finished_at FROM jobs ORDER BY id DESC LIMIT 50").map(parse),
      settings: {
        brand_profile: setting("brand_profile", ""),
        llm_models: setting("llm_models", DEFAULT_MODELS),
        claude_model: setting("claude_model", ""),
        permission_mode: setting("permission_mode", "bypassPermissions"),
        tts_daily_limit: setting("tts_daily_limit", "10"),
      },
      brand: { name: BRAND.name, outfit: BRAND.outfit ?? "" },
      ai_keys: keyStatus(),
      tiktok: tiktok.publicStatus(),
      comments: comments.summary(),
      imagegen: { ...imageOptions(), tasks: pendingTasks() },
      tts: ttsStatus(),
      looks: { modes: coverModes() },
      pillars: Object.fromEntries(Object.entries(PILLARS).map(([k, p]) => [k, p.name])),
      lan: lanUrls(),
      local: isLocal(req),
    });
  }),
);

app.patch(
  "/api/settings",
  wrap((req, res) => {
    for (const k of ["brand_profile", "llm_models", "claude_model", "permission_mode", "tts_daily_limit", "tiktok_client_key", "tiktok_redirect_uri", "tiktok_scopes", "router_base_url"]) if (k in req.body) setSetting(k, String(req.body[k]).trim());
    // Secrets are write-only: never sent back to the browser, only replaced when given or cleared.
    for (const k of ["tiktok_client_secret", "router_api_key", "anthropic_api_key"]) if (req.body[k]) setSetting(k, String(req.body[k]).trim());
    for (const k of req.body.clear_keys ?? []) if (["router_api_key", "anthropic_api_key"].includes(k)) setSetting(k, "");
    res.json({ ok: true });
  }),
);

// Models the key can use, for the dropdowns in Pengaturan (provider: router | anthropic).
app.get(
  "/api/llm/models",
  wrap(async (req, res) => {
    try {
      res.json({ models: await listModels(String(req.query.provider), req.query.fresh === "1") });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }),
);

/* ---------- ideas ---------- */

// One idea per { pillar, format } slot of the plan, written to the idea bank. Also used for reply
// ideas from the Komentar page, with the comment as the theme.
async function generateIdeas(plan, themeText) {
  const count = plan.length;
  const existing = all("SELECT title FROM ideas ORDER BY id DESC LIMIT 60").map((r) => "- " + r.title).join("\n");
  // The full profile only when a brand-pillar idea is planned; otherwise it pulls every idea toward the brand.
  const about = plan.some((s) => s.pillar === "brand")
    ? `Profil brand (sumber fakta untuk pilar "brand"):\n${setting("brand_profile", "")}`
    : `Tentang akun dan gaya bahasanya:\n${profileSections(["IDENTITAS", "NADA & GAYA"])}`;
  const theme = themeText ? `Tema dari user: ${themeText}. Terapkan ke semua ide; kalau tema tidak cocok dengan pilar di rencana, utamakan tema.\n\n` : "";
  const { data, model } = await chatJson(
    IDEA_SYSTEM,
    `${about}\n\nJudul yang sudah ada (jangan ulang topiknya, jangan tiru pola judulnya):\n${existing}\n\n${theme}Buat ${count} ide konten TikTok baru (30–60 detik) yang bisa dibuat sebagai video motion graphic dengan karakter anime dan ilustrasi, mengikuti rencana ini (satu ide per baris):\n${planText(plan)}\n\nFormat JSON:\n{"ideas":[{"slot":1,"pillar":"<kunci pilar>","bentuk":"<kunci bentuk>","title":"...","hook":"kalimat 3 detik pertama","outline":["poin",...],"format":"gaya visual singkat","riset":false,"caption":"caption tanpa hashtag","hashtags":["#..."]}]}`,
  );
  const ids = (data.ideas ?? []).map((i, k) => {
    const slot = plan[(Number(i.slot) || k + 1) - 1] ?? plan[k] ?? {};
    const pillar = PILLARS[i.pillar] ? i.pillar : slot.pillar ?? null;
    return Number(
      run(
        "INSERT INTO ideas (title, hook, outline, format, caption, hashtags, pillar, bentuk, riset) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        i.title,
        i.hook ?? "",
        JSON.stringify(i.outline ?? []),
        i.format ?? "",
        i.caption ?? "",
        JSON.stringify(cleanTags(i.hashtags)),
        pillar,
        i.bentuk ?? slot.format ?? null,
        i.riset ? 1 : 0,
      ).lastInsertRowid,
    );
  });
  return { model, ids };
}
app.post(
  "/api/ideas/generate",
  wrap(async (req, res) => {
    const count = Math.min(10, Math.max(1, Number(req.body?.count ?? 5)));
    res.json({ ok: true, ...(await generateIdeas(planIdeas(count, req.body?.pillars ?? []), req.body?.theme)) });
  }),
);

app.post(
  "/api/ideas",
  wrap((req, res) => {
    const b = req.body ?? {};
    const id = Number(run("INSERT INTO ideas (title, hook, outline, format) VALUES (?, ?, ?, ?)", b.title ?? "Ide baru", b.hook ?? "", JSON.stringify(b.outline ?? []), b.format ?? "").lastInsertRowid);
    res.json({ id });
  }),
);

app.patch(
  "/api/ideas/:id",
  wrap((req, res) => {
    const b = req.body ?? {};
    for (const k of ["title", "hook", "format", "caption", "status", "pillar"]) if (k in b) run(`UPDATE ideas SET ${k} = ?, updated_at = datetime('now','localtime') WHERE id = ?`, String(b[k]), req.params.id);
    if ("outline" in b) run("UPDATE ideas SET outline = ? WHERE id = ?", JSON.stringify(b.outline), req.params.id);
    if ("hashtags" in b) run("UPDATE ideas SET hashtags = ? WHERE id = ?", JSON.stringify(cleanTags(b.hashtags)), req.params.id);
    res.json({ ok: true });
  }),
);
app.delete(
  "/api/ideas/:id",
  wrap((req, res) => {
    if (get("SELECT id FROM jobs WHERE idea_id = ? AND status IN ('antri', 'jalan')", req.params.id)) return res.status(409).json({ error: "Ide ini sedang diproduksi, batalkan job-nya dulu di Antrian" });
    // Videos made from this idea stay; their idea_id just points nowhere.
    run("DELETE FROM ideas WHERE id = ?", req.params.id);
    res.json({ ok: true });
  }),
);

/* ---------- captions ---------- */
app.post(
  "/api/caption",
  wrap(async (req, res) => {
    const { ideaId, videoId, note } = req.body ?? {};
    let context = "";
    let pillar = null;
    if (videoId) {
      const v = get("SELECT * FROM videos WHERE id = ?", videoId);
      const script = v?.project_dir && path.join(v.project_dir, "src/script.json");
      const vo = script && fs.existsSync(script) ? JSON.parse(fs.readFileSync(script, "utf8")).scenes?.map((s) => s.vo).join(" ") : "";
      context = `Judul video: ${v?.title}\nNarasi video: ${vo}`;
      const fromIdea = v?.idea_id ? get("SELECT pillar FROM ideas WHERE id = ?", v.idea_id) : null;
      const fromJob = v?.job_id ? parse(get("SELECT input FROM jobs WHERE id = ?", v.job_id))?.input?.pillar : null;
      // A YouTube version has no idea of its own; take its TikTok source's.
      const src = v?.source_id ? get("SELECT idea_id, job_id FROM videos WHERE id = ?", v.source_id) : null;
      const fromSource = src?.idea_id ? get("SELECT pillar FROM ideas WHERE id = ?", src.idea_id)?.pillar : null;
      pillar = fromIdea?.pillar ?? fromJob ?? fromSource ?? null;
    } else if (ideaId) {
      const i = parse(get("SELECT * FROM ideas WHERE id = ?", ideaId));
      context = `Ide: ${i?.title}\nHook: ${i?.hook}\nPoin: ${(i?.outline ?? []).join("; ")}`;
      pillar = i?.pillar ?? null;
    }
    const yt = videoId && get("SELECT orientation FROM videos WHERE id = ?", videoId)?.orientation === "landscape";
    const ask = yt
      ? `Tulis deskripsi video YouTube (2–5 baris: isi singkat, lalu ajakan like/subscribe/komentar, boleh 1–2 emoji, tanpa hashtag di dalam teks) dan TEPAT 5 hashtag. JSON: {"caption":"...","hashtags":["#..."]}`
      : `Tulis caption TikTok (2–4 baris, hook di baris pertama yang memuat kata kunci yang dicari orang, ajakan komentar/save/share di akhir, boleh 1–3 emoji) dan TEPAT 5 hashtag yang spesifik ke topik. JSON: {"caption":"...","hashtags":["#..."]}`;
    const about = pillar && pillar !== "brand" ? `Tentang akun:\n${profileSections(["IDENTITAS", "NADA & GAYA"])}\n\n${pillarNote(pillar)}` : `Profil brand:\n${setting("brand_profile", "")}${pillar ? "" : `\n\n${pillarNote(null)}`}`;
    const { data } = await chatJson(IDEA_SYSTEM, `${about}\n\n${context}\n${note ? `Catatan user: ${note}\n` : ""}\n${ask}`);
    const caption = String(data.caption ?? "").trim();
    const hashtags = cleanTags(data.hashtags);
    if (videoId) run("UPDATE videos SET caption = ?, hashtags = ? WHERE id = ?", caption, JSON.stringify(hashtags), videoId);
    if (ideaId) run("UPDATE ideas SET caption = ?, hashtags = ? WHERE id = ?", caption, JSON.stringify(hashtags), ideaId);
    res.json({ caption, hashtags });
  }),
);

/* ---------- videos ---------- */
app.patch(
  "/api/videos/:id",
  wrap((req, res) => {
    const b = req.body ?? {};
    for (const k of ["title", "caption", "status"]) if (k in b) run(`UPDATE videos SET ${k} = ?, updated_at = datetime('now','localtime') WHERE id = ?`, String(b[k]), req.params.id);
    if ("hashtags" in b) run("UPDATE videos SET hashtags = ? WHERE id = ?", JSON.stringify(cleanTags(b.hashtags)), req.params.id);
    if (b.status === "upload") run("UPDATE ideas SET status = 'upload' WHERE video_id = ?", req.params.id);
    res.json({ ok: true });
  }),
);

// Removes a finished video. Its project folder (a direct child of the video folder,
// used by no other video) goes to the Trash too, and so does the mp4, which lives
// in output/ rather than inside the project.
app.delete(
  "/api/videos/:id",
  wrap((req, res) => {
    const v = get("SELECT * FROM videos WHERE id = ?", req.params.id);
    if (!v) return res.status(404).json({ error: "video tidak ada" });
    if (get("SELECT id FROM jobs WHERE video_id = ? AND status IN ('antri', 'jalan')", v.id)) return res.status(409).json({ error: "Video ini sedang direvisi, tunggu sampai selesai" });
    const dir = v.project_dir && path.resolve(v.project_dir);
    const ownFolder =
      dir &&
      path.dirname(dir) === ROOT &&
      ![STUDIO, MEDIA, OUTPUT, path.join(ROOT, "node_modules")].includes(dir) &&
      fs.existsSync(dir) &&
      !get("SELECT id FROM videos WHERE project_dir = ? AND id != ?", v.project_dir, v.id);
    const removed = [];
    if (ownFolder) (toTrash(dir), removed.push(path.basename(dir)));
    if (v.path.startsWith(ROOT + path.sep) && fs.existsSync(v.path)) (toTrash(v.path), removed.push(path.basename(v.path)));
    run("DELETE FROM videos WHERE id = ?", v.id);
    run("UPDATE ideas SET video_id = NULL, status = 'ide' WHERE video_id = ?", v.id);
    run("UPDATE jobs SET video_id = NULL WHERE video_id = ?", v.id);
    res.json({ ok: true, removed: removed.join(" dan ") || null });
  }),
);

/* ---------- Gemini TTS quota ---------- */
app.post("/api/tts/check", wrap(async (req, res) => res.json(await checkTts())));

/* ---------- TikTok ---------- */
app.get("/api/tiktok/login", (req, res) => {
  try {
    res.redirect(tiktok.authUrl());
  } catch (e) {
    res.redirect(`/?tiktok=${encodeURIComponent(e.message)}`);
  }
});
// The browser lands here from the callback page, so always send it back to the dashboard.
app.get("/api/tiktok/callback", async (req, res) => {
  try {
    if (req.query.error) throw new Error(String(req.query.error_description ?? req.query.error));
    await tiktok.exchange(String(req.query.code ?? ""), String(req.query.state ?? ""));
    res.redirect("/?tiktok=ok");
  } catch (e) {
    res.redirect(`/?tiktok=${encodeURIComponent(e.message)}`);
  }
});
app.post("/api/tiktok/code", wrap(async (req, res) => res.json(await tiktok.exchange(String(req.body?.code ?? "")))));
app.post("/api/tiktok/disconnect", wrap((req, res) => (tiktok.disconnect(), res.json({ ok: true }))));
app.get("/api/tiktok/creator", wrap(async (req, res) => res.json(await tiktok.creatorForPosting())));
// Uploads run in the background; the page polls /status. Direct posts are checked against the
// creator's current settings first, so a wrong choice comes back as an error right away.
app.post(
  "/api/videos/:id/tiktok",
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    if (get("SELECT orientation FROM videos WHERE id = ?", id)?.orientation === "landscape") return res.status(400).json({ error: "Ini versi YouTube (16:9); kirim versi TikTok-nya" });
    const direct = req.body?.mode === "direct";
    const postInfo = direct ? await tiktok.directPostInfo(id, req.body?.post) : undefined;
    tiktok.sendVideo(id, direct ? "direct" : "draft", postInfo).catch((e) => run("UPDATE videos SET tiktok_status = 'FAILED', tiktok_error = ? WHERE id = ?", e.message, id));
    res.json({ ok: true });
  }),
);
app.post(
  "/api/videos/:id/tiktok/status",
  wrap(async (req, res) => {
    const v = get("SELECT tiktok_status FROM videos WHERE id = ?", req.params.id);
    if (v?.tiktok_status && !["MENGUNGGAH", "FAILED"].includes(v.tiktok_status)) await tiktok.refreshStatus(Number(req.params.id));
    res.json(get("SELECT tiktok_status, tiktok_error, tiktok_mode, tiktok_at FROM videos WHERE id = ?", req.params.id));
  }),
);

/* ---------- TikTok comments (Komentar page) ---------- */
// Read without login from TikTok's public web endpoints; each video needs its TikTok link first.
app.put("/api/videos/:id/tiktok-link", wrap(async (req, res) => res.json(await comments.setLink(Number(req.params.id), req.body?.url))));
app.get("/api/comments", wrap((req, res) => res.json(comments.list(Number(req.query.days ?? 7)))));
app.post("/api/comments/refresh", wrap(async (req, res) => res.json(await comments.refresh(req.body?.videoIds))));
app.get(
  "/api/comments/image/:cid/:n",
  wrap(async (req, res) => {
    const file = await comments.image(req.params.cid, Number(req.params.n));
    // The path comes from the server (data/ may sit under a dotted folder such as a worktree).
    file ? res.sendFile(file, { dotfiles: "allow" }) : res.status(404).end();
  }),
);
// A reply video idea from one comment, through the same generator as "Generate ide" with the comment
// as the theme. The comment itself is appended to the idea's production notes. When no model
// answers, the idea is saved bare so the comment is not lost.
app.post(
  "/api/comments/:cid/idea",
  wrap(async (req, res) => {
    const c = comments.forIdea(req.params.cid);
    if (!c) return res.status(404).json({ error: "Komentar tidak ada lagi; ambil komentar terbaru dulu" });
    if (c.idea_id && get("SELECT id FROM ideas WHERE id = ?", c.idea_id)) return res.json({ id: c.idea_id, existing: true });
    // Replies usually stay on the topic of the video they were left on.
    const pillar = PILLARS[c.pillar] ? c.pillar : planIdeas(1, [])[0].pillar;
    const theme = `video balasan komentar penonton. ${c.source} Jawab isi komentar itu langsung dan tuntas. Pembuka menampilkan kartu komentar (nama dan teksnya persis seperti aslinya), lalu host menjawab. Kalau isi komentar lebih cocok dengan pilar lain, pakai pilar itu`;
    let id;
    let model = null;
    let error = null;
    try {
      ({ model, ids: [id] } = await generateIdeas([{ pillar, format: "tanya" }], theme));
    } catch (e) {
      error = e.message;
    }
    if (id) run("UPDATE ideas SET format = trim(coalesce(format, '') || char(10) || ?) WHERE id = ?", c.source, id);
    else id = Number(run("INSERT INTO ideas (title, hook, outline, format, pillar, bentuk) VALUES (?, '', '[]', ?, ?, 'tanya')", `Balas komentar @${c.user}: ${(c.text || "gambar").replace(/\s+/g, " ").slice(0, 70)}`, c.source, pillar).lastInsertRowid);
    comments.setIdea(c.cid, id);
    res.json({ id, model, error });
  }),
);

/* ---------- jobs ---------- */
app.post(
  "/api/jobs",
  wrap((req, res) => {
    const b = req.body ?? {};
    const media = (b.mediaIds ?? []).map((id) => get("SELECT path, kind, note FROM media WHERE id = ?", id)).filter(Boolean);
    if (b.type === "tes") return res.json({ id: enqueue({ type: "tes", title: "Tes koneksi Claude Code", input: {} }) });
    if (b.type === "landscape") return res.json({ id: enqueueLandscape(b.videoId) });
    // Edit video page: the user's own footage, edited by Claude (skill step 9).
    if (b.type === "edit") {
      if (!media.some((m) => m.kind === "video")) return res.status(400).json({ error: "Pilih minimal satu video" });
      const format = ["portrait", "landscape", "asli"].includes(b.format) ? b.format : "portrait";
      const options = (Array.isArray(b.options) ? b.options : []).map(String).slice(0, 12);
      const id = enqueue({ type: "edit", title: String(b.title || "Edit video").slice(0, 120), input: { media, instructions: String(b.instructions ?? "").slice(0, 4000), format, duration: Number(b.duration) || null, options } });
      return res.json({ id });
    }
    if (b.type === "revisi") {
      const v = get("SELECT * FROM videos WHERE id = ?", b.videoId);
      if (!v) return res.status(404).json({ error: "video tidak ada" });
      const parent = v.job_id ? get("SELECT session_id FROM jobs WHERE id = ?", v.job_id) : null;
      // The other format of the same project, so the job keeps both in step.
      const sibling = v.orientation === "landscape" ? get("SELECT path FROM videos WHERE id = ?", v.source_id) : get("SELECT path FROM videos WHERE source_id = ? AND orientation = 'landscape'", v.id);
      const id = enqueue({
        type: "revisi",
        title: `Revisi: ${v.title}`,
        video_id: v.id,
        session_id: parent?.session_id ?? null,
        input: { feedback: b.feedback, video_path: v.path, project_dir: v.project_dir, media, orientation: v.orientation, sibling_path: sibling?.path ?? null },
      });
      return res.json({ id });
    }
    const idea = b.ideaId ? parse(get("SELECT * FROM ideas WHERE id = ?", b.ideaId)) : null;
    const brief = [idea ? `Hook: ${idea.hook}\nPoin: ${(idea.outline ?? []).join("; ")}\nFormat: ${idea.format}` : "", b.brief ?? ""].filter(Boolean).join("\n");
    // Cover mode (since 19 Oct 2026, replaces the random palette/type): the user's pick, else from the
    // pillar; ideas made from a viewer comment get the "BALAS KOMEN" series tag. Edited footage has none.
    const pillar = b.pillar || idea?.pillar || "";
    const reply = !!(idea && get("SELECT 1 AS x FROM tiktok_comments WHERE idea_id = ?", idea.id));
    const look = b.kind === "klip" ? null : resolveLook(b.look, { pillar, reply });
    const id = enqueue({ type: "video", title: b.title || idea?.title || "Video baru", idea_id: idea?.id, input: { kind: b.kind ?? "edukasi", brief, duration: Number(b.duration) || null, media, look, wide: !!b.wide, pillar, riset: !!idea?.riset } });
    res.json({ id });
  }),
);
app.get("/api/jobs/:id", wrap((req, res) => res.json(parse(get("SELECT * FROM jobs WHERE id = ?", req.params.id)))));
app.post("/api/jobs/:id/cancel", wrap((req, res) => (cancel(Number(req.params.id)), res.json({ ok: true }))));

/* ---------- media uploads ---------- */
const upload = multer({
  storage: multer.diskStorage({
    destination: MEDIA,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-80)}`),
  }),
  limits: { fileSize: 4 * 1024 ** 3 },
  fileFilter: (req, file, cb) => cb(null, /^(image|video)\//.test(file.mimetype)),
});
app.post(
  "/api/media",
  upload.array("files", 30),
  wrap((req, res) => {
    // ids so the Edit video page can select what was just uploaded.
    const ids = (req.files ?? []).map((f) => Number(run("INSERT INTO media (filename, path, kind, size) VALUES (?, ?, ?, ?)", f.originalname, f.path, f.mimetype.startsWith("video") ? "video" : "image", f.size).lastInsertRowid));
    res.json({ ok: true, count: ids.length, ids });
  }),
);
// Anime characters and pictures drawn by AI land in the same media library.
app.post("/api/media/generate", wrap((req, res) => res.json({ ok: true, tasks: startGenerate(req.body ?? {}, emit) })));
app.patch("/api/media/:id", wrap((req, res) => (run("UPDATE media SET note = ? WHERE id = ?", String(req.body?.note ?? ""), req.params.id), res.json({ ok: true }))));
// Files go to the macOS Trash rather than being deleted outright.
const toTrash = (p) => {
  const name = path.basename(p);
  let dest = path.join(process.env.HOME, ".Trash", name);
  if (fs.existsSync(dest)) dest = path.join(process.env.HOME, ".Trash", `${name} ${new Date().toISOString().replace(/[:.]/g, "-")}`);
  fs.renameSync(p, dest);
};
app.post("/api/media/:id/mouths", wrap((req, res) => res.json({ ok: true, task: startMouths(Number(req.params.id), emit, req.body?.only) })));
app.delete(
  "/api/media/:id",
  wrap((req, res) => {
    // A character image takes its mouth frames with it.
    for (const m of all("SELECT * FROM media WHERE id = ? OR mouth_of = ?", req.params.id, req.params.id)) {
      if (m.path.startsWith(MEDIA) && fs.existsSync(m.path)) toTrash(m.path);
      run("DELETE FROM media WHERE id = ?", m.id);
    }
    res.json({ ok: true });
  }),
);

/* ---------- live events ---------- */
app.get("/api/events", (req, res) => {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.write(": ok\n\n");
  const off = onEvent((e) => res.write(`data: ${JSON.stringify(e)}\n\n`));
  const ping = setInterval(() => res.write(": ping\n\n"), 25000);
  req.on("close", () => (off(), clearInterval(ping)));
});

/* ---------- files: videos, images and uploads under the video folder ---------- */
app.use(
  "/files",
  (req, res, next) => (/\.(mp4|mov|m4v|webm|jpe?g|png|webp|gif|wav|mp3)$/i.test(req.path) && !req.path.includes("node_modules") ? next() : res.status(404).end()),
  express.static(ROOT, { dotfiles: "deny", fallthrough: false }),
);

/* ---------- web app ---------- */
const dist = path.join(STUDIO, "dist");
app.use(express.static(dist));
app.get(/^\/(?!api|files).*/, (req, res) => res.sendFile(path.join(dist, "index.html")));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Studio Konten jalan di http://localhost:${PORT}`);
  for (const u of lanUrls()) console.log(`Dari HP (WiFi yang sama): ${u}  — PIN ada di ${path.join(DATA, "pin.txt")}`);
  resume();
});
