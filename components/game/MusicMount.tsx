"use client";

import { useEffect } from "react";
import {
  isMusicMuted,
  pauseMusic,
  playMusic,
} from "@/lib/systems/musicSystem";

/**
 * Headless component. Browsers block autoplay until the user has
 * interacted with the page, so we register one-shot listeners
 * (pointer/key) that kick off the base ambient on first click/tap.
 * Listeners self-cleanup after firing once.
 *
 * Also wires Page Visibility — pauses music when the tab goes to the
 * background, resumes (with fade-in) when it comes back, so the player
 * doesn't leak music into other tabs.
 */
export function MusicMount() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    let fired = false;
    const start = () => {
      if (fired) return;
      fired = true;
      playMusic("baseAmbient");
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
    };
    window.addEventListener("pointerdown", start, { once: false });
    window.addEventListener("keydown", start, { once: false });
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => {
      if (document.hidden) {
        pauseMusic();
      } else if (!isMusicMuted()) {
        playMusic("baseAmbient");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
