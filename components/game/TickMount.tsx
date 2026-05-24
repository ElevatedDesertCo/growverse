"use client";

import { useEffect } from "react";
import { useGameStore } from "@/lib/store";

const TICK_MS = 500;

/**
 * Mounts the global tick interval AND triggers persist rehydration on
 * first client render. We skipHydration in the store config so the SSR
 * pass renders default state; this effect pulls the real save in.
 */
export function TickMount() {
  useEffect(() => {
    // Rehydrate from localStorage (client-only). No-op if already done.
    useGameStore.persist?.rehydrate?.();

    // Fire an immediate tick so first render isn't stuck at _tickAt: 0.
    useGameStore.getState().tick();
    const id = setInterval(() => {
      useGameStore.getState().tick();
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);
  return null;
}
