// Latest comments on our TikTok videos, without login or a browser. Uses the public web endpoints
// tiktok.com itself calls (checked 2026-10-18: plain fetch with a browser User-Agent and a tiktok.com
// Referer is enough). The Studio API app has no video.list/comment scope, so this is the only way.
//   node scripts/tiktok-comments.mjs <id or link> [...]    text, newest first, replies indented
//   … --json                                                JSON instead of text
//   … --days=7                                              only threads with activity in the last 7 days
//   … --belum                                               only comments the brand account has not replied to
//   … --no-replies                                          skip the reply requests (faster, "belum" unknown)
// The Studio server imports fetchComments() and videoInfo() from here (studio/server/comments.mjs).
import { pathToFileURL } from "node:url";
import { BRAND } from "./brand.mjs";

// The brand's TikTok account (social.tiktok in brand/brand.mjs), without the @.
export const OWNER = BRAND.social?.tiktok ?? "";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const PAGE = 50;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// "https://www.tiktok.com/@akun/video/7697372692827213077?lang=id" or the bare ID.
export const videoId = (s) => {
  const t = String(s ?? "").trim();
  return t.match(/\/(?:video|photo)\/(\d{15,22})/)?.[1] ?? (/^\d{15,22}$/.test(t) ? t : null);
};
// Links shared from the app (vt.tiktok.com/…, tiktok.com/t/…) carry no ID; their redirect does.
export async function resolveVideoId(s) {
  const id = videoId(s);
  const t = String(s ?? "").trim();
  if (id || !/^https?:\/\/(vt|vm)\.tiktok\.com\/|^https?:\/\/(www\.)?tiktok\.com\/t\//.test(t)) return id;
  const res = await fetch(t, { redirect: "manual", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
  return videoId(res.headers.get("location") ?? "");
}
export const videoUrl = (id) => `https://www.tiktok.com/@${OWNER}/video/${id}`;

async function getJson(url) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(1500 * attempt);
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Referer: "https://www.tiktok.com/", Accept: "application/json, text/plain, */*" }, signal: AbortSignal.timeout(20000) });
      const body = await res.text();
      // A blocked request comes back as an HTML challenge page or an empty 200.
      if (!body.trim().startsWith("{")) throw new Error(`TikTok tidak memberi JSON (HTTP ${res.status}${body ? ", kemungkinan dicegat WAF" : ", kosong"})`);
      const data = JSON.parse(body);
      if (data.status_code) throw new Error(`TikTok: ${data.status_msg || "status_code " + data.status_code}`);
      return data;
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

const shape = (c) => ({
  cid: c.cid,
  video: c.aweme_id,
  time: c.create_time,
  user: c.user?.unique_id ?? "",
  nickname: c.user?.nickname ?? "",
  text: c.text ?? "",
  likes: c.digg_count ?? 0,
  reply_total: c.reply_comment_total ?? 0,
  author_liked: Boolean(c.is_author_digged),
  pinned: Boolean(c.author_pin),
  // Screenshot comments: `text` is empty and the picture is here (WebP, signed URL that expires).
  images: (c.image_list ?? []).map((i) => i.origin_url?.url_list?.[0] ?? i.crop_url?.url_list?.[0]).filter(Boolean),
});

async function pages(base, max) {
  const out = [];
  let cursor = 0;
  let total = 0;
  for (;;) {
    const d = await getJson(`${base}&count=${PAGE}&cursor=${cursor}`);
    total = d.total ?? total;
    out.push(...(d.comments ?? []));
    if (!d.has_more || !d.comments?.length || out.length >= max) break;
    cursor = d.cursor;
    await sleep(300);
  }
  return { list: out, total };
}

// One video's comments, each with its replies (oldest first, as in the app).
// unanswered: nobody from the brand account replied in the thread (and the comment is not ours).
// followup: we replied, but someone wrote again after our last reply.
export async function fetchComments(id, { replies = true, max = 500 } = {}) {
  const { list, total } = await pages(`https://www.tiktok.com/api/comment/list/?aid=1988&aweme_id=${id}`, max);
  const comments = list.map(shape);
  for (const c of comments) {
    c.replies = [];
    if (replies && c.reply_total > 0) {
      await sleep(250);
      const r = await pages(`https://www.tiktok.com/api/comment/list/reply/?aid=1988&item_id=${id}&comment_id=${c.cid}`, max);
      c.replies = r.list.map(shape).sort((a, b) => a.time - b.time);
    }
    const ours = c.replies.filter((r) => r.user === OWNER);
    const lastOurs = ours.at(-1)?.time ?? 0;
    c.mine = c.user === OWNER;
    c.unanswered = replies ? !c.mine && ours.length === 0 : null;
    c.followup = Boolean(ours.length && c.replies.some((r) => r.user !== OWNER && r.time > lastOurs));
    c.last_activity = Math.max(c.time, ...c.replies.map((r) => r.time));
  }
  return { id, total, comments };
}

// Caption and thumbnail of a public video, to confirm a pasted link is ours.
export async function videoInfo(id) {
  let res;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await sleep(1500);
    res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl(id))}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) });
    if (res.ok) break;
  }
  if (!res.ok) throw new Error(`oEmbed HTTP ${res.status}`);
  const d = await res.json();
  return { title: d.title ?? "", author: (d.author_url ?? "").split("/@").pop(), thumbnail: d.thumbnail_url ?? null };
}

/* ---------- command line ---------- */
const wib = (t) => new Date(t * 1000).toLocaleString("sv-SE", { timeZone: "Asia/Jakarta" }).slice(0, 16);

async function main() {
  const args = process.argv.slice(2);
  const flag = (n) => args.includes(`--${n}`);
  const days = Number(args.find((a) => a.startsWith("--days="))?.split("=")[1] ?? 0);
  const ids = [];
  for (const a of args.filter((a) => !a.startsWith("--"))) ids.push([a, await resolveVideoId(a)]);
  for (const [a, id] of ids) if (!id) throw new Error(`Bukan ID/link video TikTok: ${a}`);
  if (!ids.length) {
    console.log("Pakai: node scripts/tiktok-comments.mjs <id atau link video> [...] [--json] [--days=7] [--belum] [--no-replies]");
    process.exit(1);
  }
  const since = days ? Date.now() / 1000 - days * 86400 : 0;
  const all = [];
  const errors = [];
  for (const [, id] of ids) {
    try {
      const r = await fetchComments(id, { replies: !flag("no-replies") });
      all.push(...r.comments);
      if (!flag("json")) console.error(`video ${id}: ${r.comments.length} komentar (TikTok menghitung ${r.total} termasuk balasan)`);
    } catch (e) {
      errors.push({ id, error: e.message });
      console.error(`video ${id}: ${e.message}`);
    }
  }
  const list = all.filter((c) => c.last_activity >= since && (!flag("belum") || c.unanswered || c.followup)).sort((a, b) => b.last_activity - a.last_activity);
  if (flag("json")) return console.log(JSON.stringify({ fetched_at: new Date().toISOString(), comments: list, errors }, null, 2));
  const many = ids.length > 1;
  for (const c of list) {
    const tags = [c.unanswered && "BELUM DIBALAS", c.followup && "ADA BALASAN BARU", c.author_liked && "disukai kreator", c.pinned && "disematkan"].filter(Boolean);
    console.log(`\n${wib(c.time)}  @${c.user}${c.nickname && c.nickname !== c.user ? ` (${c.nickname})` : ""}  ♥${c.likes}${tags.length ? "  [" + tags.join(", ") + "]" : ""}${many ? `  · video ${c.video}` : ""}`);
    console.log(`  ${(c.text || "(gambar tanpa teks)").replace(/\n/g, "\n  ")}`);
    for (const u of c.images) console.log(`  [gambar] ${u}`);
    for (const r of c.replies) {
      console.log(`    ↳ ${wib(r.time)} @${r.user}: ${(r.text || (r.images.length ? "(gambar)" : "(stiker)")).replace(/\n/g, "\n      ")}`);
      for (const u of r.images) console.log(`      [gambar] ${u}`);
    }
  }
  if (!list.length) console.log(days ? `Tidak ada komentar dalam ${days} hari terakhir.` : "Belum ada komentar.");
  if (errors.length) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main().catch((e) => (console.error(e.message), process.exit(1)));
