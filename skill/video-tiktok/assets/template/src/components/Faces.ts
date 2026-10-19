// Where the characters' faces are on screen right now, so the captions can step aside
// (Captions.tsx) and check-faces can verify it. The face is found in the character PNG itself
// (img/<key>-*.png, keys from src/brand.ts): the skin-coloured patch near the top of the figure, under
// the hair or cap and in line with the top of the head (a raised hand is skin too, but sits off to
// the side). A hand on the chin or the neck joins that patch, so the box is sized from its top band
// (forehead to eyes): about 1.5× that width wide and 1.3× tall. Checked by eye on all 55 poses
// (10 Oct 2026). Screen rects come from the DOM, so camera moves, zooms, transitions and the
// characters' own entrances are included.
import { BRAND } from "../brand";
export const CHAR_IMG = new RegExp(`/img/((?:${BRAND.characters.join("|")})-[^/?#]*)\\.png`);
export type Rect = { x0: number; y0: number; x1: number; y1: number };
type Box = [number, number, number, number]; // fractions of the image

function faceOf(w: number, h: number, px: Uint8ClampedArray): Box | null {
  const op = (x: number, y: number) => px[(y * w + x) * 4 + 3] > 128;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (op(x, y)) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  const H = y1 - y0 + 1;
  const W = x1 - x0 + 1;
  // Column of the top of the head: opaque pixels in the top 8% of the figure.
  let sx = 0, n = 0;
  for (let y = y0; y < y0 + H * 0.08; y++) for (let x = x0; x <= x1; x++) if (op(x, y)) (sx += x), n++;
  const headX = n ? sx / n : (x0 + x1) / 2;
  const skin = (x: number, y: number) => {
    const i = (y * w + x) * 4, r = px[i], g = px[i + 1], b = px[i + 2];
    if (px[i + 3] < 128 || r < 150) return false;
    const gr = g / r, br = b / r;
    return r > g && g > b && gr > 0.62 && gr < 0.93 && br > 0.45 && br < 0.86; // coral shirts fail g/r
  };
  const lim = y0 + Math.round(H * 0.5);
  const lab = new Int32Array(w * h).fill(-1);
  const comps: { n: number; x0: number; x1: number; y0: number; y1: number; sx: number }[] = [];
  for (let y = y0; y < lim; y++)
    for (let x = x0; x <= x1; x++) {
      if (lab[y * w + x] >= 0 || !skin(x, y)) continue;
      const id = comps.length;
      const c = { n: 0, x0: x, x1: x, y0: y, y1: y, sx: 0 };
      const st = [y * w + x];
      lab[y * w + x] = id;
      while (st.length) {
        const k = st.pop()!, cx = k % w, cy = (k - cx) / w;
        c.n++, (c.sx += cx);
        c.x0 = Math.min(c.x0, cx), (c.x1 = Math.max(c.x1, cx)), (c.y0 = Math.min(c.y0, cy)), (c.y1 = Math.max(c.y1, cy));
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < x0 || nx > x1 || ny < y0 || ny >= lim) continue;
          const kk = ny * w + nx;
          if (lab[kk] < 0 && skin(nx, ny)) (lab[kk] = id), st.push(kk);
        }
      }
      comps.push(c);
    }
  const cands = comps.filter((c) => c.n >= W * H * 0.006);
  if (!cands.length) return null;
  const score = (c: (typeof comps)[number]) => Math.abs(c.sx / c.n - headX) / W + (c.y0 - y0) / H;
  const f = cands.sort((a, b) => score(a) - score(b))[0];
  const id = comps.indexOf(f);
  const band = Math.max(2, Math.round(H * 0.07));
  let bx0 = w, bx1 = -1;
  for (let y = f.y0; y < Math.min(f.y1 + 1, f.y0 + band); y++) for (let x = f.x0; x <= f.x1; x++) if (lab[y * w + x] === id) (bx0 = Math.min(bx0, x)), (bx1 = Math.max(bx1, x));
  const wf = bx1 - bx0 + 1, cx = (bx0 + bx1 + 1) / 2;
  return [Math.max(f.x0, cx - 0.75 * wf) / w, f.y0 / h, Math.min(f.x1 + 1, cx + 0.75 * wf) / w, Math.min(f.y1 + 1, f.y0 + 1.3 * wf) / h];
}

// Mouth frames (<pose>-mulut-closed/mid/open.png) are the pose with another mouth: measure the pose
// itself, so the face box (and the caption place) stays the same while a character talks.
const baseOf = (src: string) => src.replace(/-mulut-(?:closed|mid|open)\.png/, ".png");
const known = new Map<string, Box | null>();
const loading = new Map<string, Promise<void>>();
const analyse = (src: string) => {
  if (!loading.has(src))
    loading.set(
      src,
      new Promise<void>((resolve) => {
        const im = new Image();
        im.onload = () => {
          const c = document.createElement("canvas");
          const w = (c.width = Math.ceil(im.naturalWidth / 4));
          const h = (c.height = Math.ceil(im.naturalHeight / 4));
          const g = c.getContext("2d", { willReadFrequently: true })!;
          g.drawImage(im, 0, 0, w, h);
          known.set(src, faceOf(w, h, g.getImageData(0, 0, w, h).data));
          resolve();
        };
        im.onerror = () => (known.set(src, null), resolve());
        im.src = src;
      }),
    );
  return loading.get(src)!;
};

// Opacity as seen on screen: a character fading in or out is not judged.
const shownOpacity = (el: Element | null) => {
  let o = 1;
  for (; el; el = el.parentElement) o *= Number(getComputedStyle(el).opacity);
  return o;
};

// Position of an element in layout space: offsets only, so no CSS transform counts (breathing,
// tilt, a character sliding in, camera moves). Captions decide on this so their place stays the same
// for a whole line instead of flickering with every small move.
export const layoutRect = (el: HTMLElement): Rect => {
  let x = 0, y = 0;
  for (let e: HTMLElement | null = el; e; e = e.offsetParent as HTMLElement | null) (x += e.offsetLeft), (y += e.offsetTop);
  return { x0: x, y0: y, x1: x + el.offsetWidth, y1: y + el.offsetHeight };
};

// Faces of the characters inside `root` (a scene; the document by default). layout: positions
// without transforms (see layoutRect); otherwise as seen on screen. `pending` holds the images
// still loading or not analysed yet (a layout effect often runs before <Img> has loaded): wait for
// whenReady(pending) and measure again.
export const findFaces = (root: ParentNode = document, layout = false): { faces: (Rect & { name: string })[]; pending: Promise<unknown>[] } => {
  const faces: (Rect & { name: string })[] = [];
  const pending: Promise<unknown>[] = [];
  for (const img of Array.from(root.querySelectorAll("img"))) {
    const name = img.src.match(CHAR_IMG)?.[1];
    if (!name || !img.offsetParent) continue;
    const base = baseOf(img.src);
    if (!img.complete || !img.naturalWidth || !known.has(base)) {
      pending.push(analyse(base), img.decode().catch(() => undefined));
      continue;
    }
    const box = known.get(base);
    if (!box || (!layout && shownOpacity(img) < 0.35)) continue;
    const b = layout ? layoutRect(img) : (({ left, top, right, bottom }) => ({ x0: left, y0: top, x1: right, y1: bottom }))(img.getBoundingClientRect());
    const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    if (!bw) continue;
    let [fx0, fy0, fx1, fy1] = box;
    if (new DOMMatrix(getComputedStyle(img).transform).a < 0) [fx0, fx1] = [1 - fx1, 1 - fx0]; // scaleX(-1)
    faces.push({ name, x0: b.x0 + fx0 * bw, x1: b.x0 + fx1 * bw, y0: b.y0 + fy0 * bh, y1: b.y0 + fy1 * bh });
  }
  return { faces, pending };
};
export const whenReady = (pending: Promise<unknown>[]) => Promise.all(pending);

export const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
