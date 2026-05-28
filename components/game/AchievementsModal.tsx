"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Filter, Trophy, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { playSfx } from "@/lib/systems/audioSystem";
import {
  getStats,
  MILESTONES,
  type Milestone,
  subscribeStats,
  type Stats,
} from "@/lib/systems/statsSystem";

const STAT_LABEL: Record<keyof Stats, string> = {
  buildingsPlaced: "Buildings",
  buildingsUpgraded: "Upgrades",
  decorCleared: "Decor",
  decorRegrown: "Regrowth",
  dailyRewardsClaimed: "Dailies",
  harvestsCollected: "Harvests",
};

/**
 * Full-screen achievements sheet. Lists every defined milestone with
 * its current progress + locked/unlocked state. Trigger: pass `open`
 * prop. Closes on backdrop tap / X / Got It.
 */
export function AchievementsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [unlockedOnly, setUnlockedOnly] = useState(false);
  // Snapshot of milestone ids that were already unlocked at the moment
  // the modal opened. Anything unlocked AFTER that gets the just-unlocked
  // flash so the player notices what changed since their last visit.
  const [initialUnlocked, setInitialUnlocked] = useState<Set<string>>(
    () => new Set(),
  );

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    // Intentional one-shot snapshot when the panel opens, then live
    // subscribe for updates while it's visible.
    const s = getStats();
    const initial = new Set<string>();
    for (const m of MILESTONES) {
      if (s[m.key] >= m.threshold) initial.add(`${m.key}:${m.threshold}`);
    }
    /* eslint-disable react-hooks/set-state-in-effect */
    setInitialUnlocked(initial);
    setStats(s);
    /* eslint-enable react-hooks/set-state-in-effect */
    return subscribeStats(setStats);
  }, [open]);

  const dismiss = () => {
    playSfx("buttonClick");
    onClose();
  };

  if (!mounted) return null;

  const grouped = stats
    ? MILESTONES.map((m) => {
        const id = `${m.key}:${m.threshold}`;
        const unlocked = stats[m.key] >= m.threshold;
        return {
          m,
          current: stats[m.key],
          unlocked,
          progress: Math.min(1, stats[m.key] / m.threshold),
          justUnlocked: unlocked && !initialUnlocked.has(id),
        };
      })
    : [];
  const unlockedCount = grouped.filter((g) => g.unlocked).length;
  const visibleRows = unlockedOnly
    ? grouped.filter((g) => g.unlocked)
    : grouped;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="ach-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={dismiss}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            aria-hidden
          />
          <motion.div
            key="ach-modal"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.26, ease: "easeOut" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="achievements-title"
            className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,94vw)] max-h-[80dvh] -translate-x-1/2 -translate-y-1/2 overflow-hidden"
          >
            <div
              className="rounded-2xl p-[2px]"
              style={{
                background:
                  "linear-gradient(180deg, #e6c98a 0%, #b8852e 50%, #5a3f1a 100%)",
                boxShadow:
                  "0 24px 60px -20px rgba(0,0,0,0.85), 0 0 60px -10px rgba(212,160,74,0.4)",
              }}
            >
              <div className="relative flex max-h-[calc(80dvh-4px)] flex-col rounded-2xl bg-bg-deep/95 backdrop-blur">
                <button
                  type="button"
                  onClick={dismiss}
                  aria-label="Close"
                  className="absolute right-2 top-2 z-10 rounded-full p-1.5 text-text-muted transition-colors hover:bg-bg-mid/60 hover:text-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>
                <header className="flex items-center gap-3 border-b border-gold/15 px-6 py-4">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full"
                    style={{
                      background:
                        "radial-gradient(circle at 35% 30%, #f5d97aaa, #d4a04a 50%, #8b6c2e 100%)",
                      boxShadow:
                        "0 0 14px rgba(212,160,74,0.55), inset 0 1px 0 rgba(255,255,255,0.3)",
                    }}
                    aria-hidden
                  >
                    <Trophy className="h-5 w-5 text-bg-deep" strokeWidth={2.25} />
                  </div>
                  <div className="flex flex-1 flex-col leading-tight">
                    <h2
                      id="achievements-title"
                      className="font-display text-base font-bold uppercase tracking-[0.22em] text-gold"
                      style={{
                        fontFamily: "var(--font-cinzel)",
                        textShadow: "0 1px 0 rgba(0,0,0,0.55)",
                      }}
                    >
                      Achievements
                    </h2>
                    <span className="font-sans text-[10px] uppercase tracking-[0.22em] text-text-muted">
                      {unlockedCount} of {grouped.length} unlocked
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      playSfx("buttonClick");
                      setUnlockedOnly((v) => !v);
                    }}
                    aria-pressed={unlockedOnly}
                    aria-label={
                      unlockedOnly
                        ? "Show all achievements"
                        : "Show only unlocked achievements"
                    }
                    title={
                      unlockedOnly
                        ? "Showing unlocked only — tap to show all"
                        : "Tap to filter to unlocked only"
                    }
                    className={`mr-7 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-display text-[9px] font-bold uppercase tracking-[0.18em] transition-colors ${
                      unlockedOnly
                        ? "border-gold/65 bg-gold/15 text-gold"
                        : "border-gold/30 bg-bg-mid/40 text-text-muted hover:border-gold/50 hover:text-text-primary"
                    }`}
                  >
                    <Filter className="h-3 w-3" strokeWidth={2.5} />
                    Unlocked
                  </button>
                </header>
                <ul className="overflow-y-auto px-3 py-3">
                  {visibleRows.length === 0 && (
                    <li className="px-3 py-6 text-center text-[11px] text-text-muted">
                      No unlocked milestones yet. Start by placing your Guild Core.
                    </li>
                  )}
                  {visibleRows.map(({ m, current, unlocked, progress, justUnlocked }) => (
                    <li key={`${m.key}:${m.threshold}`}>
                      <AchievementRow
                        m={m}
                        current={current}
                        unlocked={unlocked}
                        progress={progress}
                        justUnlocked={justUnlocked}
                      />
                    </li>
                  ))}
                </ul>
                <footer className="border-t border-gold/15 px-6 py-3">
                  <button
                    type="button"
                    onClick={dismiss}
                    className="ml-auto block rounded-full bg-gold px-5 py-2 font-display text-[11px] font-bold uppercase tracking-[0.22em] text-bg-deep shadow-[0_4px_14px_-4px_rgba(212,160,74,0.7)] transition-colors hover:bg-gold-dark"
                  >
                    Got It
                  </button>
                </footer>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function AchievementRow({
  m,
  current,
  unlocked,
  progress,
  justUnlocked,
}: {
  m: Milestone;
  current: number;
  unlocked: boolean;
  progress: number;
  justUnlocked: boolean;
}) {
  return (
    <motion.div
      animate={
        justUnlocked
          ? {
              backgroundColor: [
                "rgba(212,160,74,0.05)",
                `${m.accent}33`,
                "rgba(212,160,74,0.05)",
              ],
              boxShadow: [
                "0 0 0 0 rgba(212,160,74,0)",
                `0 0 20px 2px ${m.accent}66`,
                "0 0 0 0 rgba(212,160,74,0)",
              ],
            }
          : undefined
      }
      transition={
        justUnlocked
          ? { duration: 1.6, repeat: 1, ease: "easeInOut" }
          : undefined
      }
      className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
        unlocked
          ? "bg-gold/5"
          : "hover:bg-bg-mid/40"
      }`}
    >
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
        style={{
          background: unlocked
            ? `radial-gradient(circle at 35% 30%, ${m.accent}cc, ${m.accent}55 60%, ${m.accent}22)`
            : "radial-gradient(circle at 35% 30%, #2a2018, #1a1208 70%)",
          boxShadow: unlocked
            ? `inset 0 0 0 1px ${m.accent}88, 0 0 8px ${m.accent}55`
            : "inset 0 0 0 1px rgba(212,160,74,0.18)",
        }}
        aria-hidden
      >
        {unlocked ? (
          <Check className="h-4 w-4 text-bg-deep" strokeWidth={3} />
        ) : (
          <Trophy className="h-3.5 w-3.5 text-text-muted/60" strokeWidth={2} />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="truncate font-display text-[11px] font-bold uppercase tracking-[0.18em]"
            style={{
              color: unlocked ? m.accent : "rgba(180,170,150,0.7)",
              fontFamily: "var(--font-cinzel)",
            }}
          >
            {m.title}
          </span>
          <span className="font-sans text-[10px] tabular-nums text-text-muted">
            {Math.min(current, m.threshold).toLocaleString()} / {m.threshold.toLocaleString()}
            <span className="ml-1 text-text-muted/70">
              {STAT_LABEL[m.key]}
            </span>
          </span>
        </div>
        {m.body && (
          <p className="text-[10px] leading-snug text-text-muted/85">
            {m.body}
          </p>
        )}
        <div className="h-1 w-full overflow-hidden rounded-full bg-bg-mid/70">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.round(progress * 100)}%`,
              background: unlocked
                ? `linear-gradient(90deg, ${m.accent}, ${m.accent}aa)`
                : `linear-gradient(90deg, ${m.accent}88, ${m.accent}55)`,
              boxShadow: unlocked
                ? `0 0 8px ${m.accent}88`
                : undefined,
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}
