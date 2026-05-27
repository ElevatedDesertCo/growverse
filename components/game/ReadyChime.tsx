"use client";

import { useEffect, useRef } from "react";
import { BUILDINGS } from "@/lib/buildings";
import { isReadyToHarvest } from "@/lib/economy";
import { useGameStore } from "@/lib/store";
import { playSfx } from "@/lib/systems/audioSystem";

/**
 * Headless ambient cue. Subscribes to the global tick and fires a short
 * chime whenever a Grow Tent transitions from growing → ready. Tracks
 * previous ready IDs in a ref so the effect never causes a re-render.
 * Throttled so a stampede of simultaneous ready transitions only fires
 * the chime once.
 *
 * - Skips the very first tick after mount so an existing batch of ready
 *   gardens on app start doesn't blast the player.
 * - Respects the audio mute setting via the underlying playSfx (which
 *   already gates on mute), so no extra wiring needed.
 */

const THROTTLE_MS = 2000;

export function ReadyChime() {
  const tickAt = useGameStore((s) => s._tickAt);
  const buildings = useGameStore((s) => s.buildings);
  const prevReadyRef = useRef<Set<string> | null>(null);
  const lastChimeAtRef = useRef(0);

  useEffect(() => {
    const now = Date.now();
    const currentReady = new Set<string>();
    for (const b of buildings) {
      const def = BUILDINGS[b.type];
      if (def.growDurationMs && b.plantedAt !== undefined) {
        if (isReadyToHarvest(b.plantedAt, def.growDurationMs, now)) {
          currentReady.add(b.id);
        }
      }
    }
    const prev = prevReadyRef.current;
    prevReadyRef.current = currentReady;
    if (prev === null) return; // first tick — establish baseline only
    let newlyReady = 0;
    for (const id of currentReady) {
      if (!prev.has(id)) newlyReady++;
    }
    if (newlyReady > 0 && now - lastChimeAtRef.current >= THROTTLE_MS) {
      lastChimeAtRef.current = now;
      playSfx("resourceCollect");
    }
  }, [tickAt, buildings]);

  return null;
}
