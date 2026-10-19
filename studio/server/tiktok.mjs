import fs from "node:fs";
import crypto from "node:crypto";
import { all, get, run, setting, setSetting } from "./db.mjs";

// TikTok Login Kit + Content Posting API (FILE_UPLOAD).
// Draft mode (video.upload) lands in the creator's TikTok inbox and needs no audit;
// direct mode (video.publish) is forced to private until the app passes TikTok's audit.
const API = "https://open.tiktokapis.com";
// Draft-only by default; add video.publish once the app is approved for Direct Post.
export const DEFAULT_SCOPES = "user.info.basic,video.upload";
const scopes = () => setting("tiktok_scopes", DEFAULT_SCOPES);

// Track TikTok upload state on each video.
const cols = all("PRAGMA table_info(videos)").map((c) => c.name);
for (const c of ["tiktok_publish_id", "tiktok_status", "tiktok_error", "tiktok_mode", "tiktok_at"]) {
  if (!cols.includes(c)) run(`ALTER TABLE videos ADD COLUMN ${c} TEXT`);
}

const cfg = () => ({
  key: setting("tiktok_client_key", ""),
  secret: setting("tiktok_client_secret", ""),
  redirect: setting("tiktok_redirect_uri", ""),
});

export function publicStatus() {
  const c = cfg();
  const tok = tokens();
  return {
    configured: Boolean(c.key && c.secret && c.redirect),
    client_key: c.key,
    has_secret: Boolean(c.secret),
    redirect_uri: c.redirect,
    connected: Boolean(tok?.refresh_token),
    user: tok?.user ?? null,
    scope: tok?.scope ?? "",
    scopes: scopes(),
    can_direct: (tok?.scope ?? "").includes("video.publish"),
  };
}

const tokens = () => {
  try {
    return JSON.parse(setting("tiktok_tokens", "null"));
  } catch {
    return null;
  }
};
const saveTokens = (t) => setSetting("tiktok_tokens", JSON.stringify(t));

export function authUrl() {
  const c = cfg();
  if (!c.key || !c.redirect) throw new Error("Isi Client Key dan Redirect URI dulu di Pengaturan.");
  const state = crypto.randomBytes(16).toString("hex");
  setSetting("tiktok_oauth_state", state);
  const q = new URLSearchParams({ client_key: c.key, scope: scopes(), response_type: "code", redirect_uri: c.redirect, state });
  return `https://www.tiktok.com/v2/auth/authorize/?${q}`;
}

async function tokenRequest(body) {
  const c = cfg();
  const res = await fetch(`${API}/v2/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: new URLSearchParams({ client_key: c.key, client_secret: c.secret, ...body }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`TikTok token: ${data.error_description ?? data.error ?? JSON.stringify(data).slice(0, 200)}`);
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    open_id: data.open_id,
    scope: data.scope,
    expires_at: Date.now() + (data.expires_in - 120) * 1000,
  };
}

// `state` is checked when the callback page relays automatically; a pasted code skips it.
export async function exchange(code, state) {
  if (state !== undefined && state !== setting("tiktok_oauth_state", "")) throw new Error("State tidak cocok, ulangi login TikTok dari dashboard.");
  // A pasted code may still be URL-encoded; one relayed through the query string is not.
  const clean = /%[0-9A-F]{2}/i.test(code) ? decodeURIComponent(code) : code;
  const t = await tokenRequest({ code: clean.trim(), grant_type: "authorization_code", redirect_uri: cfg().redirect });
  saveTokens(t);
  try {
    const u = await call("GET", "/v2/user/info/?fields=open_id,display_name,avatar_url");
    saveTokens({ ...t, user: { name: u.user?.display_name, avatar: u.user?.avatar_url } });
  } catch {}
  return publicStatus();
}

export const disconnect = () => setSetting("tiktok_tokens", "null");

async function accessToken() {
  let t = tokens();
  if (!t?.refresh_token) throw new Error("Akun TikTok belum tersambung.");
  if (Date.now() > t.expires_at) {
    const fresh = await tokenRequest({ grant_type: "refresh_token", refresh_token: t.refresh_token });
    t = { ...t, ...fresh };
    saveTokens(t);
  }
  return t.access_token;
}

async function call(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json; charset=UTF-8" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (data.error?.code && data.error.code !== "ok") {
    const known = ERRORS[data.error.code];
    throw Object.assign(new Error(known ?? `TikTok ${path}: ${data.error.message || data.error.code}`), { code: data.error.code });
  }
  return data.data ?? {};
}

// TikTok error codes that need a plain explanation instead of the raw API message.
const ERRORS = {
  spam_risk_too_many_posts: "Akun TikTok ini sudah mencapai batas posting harian. Coba lagi nanti.",
  spam_risk_user_banned_from_posting: "Akun TikTok ini sedang tidak boleh membuat postingan baru. Coba lagi nanti.",
  reached_active_user_cap: "Kuota harian akun yang memposting lewat aplikasi ini sudah habis. Coba lagi besok.",
  unaudited_client_can_only_post_to_private_accounts: "Aplikasi belum lolos audit TikTok: posting langsung hanya bisa ke akun yang sedang privat.",
  privacy_level_option_mismatch: "Pilihan privasi tidak tersedia untuk akun ini. Buka lagi layar posting.",
  scope_not_authorized: "Izin video.publish belum diberikan. Login ulang TikTok dengan izin posting langsung.",
};

export const creatorInfo = () => call("POST", "/v2/post/publish/creator_info/query/", {});

// Creator info for the Post to TikTok screen, fetched fresh every time it opens (TikTok's
// Content Sharing Guidelines). When TikTok says the creator cannot post now, `blocked` carries
// the reason and the screen stops there. Nothing from here is stored.
const BLOCKED = ["spam_risk_too_many_posts", "spam_risk_user_banned_from_posting", "reached_active_user_cap"];
export async function creatorForPosting() {
  try {
    return await creatorInfo();
  } catch (e) {
    if (BLOCKED.includes(e.code)) return { blocked: e.code };
    throw e;
  }
}

// Checks the choices made on the Post to TikTok screen against the creator's current settings
// and turns them into the Direct Post `post_info`. Nothing is preset: privacy must be picked,
// comment/duet/stitch are off unless switched on, and settings the creator turned off in the
// app stay off.
export async function directPostInfo(videoId, post = {}) {
  const v = get("SELECT duration FROM videos WHERE id = ?", videoId);
  const info = await creatorInfo();
  if (!(info.privacy_level_options ?? []).includes(post.privacy)) throw new Error("Select who can view this video.");
  if (post.brandContent && post.privacy === "SELF_ONLY") throw new Error("Branded content visibility cannot be set to private.");
  const max = info.max_video_post_duration_sec;
  if (max && v?.duration > max) throw new Error(`This video is ${Math.round(v.duration)} s long; this account can post up to ${max} s.`);
  const title = String(post.title ?? "");
  if (title.length > 2200) throw new Error("The caption can be at most 2,200 characters.");
  return {
    title,
    privacy_level: post.privacy,
    disable_comment: Boolean(info.comment_disabled || !post.comment),
    disable_duet: Boolean(info.duet_disabled || !post.duet),
    disable_stitch: Boolean(info.stitch_disabled || !post.stitch),
    video_cover_timestamp_ms: 1000,
    brand_organic_toggle: Boolean(post.brandOrganic),
    brand_content_toggle: Boolean(post.brandContent),
    is_aigc: Boolean(post.aigc),
  };
}

// Chunk rules: 5–64 MB per chunk, count = floor(size / chunk), last chunk takes the
// remainder. A single-chunk upload must declare chunk_size equal to the whole file,
// so anything up to 64 MB goes in one piece.
const MB = 1024 * 1024;
function plan(size) {
  if (size <= 64 * MB) return { chunk: size, count: 1 };
  const chunk = 10 * MB;
  return { chunk, count: Math.floor(size / chunk) };
}

async function putChunks(uploadUrl, file, size, p) {
  const fd = fs.openSync(file, "r");
  try {
    for (let i = 0; i < p.count; i++) {
      const start = i * p.chunk;
      const end = i === p.count - 1 ? size - 1 : start + p.chunk - 1;
      const buf = Buffer.alloc(end - start + 1);
      fs.readSync(fd, buf, 0, buf.length, start);
      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "video/mp4", "Content-Length": String(buf.length), "Content-Range": `bytes ${start}-${end}/${size}` },
        body: buf,
      });
      if (![200, 201, 206].includes(res.status)) throw new Error(`Upload potongan ${i + 1}/${p.count} gagal (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
    }
  } finally {
    fs.closeSync(fd);
  }
}

// `post_info` (from directPostInfo) is required for direct mode; draft mode ignores it.
export async function sendVideo(videoId, mode = "draft", post_info) {
  const v = get("SELECT * FROM videos WHERE id = ?", videoId);
  if (!v || !fs.existsSync(v.path)) throw new Error("File video tidak ada.");
  const size = fs.statSync(v.path).size;
  const p = plan(size);
  const source_info = { source: "FILE_UPLOAD", video_size: size, chunk_size: p.chunk, total_chunk_count: p.count };
  let init;
  if (mode === "direct" && !(tokens()?.scope ?? "").includes("video.publish")) throw new Error("Scope video.publish belum diberikan; pakai mode draf.");
  if (mode === "direct") {
    if (!post_info) throw new Error("Posting langsung harus lewat layar Post to TikTok.");
    init = await call("POST", "/v2/post/publish/video/init/", { post_info, source_info });
  } else {
    init = await call("POST", "/v2/post/publish/inbox/video/init/", { source_info });
  }
  run("UPDATE videos SET tiktok_publish_id = ?, tiktok_status = 'MENGUNGGAH', tiktok_error = NULL, tiktok_mode = ?, tiktok_at = datetime('now','localtime') WHERE id = ?", init.publish_id, mode, videoId);
  await putChunks(init.upload_url, v.path, size, p);
  run("UPDATE videos SET tiktok_status = 'PROCESSING_UPLOAD' WHERE id = ?", videoId);
  return { publish_id: init.publish_id };
}

export async function refreshStatus(videoId) {
  const v = get("SELECT tiktok_publish_id FROM videos WHERE id = ?", videoId);
  if (!v?.tiktok_publish_id) return null;
  const s = await call("POST", "/v2/post/publish/status/fetch/", { publish_id: v.tiktok_publish_id });
  run("UPDATE videos SET tiktok_status = ?, tiktok_error = ? WHERE id = ?", s.status ?? "?", s.fail_reason ?? null, videoId);
  if (s.status === "PUBLISH_COMPLETE") run("UPDATE videos SET status = 'upload' WHERE id = ?", videoId);
  return s;
}
