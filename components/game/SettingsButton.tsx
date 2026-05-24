"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Settings, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useGameStore } from "@/lib/store";

export function SettingsButton() {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const resetSave = useGameStore((s) => s.resetSave);

  const handleClose = () => {
    setOpen(false);
    setConfirming(false);
  };

  const handleReset = () => {
    resetSave();
    setConfirming(false);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Settings"
        className="rounded-full p-1.5 text-text-muted transition-colors hover:bg-bg-mid/60 hover:text-text-primary"
      >
        <Settings className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="settings-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={handleClose}
              className="fixed inset-0 z-50 bg-black/65"
              aria-hidden
            />
            <motion.div
              key="settings-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
              role="dialog"
              aria-label="Settings"
              aria-modal="true"
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-gold/30 bg-bg-deep/95 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-[0_-20px_60px_rgba(0,0,0,0.55)] backdrop-blur"
            >
              <div className="mx-auto max-w-md px-4 pt-3 md:max-w-2xl">
                <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-gold/30" />

                <header className="flex items-center justify-between">
                  <h2
                    className="font-display text-base font-semibold tracking-[0.22em] text-gold"
                    style={{ fontFamily: "var(--font-cinzel)" }}
                  >
                    SETTINGS
                  </h2>
                  <button
                    type="button"
                    onClick={handleClose}
                    aria-label="Close settings"
                    className="rounded-full p-1.5 text-text-muted transition-colors hover:bg-bg-mid/60 hover:text-text-primary"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </header>

                <div className="mt-4 space-y-3 pb-4">
                  <section className="rounded-xl border border-red-500/30 bg-red-500/5 p-3">
                    <h3 className="font-display text-sm font-semibold text-red-400">
                      Reset Save
                    </h3>
                    <p className="mt-1 text-[11px] leading-snug text-text-muted">
                      Wipes all buildings, resources, and progress. Starts
                      a fresh game with 100 Bloom, 50 Amber, 0 Myco.
                      Cannot be undone.
                    </p>
                    {!confirming ? (
                      <button
                        type="button"
                        onClick={() => setConfirming(true)}
                        className="mt-3 inline-flex items-center gap-2 rounded-full border border-red-500/50 px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Reset Save
                      </button>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleReset}
                          className="inline-flex items-center gap-2 rounded-full bg-red-500 px-3 py-1.5 text-xs font-bold text-bg-deep hover:bg-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Yes, wipe everything
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirming(false)}
                          className="inline-flex items-center rounded-full border border-gold/30 px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </section>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
