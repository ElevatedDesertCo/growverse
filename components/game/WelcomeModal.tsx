"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Hammer, Leaf, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useGameStore } from "@/lib/store";
import { playSfx } from "@/lib/systems/audioSystem";

const FIRST_RUN_KEY = "growverse-first-run-seen";

/**
 * One-shot welcome modal shown the very first time a player loads the
 * game (or after a save reset). Sets the tone — desert fantasy guild
 * base-builder — and lists three quick first steps. Stored in
 * localStorage independently of the save so it never re-shows.
 */
export function WelcomeModal() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  // Wait for the persist rehydration so we can also check "has any
  // buildings" — a player who imported a save shouldn't see the
  // welcome modal even if their localStorage on this device is fresh.
  const hasBuildings = useGameStore((s) => s.buildings.length > 0);

  // Hydration flip for createPortal — one-shot setState in effect is intentional.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const persist = useGameStore.persist;
    const check = () => {
      try {
        const seen = window.localStorage.getItem(FIRST_RUN_KEY) === "1";
        if (seen) return;
        if (useGameStore.getState().buildings.length > 0) {
          // Existing player imported a save — mark seen so they don't
          // get the new-player welcome.
          window.localStorage.setItem(FIRST_RUN_KEY, "1");
          return;
        }
        setOpen(true);
      } catch {
        /* storage disabled — show anyway */
        setOpen(true);
      }
    };
    if (persist?.hasHydrated?.()) {
      check();
      return;
    }
    const unsubscribe = persist?.onFinishHydration?.(check);
    return () => {
      unsubscribe?.();
    };
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(FIRST_RUN_KEY, "1");
    } catch {
      /* ignore */
    }
    playSfx("buttonClick");
    setOpen(false);
  };

  // Don't re-pop if the player has already placed buildings since mount.
  useEffect(() => {
    if (hasBuildings && open) {
      try {
        window.localStorage.setItem(FIRST_RUN_KEY, "1");
      } catch {
        /* ignore */
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
    }
  }, [hasBuildings, open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="welcome-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={dismiss}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm"
            aria-hidden
          />
          <motion.div
            key="welcome-modal"
            initial={{ opacity: 0, y: 18, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-modal-title"
            className="fixed left-1/2 top-1/2 z-50 w-[min(26rem,94vw)] -translate-x-1/2 -translate-y-1/2"
          >
            <div
              className="rounded-2xl p-[2px]"
              style={{
                background:
                  "linear-gradient(180deg, #e6c98a 0%, #b8852e 50%, #5a3f1a 100%)",
                boxShadow:
                  "0 24px 60px -20px rgba(0,0,0,0.85), 0 0 70px -10px rgba(212,160,74,0.4)",
              }}
            >
              <div className="relative flex flex-col items-center gap-4 rounded-2xl bg-bg-deep/95 px-6 py-7 backdrop-blur">
                <button
                  type="button"
                  onClick={dismiss}
                  aria-label="Close"
                  className="absolute right-2 top-2 rounded-full p-1.5 text-text-muted transition-colors hover:bg-bg-mid/60 hover:text-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>

                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle at 35% 30%, #f5d97aaa, #d4a04a 50%, #8b6c2e 100%)",
                    boxShadow:
                      "0 0 22px rgba(212,160,74,0.6), inset 0 1px 0 rgba(255,255,255,0.3)",
                  }}
                  aria-hidden
                >
                  <Sparkles
                    className="h-8 w-8 text-bg-deep"
                    strokeWidth={2.25}
                  />
                </div>

                <div className="text-center">
                  <h2
                    id="welcome-modal-title"
                    className="font-display text-lg font-bold uppercase tracking-[0.24em] text-gold"
                    style={{
                      fontFamily: "var(--font-cinzel)",
                      textShadow: "0 1px 0 rgba(0,0,0,0.55)",
                    }}
                  >
                    Welcome, Grower
                  </h2>
                  <p className="mt-1 font-display text-[10px] uppercase tracking-[0.32em] text-leaf">
                    Awaken. Grow. Explore. Thrive.
                  </p>
                </div>

                <p className="max-w-[20rem] text-center text-[12px] leading-snug text-text-muted">
                  The Corruption has scarred the desert. Your guild starts
                  here — a single Soul Altar, a barren patch of sand, and the
                  promise of what could grow.
                </p>

                <div className="grid w-full grid-cols-1 gap-2.5 px-1 text-left">
                  <Step
                    accent="#7fb069"
                    Icon={Leaf}
                    title="Clear the desert"
                    body="Tap cacti and shrubs to harvest Bloom Essence."
                  />
                  <Step
                    accent="#d4a04a"
                    Icon={Hammer}
                    title="Build your base"
                    body="Open the Build menu and place your Guild Core to begin."
                  />
                  <Step
                    accent="#a875d4"
                    Icon={Sparkles}
                    title="Upgrade and unlock"
                    body="Level up the Core to unlock new building tiers."
                  />
                </div>

                <button
                  type="button"
                  onClick={dismiss}
                  className="mt-1 inline-flex items-center justify-center rounded-full bg-gold px-7 py-2.5 font-display text-xs font-bold uppercase tracking-[0.22em] text-bg-deep shadow-[0_4px_18px_-6px_rgba(212,160,74,0.7)] transition-colors hover:bg-gold-dark"
                >
                  Enter Growverse
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

function Step({
  accent,
  Icon,
  title,
  body,
}: {
  accent: string;
  Icon: typeof Leaf;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div
        className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
        style={{
          background: `radial-gradient(circle at 35% 30%, ${accent}cc, ${accent}55 60%, ${accent}22)`,
          boxShadow: `inset 0 0 0 1px ${accent}88, 0 0 8px ${accent}55`,
        }}
        aria-hidden
      >
        <Icon className="h-3 w-3 text-bg-deep" strokeWidth={2.5} />
      </div>
      <div className="flex flex-col">
        <span
          className="font-display text-[11px] font-bold uppercase tracking-[0.18em]"
          style={{ color: accent, fontFamily: "var(--font-cinzel)" }}
        >
          {title}
        </span>
        <span className="text-[11px] leading-snug text-text-muted">{body}</span>
      </div>
    </div>
  );
}
