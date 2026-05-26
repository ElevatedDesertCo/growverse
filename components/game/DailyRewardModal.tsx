"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Gift, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useGameStore } from "@/lib/store";
import { playSfx } from "@/lib/systems/audioSystem";
import {
  getPendingDailyReward,
  markDailyClaimed,
  type DailyRewardBundle,
} from "@/lib/systems/dailyReward";
import type { Resources } from "@/lib/systems/resourceSystem";
import { bump as bumpStat } from "@/lib/systems/statsSystem";

const RESOURCE_LABEL: Record<keyof Resources, string> = {
  bloomEssence: "Bloom",
  amberShards: "Amber",
  mycoDust: "Myco",
  relicFragments: "Relic",
  spiritSeeds: "Seeds",
  portalEnergy: "Portal",
  guildXp: "XP",
  cardShards: "Shards",
};

const RESOURCE_ACCENT: Record<keyof Resources, string> = {
  bloomEssence: "#7fb069",
  amberShards: "#e8964c",
  mycoDust: "#a875d4",
  relicFragments: "#c9a878",
  spiritSeeds: "#9ed16e",
  portalEnergy: "#b78ddf",
  guildXp: "#d4a04a",
  cardShards: "#d4a04a",
};

/**
 * Daily login bonus. Mounts at GameShell, waits until the persist
 * rehydration finishes (so we don't grant resources before the save
 * loads), then opens if today hasn't been claimed.
 */
export function DailyRewardModal() {
  const [mounted, setMounted] = useState(false);
  const [bundle, setBundle] = useState<DailyRewardBundle | null>(null);
  const [claimed, setClaimed] = useState(false);
  const grantResources = useGameStore((s) => s.grantResources);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // Wait for store rehydration before checking the daily claim. The
  // store uses skipHydration:true so we listen for the rehydrate
  // completion event.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const check = () => {
      if (cancelled) return;
      const pending = getPendingDailyReward();
      if (pending) {
        setBundle(pending);
      }
    };
    const persist = useGameStore.persist;
    if (persist?.hasHydrated?.()) {
      check();
    } else {
      const unsubscribe = persist?.onFinishHydration?.(check);
      return () => {
        cancelled = true;
        unsubscribe?.();
      };
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const close = () => {
    playSfx("buttonClick");
    setBundle(null);
  };

  const handleClaim = () => {
    if (!bundle || claimed) return;
    setClaimed(true);
    grantResources(bundle.amounts);
    markDailyClaimed();
    bumpStat("dailyRewardsClaimed");
    playSfx("upgradeComplete");
    // Hold the celebration briefly, then dismiss.
    window.setTimeout(close, 800);
  };

  if (!mounted || !bundle) return null;
  const entries = Object.entries(bundle.amounts).filter(
    ([, v]) => (v ?? 0) > 0,
  ) as [keyof Resources, number][];

  return createPortal(
    <AnimatePresence>
      {bundle && (
        <>
          <motion.div
            key="dr-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={close}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            aria-hidden
          />
          <motion.div
            key="dr-modal"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.26, ease: "easeOut" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="daily-reward-title"
            className="fixed left-1/2 top-1/2 z-50 w-[min(22rem,92vw)] -translate-x-1/2 -translate-y-1/2"
          >
            <div
              className="rounded-2xl p-[2px]"
              style={{
                background:
                  "linear-gradient(180deg, #e6c98a 0%, #b8852e 50%, #5a3f1a 100%)",
                boxShadow:
                  "0 24px 60px -20px rgba(0,0,0,0.8), 0 0 60px -10px rgba(212,160,74,0.45)",
              }}
            >
              <div className="relative flex flex-col items-center gap-3 rounded-2xl bg-bg-deep/95 p-6 backdrop-blur">
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="absolute right-2 top-2 rounded-full p-1.5 text-text-muted transition-colors hover:bg-bg-mid/60 hover:text-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>

                <motion.div
                  className="flex h-16 w-16 items-center justify-center rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle at 35% 30%, #f5d97aaa, #d4a04a 50%, #8b6c2e 100%)",
                    boxShadow:
                      "0 0 22px rgba(212,160,74,0.65), inset 0 1px 0 rgba(255,255,255,0.35)",
                  }}
                  animate={claimed ? { rotate: [0, -10, 10, -8, 8, 0] } : {}}
                  transition={{ duration: 0.6 }}
                  aria-hidden
                >
                  <Gift className="h-8 w-8 text-bg-deep" strokeWidth={2.25} />
                </motion.div>

                <h2
                  id="daily-reward-title"
                  className="font-display text-base font-bold uppercase tracking-[0.24em] text-gold"
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    textShadow: "0 1px 0 rgba(0,0,0,0.55)",
                  }}
                >
                  {bundle.title}
                </h2>

                <p className="max-w-[18rem] text-center text-[12px] leading-snug text-text-muted">
                  {bundle.body}
                </p>

                {/* Reward chips */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {entries.map(([k, v]) => {
                    const accent = RESOURCE_ACCENT[k];
                    return (
                      <div
                        key={k}
                        className="flex items-center gap-1.5 rounded-full border border-gold/30 bg-bg-mid/60 px-2.5 py-1"
                      >
                        <span
                          className="font-display text-sm font-bold tabular-nums"
                          style={{
                            color: accent,
                            textShadow: "0 1px 0 rgba(0,0,0,0.55)",
                          }}
                        >
                          +{v}
                        </span>
                        <span className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                          {RESOURCE_LABEL[k]}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleClaim}
                  disabled={claimed}
                  className="mt-2 inline-flex items-center justify-center rounded-full bg-gold px-6 py-2 font-display text-xs font-bold uppercase tracking-[0.22em] text-bg-deep shadow-[0_4px_18px_-6px_rgba(212,160,74,0.7)] transition-colors hover:bg-gold-dark active:bg-gold-dark disabled:cursor-not-allowed disabled:bg-gold-muted disabled:text-bg-deep/60"
                >
                  {claimed ? "Claimed!" : "Claim"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
