import fs from "node:fs";
import path from "node:path";
import { DATA } from "./config.mjs";
import { all, db, get, run } from "./db.mjs";
import { OWNER, fetchComments, resolveVideoId, videoInfo, videoUrl } from "../../scripts/tiktok-comments.mjs";

// Comments on our TikTok posts for the Komentar page, read without login through the public web
// endpoints (scripts/tiktok-comments.mjs). The Studio TikTok app has no scope that lists posts, so each
// video card takes its TikTok link by hand (videos.tiktok_id). Fetched comments are kept here so the
// page opens without asking TikTok, and so a comment remembers the idea made from it.
const cols = all("PRAGMA table_info(videos)").map((c) => c.name);
for (const c of ["tiktok_id", "tiktok_checked_at"]) if (!cols.includes(c)) run(`ALTER TABLE videos ADD COLUMN ${c} TEXT`);
// One row per comment; replies have parent_cid. unanswered/followup/last_activity are kept on the
// top-level comment (see fetchComments).
db.exec(`
  CREATE TABLE IF NOT EXISTS tiktok_comments (
    cid TEXT PRIMARY KEY, aweme_id TEXT NOT NULL, parent_cid TEXT, time INTEGER, user TEXT, nickname TEXT,
    text TEXT, likes INTEGER, reply_total INTEGER, author_liked INTEGER, pinned INTEGER, images TEXT,
    unanswered INTEGER, followup INTEGER, last_activity INTEGER, idea_id INTEGER, fetched_at TEXT
  );
  CREATE INDEX IF NOT EXISTS tiktok_comments_video ON tiktok_comments (aweme_id, parent_cid);
`);

// Screenshot comments come with signed CDN links that expire after about a day, so the pictures are
// saved while the link still works.
const IMAGES = path.join(DATA, "tiktok-comments");
fs.mkdirSync(IMAGES, { recursive: true });
const EXT = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/heic": "heic" };
const imageFile = (cid, n) => fs.readdirSync(IMAGES).find((f) => f.startsWith(`${cid}-${n}.`));

async function saveImage(cid, n, url) {
  if (imageFile(cid, n)) return;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`gambar komentar HTTP ${res.status}`);
  const ext = EXT[(res.headers.get("content-type") ?? "").split(";")[0]] ?? "webp";
  fs.writeFileSync(path.join(IMAGES, `${cid}-${n}.${ext}`), Buffer.from(await res.arrayBuffer()));
}

export async function image(cid, n) {
  if (!imageFile(cid, n)) {
    const url = JSON.parse(get("SELECT images FROM tiktok_comments WHERE cid = ?", cid)?.images ?? "[]")[n];
    if (!url) return null;
    await saveImage(cid, n, url);
  }
  return path.join(IMAGES, imageFile(cid, n));
}

// Pasting a link also marks the video (and its idea) as uploaded: it is on TikTok now.
export async function setLink(id, input) {
  const v = get("SELECT id, orientation, status FROM videos WHERE id = ?", id);
  if (!v) throw new Error("video tidak ada");
  if (!String(input ?? "").trim()) {
    run("UPDATE videos SET tiktok_id = NULL, tiktok_checked_at = NULL WHERE id = ?", id);
    return { tiktok_id: null };
  }
  if (v.orientation === "landscape") throw new Error("Ini versi YouTube; tempel link TikTok di kartu versi TikTok-nya");
  const tid = await resolveVideoId(input).catch(() => null);
  if (!tid) throw new Error("Bukan link video TikTok. Tempel link dari tombol Bagikan › Salin tautan, atau alamat …/video/angka.");
  const other = get("SELECT title FROM videos WHERE tiktok_id = ? AND id != ?", tid, id);
  if (other) throw new Error(`Link ini sudah dipakai video "${other.title}"`);
  // The caption confirms the right video; when TikTok does not answer, the link is kept anyway.
  let info = null;
  try {
    info = await videoInfo(tid);
  } catch {}
  if (info?.author && info.author !== OWNER) throw new Error(`Video itu milik @${info.author}, bukan @${OWNER}`);
  run("UPDATE videos SET tiktok_id = ?, tiktok_checked_at = NULL WHERE id = ?", tid, id);
  if (v.status !== "upload") {
    run("UPDATE videos SET status = 'upload', updated_at = datetime('now','localtime') WHERE id = ?", id);
    run("UPDATE ideas SET status = 'upload' WHERE video_id = ?", id);
  }
  return { tiktok_id: tid, title: info?.title ?? null };
}

const upsert = (c, parent, stamp, top) =>
  run(
    `INSERT INTO tiktok_comments (cid, aweme_id, parent_cid, time, user, nickname, text, likes, reply_total, author_liked, pinned, images, unanswered, followup, last_activity, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(cid) DO UPDATE SET text = excluded.text, nickname = excluded.nickname, likes = excluded.likes, reply_total = excluded.reply_total,
       author_liked = excluded.author_liked, pinned = excluded.pinned, images = excluded.images, unanswered = excluded.unanswered,
       followup = excluded.followup, last_activity = excluded.last_activity, fetched_at = excluded.fetched_at`,
    c.cid,
    c.video,
    parent,
    c.time,
    c.user,
    c.nickname,
    c.text,
    c.likes,
    c.reply_total,
    c.author_liked ? 1 : 0,
    c.pinned ? 1 : 0,
    JSON.stringify(c.images),
    top ? (c.unanswered ? 1 : 0) : null,
    top ? (c.followup ? 1 : 0) : null,
    top ? c.last_activity : null,
    stamp,
  );

async function refreshVideo(v) {
  const stamp = new Date().toISOString();
  const { comments } = await fetchComments(v.tiktok_id);
  db.exec("BEGIN");
  try {
    for (const c of comments) {
      upsert(c, null, stamp, true);
      for (const r of c.replies) upsert(r, c.cid, stamp, false);
    }
    // Comments deleted on TikTok disappear here too.
    run("DELETE FROM tiktok_comments WHERE aweme_id = ? AND fetched_at != ?", v.tiktok_id, stamp);
    run("UPDATE videos SET tiktok_checked_at = datetime('now','localtime') WHERE id = ?", v.id);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  const errors = [];
  for (const c of comments.flatMap((c) => [c, ...c.replies])) {
    for (const [n, url] of c.images.entries()) await saveImage(c.cid, n, url).catch((e) => errors.push(e.message));
  }
  return { count: comments.length, errors };
}

// One refresh at a time; a second click joins the running one.
let running = null;
export function refresh(ids) {
  running ??= (async () => {
    const videos = all("SELECT id, title, tiktok_id FROM videos WHERE tiktok_id IS NOT NULL").filter((v) => !ids?.length || ids.includes(v.id));
    const out = { videos: 0, comments: 0, errors: [] };
    for (const v of videos) {
      try {
        const r = await refreshVideo(v);
        out.videos++;
        out.comments += r.count;
        out.errors.push(...r.errors.map((e) => `${v.title}: ${e}`));
      } catch (e) {
        out.errors.push(`${v.title}: ${e.message}`);
      }
    }
    return out;
  })().finally(() => (running = null));
  return running;
}

const rowOut = (r) => ({ ...r, images: JSON.parse(r.images ?? "[]").map((_, n) => `/api/comments/image/${r.cid}/${n}`), author_liked: !!r.author_liked, pinned: !!r.pinned, mine: r.user === OWNER });

// Threads with activity in the last `days` days (0 = all), newest first, replies oldest first.
export function list(days = 7) {
  const since = days > 0 ? Math.floor(Date.now() / 1000) - days * 86400 : 0;
  const videos = all("SELECT id, title, tiktok_id, tiktok_checked_at, status FROM videos WHERE tiktok_id IS NOT NULL").map((v) => ({ ...v, url: videoUrl(v.tiktok_id) }));
  const byVideo = Object.fromEntries(videos.map((v) => [v.tiktok_id, v.id]));
  const top = all("SELECT * FROM tiktok_comments WHERE parent_cid IS NULL AND last_activity >= ? ORDER BY last_activity DESC", since);
  const replies = all(`SELECT * FROM tiktok_comments WHERE parent_cid IN (${top.map(() => "?").join(",") || "NULL"}) ORDER BY time`, ...top.map((c) => c.cid));
  const ideas = Object.fromEntries(all("SELECT id, status FROM ideas WHERE id IN (SELECT idea_id FROM tiktok_comments WHERE idea_id IS NOT NULL)").map((i) => [i.id, i.status]));
  const comments = top.map((c) => ({
    ...rowOut(c),
    unanswered: !!c.unanswered,
    followup: !!c.followup,
    video_id: byVideo[c.aweme_id] ?? null,
    idea_id: ideas[c.idea_id] ? c.idea_id : null,
    idea_status: ideas[c.idea_id] ?? null,
    replies: replies.filter((r) => r.parent_cid === c.cid).map(rowOut),
  }));
  // Uploaded TikTok videos that still need their link, newest first.
  const unlinked = all("SELECT id, title, status FROM videos WHERE tiktok_id IS NULL AND orientation = 'portrait' AND status = 'upload' ORDER BY id DESC");
  return { owner: OWNER, videos, comments, unlinked };
}

// For the nav badge (threads waiting for a reply this week) and the TikTok links on video cards.
export const summary = () => ({
  owner: OWNER,
  waiting: get("SELECT COUNT(*) AS n FROM tiktok_comments WHERE parent_cid IS NULL AND (unanswered = 1 OR followup = 1) AND last_activity >= ?", Math.floor(Date.now() / 1000) - 7 * 86400).n,
  linked: get("SELECT COUNT(*) AS n FROM videos WHERE tiktok_id IS NOT NULL").n,
});

// What the idea generator needs to know about a comment (POST /api/comments/:cid/idea).
export function forIdea(cid) {
  const c = get("SELECT * FROM tiktok_comments WHERE cid = ?", cid);
  if (!c) return null;
  const v = get("SELECT v.id, v.title, i.pillar FROM videos v LEFT JOIN ideas i ON i.id = v.idea_id WHERE v.tiktok_id = ?", c.aweme_id);
  const parent = c.parent_cid ? get("SELECT user, text FROM tiktok_comments WHERE cid = ?", c.parent_cid) : null;
  const when = new Date(c.time * 1000).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
  const images = JSON.parse(c.images ?? "[]").length;
  const quote = c.text ? `"${c.text.replace(/\s*\n\s*/g, " / ")}"` : "(komentar berupa gambar tanpa teks)";
  return {
    ...c,
    pillar: v?.pillar ?? null,
    video_title: v?.title ?? null,
    source: `Sumber: komentar @${c.user}${c.nickname && c.nickname !== c.user ? ` (${c.nickname})` : ""} tanggal ${when} di video "${v?.title ?? c.aweme_id}" (${videoUrl(c.aweme_id)}): ${quote}${images ? ` + ${images} gambar (lihat halaman Komentar di Studio)` : ""}${parent ? `. Ini balasan di utas komentar @${parent.user}: "${parent.text}"` : ""}.`,
  };
}
export const setIdea = (cid, ideaId) => run("UPDATE tiktok_comments SET idea_id = ? WHERE cid = ?", ideaId, cid);
