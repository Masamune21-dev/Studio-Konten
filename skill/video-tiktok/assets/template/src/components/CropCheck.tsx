import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";
import { useCurrentFrame, useVideoConfig } from "./Time";
import { BRAND } from "../brand";

// Used only by `npm run check:crop` (input prop checkCrop): measures how much of each
// character (img/<who>-*.png) lies outside the frame and logs it for the script.
// Only the opaque part of the PNG counts, so transparent padding is never "cut".
const CHAR = new RegExp(`/img/((?:${BRAND.characters.join("|")})-[^/?#]*)\\.png`);

// Opaque bounding box of a PNG as fractions of its size [x0, y0, x1, y1], plus the
// cumulative share of opaque pixels per column: a thin pointing arm past the edge
// matters much less than a cut-off torso.
type Shape = { box: number[]; cum: Float64Array };
const boxes = new Map<string, Promise<Shape>>();
const opaqueBox = (src: string) => {
  if (!boxes.has(src))
    boxes.set(
      src,
      new Promise((resolve) => {
        const im = new Image();
        im.onload = () => {
          const c = document.createElement("canvas");
          const w = (c.width = Math.ceil(im.naturalWidth / 4));
          const h = (c.height = Math.ceil(im.naturalHeight / 4));
          const g = c.getContext("2d")!;
          g.drawImage(im, 0, 0, w, h);
          const a = g.getImageData(0, 0, w, h).data;
          let x0 = w, y0 = h, x1 = -1, y1 = -1;
          const col = new Float64Array(w);
          for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++)
              if (a[(y * w + x) * 4 + 3] > 40) {
                col[x]++;
                if (x < x0) x0 = x;
                if (x > x1) x1 = x;
                if (y < y0) y0 = y;
                if (y > y1) y1 = y;
              }
          const cum = new Float64Array(w + 1);
          for (let x = 0; x < w; x++) cum[x + 1] = cum[x] + col[x];
          for (let x = 0; x <= w; x++) cum[x] /= cum[w] || 1;
          resolve({ box: x1 < 0 ? [0, 0, 1, 1] : [x0 / w, y0 / h, (x1 + 1) / w, (y1 + 1) / h], cum });
        };
        im.onerror = () => resolve({ box: [0, 0, 1, 1], cum: Float64Array.from([0, 1]) });
        im.src = src;
      }),
    );
  return boxes.get(src)!;
};

// Opacity as seen on screen: a character fading in or out is not judged.
const shownOpacity = (el: Element | null) => {
  let o = 1;
  for (; el; el = el.parentElement) o *= Number(getComputedStyle(el).opacity);
  return o;
};

export const CropCheck: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const [handle] = useState(() => delayRender("crop check"));
  useEffect(() => {
    (async () => {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      for (const img of [...document.querySelectorAll("img")]) {
        const name = img.src.match(CHAR)?.[1];
        if (!name) continue;
        if (!img.complete) await new Promise((r) => ((img.onload = r), (img.onerror = r)));
        const r = img.getBoundingClientRect();
        if (!r.width || shownOpacity(img) < 0.5) continue;
        const { box, cum } = await opaqueBox(img.src);
        let [fx0, fy0, fx1, fy1] = box;
        // scaleX(-1) mirrors the opaque area too.
        const flipped = new DOMMatrix(getComputedStyle(img).transform).a < 0;
        if (flipped) [fx0, fx1] = [1 - fx1, 1 - fx0];
        const x0 = r.left + fx0 * r.width, x1 = r.left + fx1 * r.width;
        const y0 = r.top + fy0 * r.height, y1 = r.top + fy1 * r.height;
        // Share of the character's opaque pixels left of x = 0 and right of x = width.
        const n = cum.length - 1;
        const massLeftOf = (u: number) => {
          const v = Math.min(1, Math.max(0, flipped ? 1 - u : u));
          const m = cum[Math.round(v * n)];
          return flipped ? 1 - m : m;
        };
        const left = massLeftOf(-r.left / r.width);
        const right = 1 - massLeftOf((width - r.left) / r.width);
        const top = Math.max(0, -y0) / (y1 - y0);
        console.log("CROPCHECK " + JSON.stringify({ frame, name, left, right, top, box: [x0, y0, x1, y1].map(Math.round), frameSize: [width, height] }));
      }
      continueRender(handle);
    })();
  }, []);
  return null;
};
