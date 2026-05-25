"use client";

import { useEffect } from "react";
import { playMusic } from "@/lib/systems/musicSystem";

/**
 * Headless component. Browsers block autoplay until the user has
 * interacted with the page, so we register one-shot listeners
 * (pointer/key) that kick off the base ambient on first click/tap.
 * Listeners self-cleanup after firing once.
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

  return null;
}
