/**
 * Reduced-motion preference. Persisted to localStorage so the player's
 * choice survives reloads. Honored by:
 *   - Fireflies (skips render entirely)
 *   - GameShell parallax (skips animated layer)
 *   - Building idle bob (skips loop animation)
 *   - Other heavy looping effects can opt in via isReducedMotion()
 *
 * Also auto-detects the OS-level `prefers-reduced-motion: reduce`
 * media query on first read, so users with system accessibility
 * settings get the right default.
 */

const KEY = "growverse-reduced-motion";

type ReducedSetting = "auto" | "on" | "off";

let cached: ReducedSetting | null = null;

function read(): ReducedSetting {
  if (typeof window === "undefined") return "auto";
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === "on" || raw === "off") return raw;
    return "auto";
  } catch {
    return "auto";
  }
}

function osPrefersReduced(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

const listeners = new Set<() => void>();

export function getReducedSetting(): ReducedSetting {
  if (cached === null) cached = read();
  return cached;
}

export function isReducedMotion(): boolean {
  const s = getReducedSetting();
  if (s === "on") return true;
  if (s === "off") return false;
  return osPrefersReduced();
}

export function setReducedSetting(s: ReducedSetting): void {
  cached = s;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, s);
    } catch {
      /* storage disabled */
    }
  }
  for (const fn of listeners) fn();
}

export function subscribeReduced(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
