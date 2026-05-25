"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { useComingSoonStore } from "@/lib/systems/comingSoonStore";
import { playSfx } from "@/lib/systems/audioSystem";

/**
 * Centered dark-glass modal with gold trim. Shown when the player taps
 * a bottom-nav tab that isn't shipped yet. Dismiss via tap-outside,
 * the X button, or Got It.
 */
export function ComingSoonModal() {
  const open = useComingSoonStore((s) => s.open);
  const content = useComingSoonStore((s) => s.content);
  const close = useComingSoonStore((s) => s.closeComingSoon);

  const handleClose = () => {
    playSfx("buttonClick");
    close();
  };

  return (
    <AnimatePresence>
      {open && content && (
        <>
          <motion.div
            key="cs-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={handleClose}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            aria-hidden
          />
          <motion.div
            key="cs-modal"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: "tween", duration: 0.24, ease: "easeOut" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="coming-soon-title"
            className="fixed left-1/2 top-1/2 z-50 w-[min(22rem,92vw)] -translate-x-1/2 -translate-y-1/2"
          >
            <div
              className="rounded-2xl p-[2px]"
              style={{
                background:
                  "linear-gradient(180deg, #e6c98a 0%, #b8852e 50%, #5a3f1a 100%)",
                boxShadow:
                  "0 24px 60px -20px rgba(0,0,0,0.8), 0 0 50px -10px rgba(212,160,74,0.35)",
              }}
            >
              <div className="relative flex flex-col items-center gap-3 rounded-2xl bg-bg-deep/95 p-6 backdrop-blur">
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close"
                  className="absolute right-2 top-2 rounded-full p-1.5 text-text-muted transition-colors hover:bg-bg-mid/60 hover:text-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>

                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle at 35% 30%, #f5d97aaa, #d4a04a 50%, #8b6c2e 100%)",
                    boxShadow:
                      "0 0 18px rgba(212,160,74,0.55), inset 0 1px 0 rgba(255,255,255,0.3)",
                  }}
                  aria-hidden
                >
                  <Sparkles
                    className="h-7 w-7 text-bg-deep"
                    strokeWidth={2.25}
                  />
                </div>

                {content.phase && (
                  <span
                    className="rounded-full bg-gold/15 px-2.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-[0.28em] text-gold ring-1 ring-gold/30"
                  >
                    {content.phase}
                  </span>
                )}

                <h2
                  id="coming-soon-title"
                  className="font-display text-base font-bold uppercase tracking-[0.22em] text-gold"
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    textShadow: "0 1px 0 rgba(0,0,0,0.55)",
                  }}
                >
                  {content.title}
                </h2>

                <p className="max-w-[16rem] text-center text-[12px] leading-snug text-text-muted">
                  {content.body}
                </p>

                <button
                  type="button"
                  onClick={handleClose}
                  className="mt-2 inline-flex items-center justify-center rounded-full bg-gold px-6 py-2 font-display text-xs font-bold uppercase tracking-[0.22em] text-bg-deep shadow-[0_4px_18px_-6px_rgba(212,160,74,0.7)] transition-colors hover:bg-gold-dark active:bg-gold-dark"
                >
                  Got It
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
