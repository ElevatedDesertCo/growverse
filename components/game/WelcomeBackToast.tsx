"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Flame, Leaf } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BUILDINGS } from "@/lib/buildings";
import {
  getPendingFire,
  isReadyToHarvest,
  statAtLevel,
} from "@/lib/economy";
import { useGameStore } from "@/lib/store";

const SHOW_MS = 4500;

interface Summary {
  readyTents: number;
  pendingFire: number;
}

function computeSummary(): Summary {
  const buildings = useGameStore.getState().buildings;
  const now = Date.now();
  let readyTents = 0;
  let pendingFire = 0;
  for (const b of buildings) {
    const def = BUILDINGS[b.type];
    if (def.growDurationMs && b.plantedAt !== undefined) {
      if (isReadyToHarvest(b.plantedAt, def.growDurationMs, now)) readyTents++;
    }
    if (def.firePerSecond && b.lastGenerated !== undefined) {
      pendingFire += getPendingFire(
        b.lastGenerated,
        statAtLevel(def.firePerSecond, b.level),
        now,
      );
    }
  }
  return { readyTents, pendingFire };
}

export function WelcomeBackToast() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const shownRef = useRef(false);

  useEffect(() => {
    if (shownRef.current) return;

    const fireOnce = () => {
      if (shownRef.current) return;
      shownRef.current = true;
      const s = computeSummary();
      if (s.readyTents === 0 && s.pendingFire === 0) return;
      setSummary(s);
      const t = setTimeout(() => setSummary(null), SHOW_MS);
      return () => clearTimeout(t);
    };

    // Wait for persist rehydration before reading buildings.
    if (useGameStore.persist?.hasHydrated?.()) {
      return fireOnce();
    }
    const unsubscribe = useGameStore.persist?.onFinishHydration?.(() => {
      fireOnce();
    });
    return unsubscribe;
  }, []);

  return (
    <AnimatePresence>
      {summary && (
        <motion.div
          key="welcome-back"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top)+4.5rem)] z-40 -translate-x-1/2"
          role="status"
        >
          <div className="flex items-center gap-3 rounded-full border border-gold/40 bg-bg-deep/95 px-4 py-2 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)] backdrop-blur">
            <span
              className="font-display text-[10px] font-semibold uppercase tracking-[0.3em] text-gold"
              style={{ fontFamily: "var(--font-cinzel)" }}
            >
              Welcome back
            </span>
            <span className="h-3 w-px bg-gold/30" aria-hidden />
            <div className="flex items-center gap-2 text-xs">
              {summary.readyTents > 0 && (
                <span className="flex items-center gap-1 text-leaf">
                  <Leaf className="h-3 w-3" strokeWidth={2.5} />
                  <span className="font-sans font-bold tabular-nums">
                    {summary.readyTents}
                  </span>
                  <span className="text-text-muted">
                    {summary.readyTents === 1 ? "tent" : "tents"}
                  </span>
                </span>
              )}
              {summary.pendingFire > 0 && (
                <span className="flex items-center gap-1 text-fire">
                  <Flame className="h-3 w-3" strokeWidth={2.5} />
                  <span className="font-sans font-bold tabular-nums">
                    {summary.pendingFire}
                  </span>
                  <span className="text-text-muted">pending</span>
                </span>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
