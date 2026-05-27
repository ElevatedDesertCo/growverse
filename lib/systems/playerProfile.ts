/**
 * Local player profile. Just a display name for now — no auth, no
 * server. Persists in localStorage. Defaults to "Grower" when unset.
 * The HUD subtitle reads from here so the player can personalize.
 */

const NAME_KEY = "growverse-display-name";
const MAX_LEN = 24;

let cached: string | null = null;
const listeners = new Set<() => void>();

function read(): string {
  if (typeof window === "undefined") return "Grower";
  try {
    const raw = window.localStorage.getItem(NAME_KEY);
    if (!raw) return "Grower";
    const trimmed = raw.trim().slice(0, MAX_LEN);
    return trimmed || "Grower";
  } catch {
    return "Grower";
  }
}

export function getDisplayName(): string {
  if (cached === null) cached = read();
  return cached;
}

export function setDisplayName(name: string): void {
  const trimmed = name.trim().slice(0, MAX_LEN);
  cached = trimmed || "Grower";
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(NAME_KEY, cached);
    } catch {
      /* storage disabled */
    }
  }
  for (const fn of listeners) fn();
}

export function subscribeDisplayName(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
