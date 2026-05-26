/**
 * Audio system facade.
 *
 * Plays SFX via cached HTMLAudioElement instances. Loading and playback
 * are wrapped in try/catch + .catch() chains so the game never crashes
 * when an audio file is missing — it just silently no-ops.
 *
 * SFX names map to entries in lib/data/assetManifest.ts SFX_ASSETS.
 * Add a new sound: drop the MP3 at /public/assets/audio/sfx/<name>.mp3,
 * add an entry in SFX_ASSETS with status: "final", call playSfx("name").
 *
 * Volume + mute control is persisted in localStorage so player
 * preferences survive reloads.
 */

import { SFX_ASSETS } from "@/lib/data/assetManifest";

export type SfxName = keyof typeof SFX_ASSETS;

const cache = new Map<string, HTMLAudioElement>();

const MUTED_KEY = "growverse-sfx-muted";
const VOLUME_KEY = "growverse-sfx-volume";

interface AudioState {
  muted: boolean;
  /** 0.0–1.0 master SFX volume. */
  volume: number;
}

function readPersisted(): AudioState {
  if (typeof window === "undefined") return { muted: false, volume: 0.6 };
  try {
    const m = localStorage.getItem(MUTED_KEY);
    const v = localStorage.getItem(VOLUME_KEY);
    return {
      muted: m === "1",
      volume:
        v !== null ? Math.max(0, Math.min(1, parseFloat(v) || 0.6)) : 0.6,
    };
  } catch {
    return { muted: false, volume: 0.6 };
  }
}

const state: AudioState = readPersisted();

export function setMuted(muted: boolean) {
  state.muted = muted;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(MUTED_KEY, muted ? "1" : "0");
    } catch {
      /* storage disabled */
    }
  }
}

export function isMuted(): boolean {
  return state.muted;
}

export function setVolume(volume: number) {
  state.volume = Math.max(0, Math.min(1, volume));
  cache.forEach((a) => {
    a.volume = state.volume;
  });
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(VOLUME_KEY, String(state.volume));
    } catch {
      /* storage disabled */
    }
  }
}

export function getVolume(): number {
  return state.volume;
}

/**
 * Play a sound by SFX name. Safe to call from event handlers — never
 * throws. No-ops in SSR, when muted, or when the file is missing.
 */
export function playSfx(name: SfxName): void {
  if (typeof window === "undefined") return;
  if (state.muted) return;

  const entry = SFX_ASSETS[name];
  if (!entry) return;
  // Placeholder entries point at paths that don't exist yet — load attempt
  // will 404 silently and play() will reject. Both swallowed.
  const path = entry.path;

  try {
    let audio = cache.get(path);
    if (!audio) {
      audio = new Audio(path);
      audio.preload = "auto";
      audio.volume = state.volume;
      cache.set(path, audio);
    }
    // Restart from the top so rapid taps queue cleanly.
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        /* missing file / autoplay block / mid-load interrupt — silent */
      });
    }
  } catch {
    /* missing file / DOMException — silent */
  }
}

/**
 * Pre-load an SFX so the first play() doesn't stall on the network
 * request. Optional — most SFX are <100KB so on-demand loading is fine.
 */
export function preloadSfx(name: SfxName): void {
  if (typeof window === "undefined") return;
  const entry = SFX_ASSETS[name];
  if (!entry) return;
  if (cache.has(entry.path)) return;
  try {
    const audio = new Audio(entry.path);
    audio.preload = "auto";
    audio.volume = state.volume;
    cache.set(entry.path, audio);
  } catch {
    /* silent */
  }
}
