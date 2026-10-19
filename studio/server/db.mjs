import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DATA } from "./config.mjs";

export const db = new DatabaseSync(path.join(DATA, "studio.db"));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS ideas (
    id INTEGER PRIMARY KEY, title TEXT NOT NULL, hook TEXT, outline TEXT, format TEXT,
    caption TEXT, hashtags TEXT, status TEXT NOT NULL DEFAULT 'ide', video_id INTEGER,
    created_at TEXT DEFAULT (datetime('now','localtime')), updated_at TEXT
  );
  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY, title TEXT NOT NULL, path TEXT NOT NULL, project_dir TEXT,
    caption TEXT, hashtags TEXT, duration REAL, status TEXT NOT NULL DEFAULT 'siap',
    idea_id INTEGER, job_id INTEGER, created_at TEXT DEFAULT (datetime('now','localtime')), updated_at TEXT
  );
  CREATE TABLE IF NOT EXISTS media (
    id INTEGER PRIMARY KEY, filename TEXT NOT NULL, path TEXT NOT NULL, kind TEXT NOT NULL,
    size INTEGER, note TEXT, created_at TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY, type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'antri', title TEXT,
    prompt TEXT, input TEXT, session_id TEXT, log TEXT DEFAULT '', result TEXT, error TEXT,
    video_id INTEGER, idea_id INTEGER, created_at TEXT DEFAULT (datetime('now','localtime')),
    started_at TEXT, finished_at TEXT
  );
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
`);
// AI-drawn media: the prompt used, which character it shows, and whether the backdrop was cut out.
const mediaCols = db.prepare("PRAGMA table_info(media)").all().map((c) => c.name);
// mouth_of/mouth: lip-sync frames that belong to a character image.
for (const [col, type] of [["prompt", "TEXT"], ["char", "TEXT"], ["cutout", "INTEGER DEFAULT 0"], ["mouth_of", "INTEGER"], ["mouth", "TEXT"]]) if (!mediaCols.includes(col)) db.exec(`ALTER TABLE media ADD COLUMN ${col} ${type}`);
// orientation: 'portrait' (TikTok 9:16) or 'landscape' (YouTube 16:9, made from the
// portrait video source_id with the same project and narration).
const videoCols = db.prepare("PRAGMA table_info(videos)").all().map((c) => c.name);
for (const [col, type] of [["orientation", "TEXT NOT NULL DEFAULT 'portrait'"], ["source_id", "INTEGER"]]) if (!videoCols.includes(col)) db.exec(`ALTER TABLE videos ADD COLUMN ${col} ${type}`);
// pillar/bentuk: content pillar and format from server/content.mjs; riset: needs a fresh
// fact check when produced (app features, AI, news).
const ideaCols = db.prepare("PRAGMA table_info(ideas)").all().map((c) => c.name);
for (const [col, type] of [["pillar", "TEXT"], ["bentuk", "TEXT"], ["riset", "INTEGER DEFAULT 0"]]) if (!ideaCols.includes(col)) db.exec(`ALTER TABLE ideas ADD COLUMN ${col} ${type}`);

export const all = (sql, ...p) => db.prepare(sql).all(...p);
export const get = (sql, ...p) => db.prepare(sql).get(...p);
export const run = (sql, ...p) => db.prepare(sql).run(...p);

// Rows store hashtags/outline as JSON text; expand them for the API.
export const parse = (row) => {
  if (!row) return row;
  const out = { ...row };
  for (const k of ["hashtags", "outline", "input"]) {
    if (typeof out[k] === "string") {
      try {
        out[k] = JSON.parse(out[k]);
      } catch {}
    }
  }
  return out;
};

export const setting = (key, fallback) => get("SELECT value FROM settings WHERE key = ?", key)?.value ?? fallback;
export const setSetting = (key, value) => run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value);
