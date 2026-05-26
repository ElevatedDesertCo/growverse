/**
 * Music system facade.
 *
 * Plays a single looping background track (the base ambient) via a
 * cached HTMLAudioElement. Mirrors the audioSystem pattern: never
 * crashes when a file is missing, silently swallows autoplay
 * rejections, no-ops in SSR.
 *
 * Browsers block autoplay until the user has interacted with the page,
 * so playMusic() may be called from event handlers (e.g. splash
 * dismiss, first tap) and will start whenever the next interaction
 * occurs. Mute state persists across reloads via localStorage.
 */

import { MUSIC_ASSETS } from "@/lib/data/assetManifest";

export type TrackName = keyof typeof MUSIC_ASSETS;

const cache = new Map<string, HTMLAudioElement>();

const MUTED_KEY = "growverse-music-muted";
const VOLUME_KEY = "growverse-music-volume";

interface MusicState {
  /** True if the user has toggled music off. Persisted. */
  muted: boolean;
  /** 0.0–1.0 master music volume. Persisted. */
  volume: number;
  /** Currently-playing track name, or null. */
  current: TrackName | null;
}

function readPersisted(): { muted: boolean; volume: number } {
  if (typeof window === "undefined") return { muted: false, volume: 0.35 };
  try {
    const m = localStorage.getItem(MUTED_KEY);
    const v = localStorage.getItem(VOLUME_KEY);
    return {
      muted: m === "1",
      volume: v !== null ? Math.max(0, Math.min(1, parseFloat(v) || 0.35)) : 0.35,
    };
  } catch {
    return { muted: false, volume: 0.35 };
  }
}

const persisted = readPersisted();
const state: MusicState = {
  muted: persisted.muted,
  volume: persisted.volume,
  current: null,
};

function getAudio(track: TrackName): HTMLAudioElement | null {
  const entry = MUSIC_ASSETS[track];
  if (!entry) return null;
  // Placeholder entries won't have a file on disk yet — play attempt
  // will 404 silently. Caller already handles via the playPromise catch.
  if (typeof window === "undefined") return null;
  let audio = cache.get(entry.path);
  if (!audio) {
    try {
      audio = new Audio(entry.path);
      audio.loop = true;
      audio.preload = "auto";
      audio.volume = state.volume;
      cache.set(entry.path, audio);
    } catch {
      return null;
    }
  }
  return audio;
}

/** Fade an audio element's volume over `durMs` to `target`. Cancels
 *  any in-flight fade for the same element via the ramp counter. */
const fadeIds = new WeakMap<HTMLAudioElement, number>();
let fadeCounter = 0;
function fade(audio: HTMLAudioElement, target: number, durMs: number): void {
  const start = audio.volume;
  const delta = target - start;
  if (Math.abs(delta) < 0.005 || durMs <= 0) {
    audio.volume = target;
    return;
  }
  fadeCounter += 1;
  const myId = fadeCounter;
  fadeIds.set(audio, myId);
  const t0 = performance.now();
  const step = () => {
    if (fadeIds.get(audio) !== myId) return; // newer fade superseded
    const t = (performance.now() - t0) / durMs;
    if (t >= 1) {
      audio.volume = target;
      return;
    }
    audio.volume = start + delta * t;
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Start (or resume) the given track. Fades in from 0 over ~1.2s so
 *  the music doesn't slam in mid-render. Pauses any other current
 *  track first. */
export function playMusic(track: TrackName): void {
  if (typeof window === "undefined") return;
  if (state.muted) {
    // Track the intent so unmute restarts it without a re-call.
    state.current = track;
    return;
  }
  // Pause any previous track that isn't the requested one.
  if (state.current && state.current !== track) {
    const prev = getAudio(state.current);
    if (prev) {
      fade(prev, 0, 600);
      window.setTimeout(() => prev.pause(), 650);
    }
  }
  const audio = getAudio(track);
  if (!audio) return;
  state.current = track;
  // Always re-fade from 0 → state.volume so resumed tracks don't slam.
  audio.volume = 0;
  try {
    const p = audio.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        /* autoplay blocked / file missing — silent */
      });
    }
    fade(audio, state.volume, 1200);
  } catch {
    /* silent */
  }
}

export function pauseMusic(): void {
  if (typeof window === "undefined") return;
  if (state.current) {
    const audio = getAudio(state.current);
    audio?.pause();
  }
}

export function setMusicMuted(muted: boolean): void {
  state.muted = muted;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(MUTED_KEY, muted ? "1" : "0");
    } catch {
      /* storage disabled */
    }
  }
  if (muted) {
    pauseMusic();
  } else if (state.current) {
    playMusic(state.current);
  }
}

export function isMusicMuted(): boolean {
  return state.muted;
}

export function setMusicVolume(volume: number): void {
  const clamped = Math.max(0, Math.min(1, volume));
  state.volume = clamped;
  cache.forEach((a) => {
    a.volume = clamped;
  });
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(VOLUME_KEY, String(clamped));
    } catch {
      /* storage disabled */
    }
  }
}

export function getMusicVolume(): number {
  return state.volume;
}
