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
          initial={{ opacity: 0, y: -14, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.96 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top)+4.5rem)] z-40 -translate-x-1/2"
          role="status"
        >
          <div
            className="flex items-center gap-2.5 rounded-2xl p-[1.5px]"
            style={{
              background:
                "linear-gradient(135deg, rgba(212,160,74,0.95) 0%, rgba(212,160,74,0.45) 50%, rgba(212,160,74,0.25) 100%)",
              boxShadow:
                "0 10px 28px -10px rgba(0,0,0,0.75), 0 0 22px -6px rgba(212,160,74,0.45)",
            }}
          >
            <div className="flex items-center gap-3 rounded-[14px] bg-bg-deep/95 px-3.5 py-2 backdrop-blur">
              <div
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
                style={{
                  background:
                    "radial-gradient(circle at 35% 30%, #f5d97aaa, #d4a04a 50%, #8b6c2e 100%)",
                  boxShadow:
                    "inset 0 0 0 1px rgba(212,160,74,0.85), 0 0 8px rgba(212,160,74,0.5)",
                }}
                aria-hidden
              >
                <Leaf
                  className="h-3.5 w-3.5 text-bg-deep"
                  strokeWidth={2.75}
                  style={{
                    filter: "drop-shadow(0 1px 0 rgba(255,255,255,0.35))",
                  }}
                />
              </div>
              <div className="flex flex-col items-start leading-tight">
                <span
                  className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-gold"
                  style={{ fontFamily: "var(--font-cinzel)" }}
                >
                  Welcome back
                </span>
                <div className="mt-0.5 flex items-center gap-2 text-[11px]">
                  {summary.readyTents > 0 && (
                    <span className="flex items-center gap-1 text-leaf">
                      <Leaf className="h-2.5 w-2.5" strokeWidth={2.5} />
                      <span className="font-sans font-bold tabular-nums">
                        {summary.readyTents}
                      </span>
                      <span className="text-text-muted">
                        {summary.readyTents === 1 ? "garden" : "gardens"}
                      </span>
                    </span>
                  )}
                  {summary.pendingFire > 0 && (
                    <span className="flex items-center gap-1 text-fire">
                      <Flame className="h-2.5 w-2.5" strokeWidth={2.5} />
                      <span className="font-sans font-bold tabular-nums">
                        {summary.pendingFire}
                      </span>
                      <span className="text-text-muted">pending</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
