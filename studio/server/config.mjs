import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

export const STUDIO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
export const ROOT = path.resolve(STUDIO, ".."); // the repo root (folder with .env, scripts/, skill/)
export const MEDIA = path.join(ROOT, "media");
// Every video project renders its final mp4 here as <project folder>.mp4.
export const OUTPUT = path.join(ROOT, "output");
export const DATA = path.join(STUDIO, "data");
export const RESULTS = path.join(DATA, "results");
export const PORT = Number(process.env.PORT ?? 4321);

for (const d of [MEDIA, OUTPUT, DATA, RESULTS]) fs.mkdirSync(d, { recursive: true });

// API keys live in the shared video .env (same file the video projects use).
const envFile = path.join(ROOT, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

// Devices other than this Mac must enter a PIN. Generated once, kept in data/.
const pinFile = path.join(DATA, "pin.txt");
if (!fs.existsSync(pinFile)) fs.writeFileSync(pinFile, String(crypto.randomInt(100000, 999999)) + "\n", { mode: 0o600 });
export const PIN = fs.readFileSync(pinFile, "utf8").trim();

export const lanUrls = () =>
  Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => `http://${i.address}:${PORT}`);
