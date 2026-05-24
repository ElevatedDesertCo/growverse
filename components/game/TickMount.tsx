"use client";

import { useEffect } from "react";
import { useGameStore } from "@/lib/store";

const TICK_MS = 500;

/**
 * Mounts a single global setInterval that bumps `_tickAt` in the store
 * every 500ms. Time-aware components (DraggableBuilding) subscribe to
 * _tickAt so their render outputs refresh ~2/sec without owning their
 * own intervals. ResourceBar does NOT subscribe — it only re-renders
 * when resources actually change.
 */
export function TickMount() {
  useEffect(() => {
    // Fire an immediate tick so first render isn't stuck at _tickAt: 0.
    useGameStore.getState().tick();
    const id = setInterval(() => {
      useGameStore.getState().tick();
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);
  return null;
}
