/**
 * Programmatic chroma-key for asset PNGs.
 *
 * Many of the v1 reference-sheet PNGs (buildings + decor) have flat
 * paper-cream backgrounds with no alpha channel. CSS masking can only
 * crop them into circles, leaving cream pixels at the soft edges and
 * any building art that lives on its own cream "ground patch" stuck
 * with that background.
 *
 * This module loads an image into a canvas, samples the corner pixels
 * to detect the dominant background color, removes any pixel within
 * `tolerance` of that color (alpha → 0), and returns a transparent
 * data-URL version. Results are cached per source path so each PNG is
 * only processed once.
 *
 * Failures are silent — on any error, the original path is returned
 * (the caller just renders the un-keyed image, identical to current
 * behavior).
 */

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

interface ChromaOptions {
  /** Max RGB component delta from background sample for a pixel to be
   *  considered "background". Default 50 covers paper white + soft
   *  cream + the warm beige of v1 reference-sheet panels. */
  tolerance?: number;
  /** Feather: pixels within `tolerance` get full transparency; pixels
   *  in `tolerance..tolerance+feather` get partial alpha for a soft
   *  edge. Default 22. */
  feather?: number;
  /** Crop padding to skip any solid border pixels when sampling
   *  corners. Default 4. */
  samplePad?: number;
  /** Optional sub-region (normalized 0..1) — when set, the resulting
   *  data URL is the chroma-keyed CROP of that region only. Lets us
   *  chroma-key against the inner panel's own background instead of
   *  the outer paper-white of the full sheet. */
  focus?: { x: number; y: number; w: number; h: number };
}

const DEFAULT_OPTS: Required<Omit<ChromaOptions, "focus">> = {
  tolerance: 85,
  feather: 30,
  samplePad: 4,
};

function distance(
  r: number,
  g: number,
  b: number,
  r2: number,
  g2: number,
  b2: number,
): number {
  const dr = r - r2;
  const dg = g - g2;
  const db = b - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function cacheKey(path: string, focus?: { x: number; y: number; w: number; h: number }): string {
  if (!focus) return path;
  return `${path}#${focus.x},${focus.y},${focus.w},${focus.h}`;
}

/**
 * Load + chroma-key the image at `path` (optionally only the focal
 * sub-region of it). Returns a transparent-bg data URL on success, or
 * the original path on any failure / SSR. Idempotent + cached per
 * path+focus combination.
 */
export function chromaKeyImage(
  path: string,
  options?: ChromaOptions,
): Promise<string> {
  if (typeof window === "undefined") return Promise.resolve(path);
  const key = cacheKey(path, options?.focus);
  if (cache.has(key)) return Promise.resolve(cache.get(key)!);
  if (inflight.has(key)) return inflight.get(key)!;

  const opts: Required<Omit<ChromaOptions, "focus">> & Pick<ChromaOptions, "focus"> = {
    ...DEFAULT_OPTS,
    ...options,
  };
  const p = (async () => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      const loaded = new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("image load failed"));
      });
      img.src = path;
      await loaded;

      // Pick canvas dimensions: full image or just the focal crop.
      const srcW = img.naturalWidth;
      const srcH = img.naturalHeight;
      const f = opts.focus;
      const cropX = f ? Math.floor(f.x * srcW) : 0;
      const cropY = f ? Math.floor(f.y * srcH) : 0;
      const cropW = f ? Math.floor(f.w * srcW) : srcW;
      const cropH = f ? Math.floor(f.h * srcH) : srcH;
      const w = cropW;
      const h = cropH;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return path;
      // Draw the crop region onto a w×h canvas.
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, w, h);
      let imageData: ImageData;
      try {
        imageData = ctx.getImageData(0, 0, w, h);
      } catch {
        // CORS-tainted canvas (shouldn't happen for same-origin images).
        return path;
      }
      const data = imageData.data;

      // Sample 4 corners + 4 mid-edges (with small pad) so even if a
      // prop bleeds into a corner, mid-edges still pin the bg color.
      const pad = opts.samplePad;
      const sampleAt = (x: number, y: number) => {
        const i = (y * w + x) * 4;
        return [data[i], data[i + 1], data[i + 2]] as const;
      };
      const midX = Math.floor(w / 2);
      const midY = Math.floor(h / 2);
      const samples = [
        sampleAt(pad, pad),
        sampleAt(w - 1 - pad, pad),
        sampleAt(pad, h - 1 - pad),
        sampleAt(w - 1 - pad, h - 1 - pad),
        sampleAt(midX, pad),
        sampleAt(midX, h - 1 - pad),
        sampleAt(pad, midY),
        sampleAt(w - 1 - pad, midY),
      ];
      // Use median (per-channel) instead of mean — robust against
      // a few sample points containing prop pixels.
      const median = (arr: number[]): number => {
        const sorted = [...arr].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
      };
      const bgR = median(samples.map((s) => s[0]));
      const bgG = median(samples.map((s) => s[1]));
      const bgB = median(samples.map((s) => s[2]));

      // For each pixel, compute distance to background and remap alpha.
      const tol = opts.tolerance;
      const feather = opts.feather;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const d = distance(r, g, b, bgR, bgG, bgB);
        if (d <= tol) {
          data[i + 3] = 0;
        } else if (d <= tol + feather) {
          const t = (d - tol) / feather;
          data[i + 3] = Math.round(255 * t);
        }
        // else keep original alpha
      }
      ctx.putImageData(imageData, 0, 0);
      const url = canvas.toDataURL("image/png");
      cache.set(key, url);
      return url;
    } catch {
      return path;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/** Synchronous accessor — returns cached data URL if present, else null. */
export function chromaKeyCached(
  path: string,
  focus?: { x: number; y: number; w: number; h: number },
): string | null {
  return cache.get(cacheKey(path, focus)) ?? null;
}
