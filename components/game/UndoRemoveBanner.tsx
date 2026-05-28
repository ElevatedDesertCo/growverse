"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Undo2, X } from "lucide-react";
import { useEffect } from "react";
import { BUILDINGS } from "@/lib/buildings";
import { useGameStore } from "@/lib/store";
import { playSfx } from "@/lib/systems/audioSystem";

const UNDO_WINDOW_MS = 6000;

/**
 * Bottom-anchored banner that appears whenever the player removes a
 * building. Offers a one-tap Undo. Auto-dismisses after UNDO_WINDOW_MS
 * by clearing the lastRemoved snapshot from the store, so a missed
 * window doesn't keep the snapshot around forever.
 */
export function UndoRemoveBanner() {
  const lastRemoved = useGameStore((s) => s.lastRemoved);
  const undoRemove = useGameStore((s) => s.undoRemove);
  const clearLastRemoved = useGameStore((s) => s.clearLastRemoved);

  useEffect(() => {
    if (!lastRemoved) return;
    const id = window.setTimeout(() => {
      // Only auto-clear if THIS snapshot is still the active one.
      if (useGameStore.getState().lastRemoved?.at === lastRemoved.at) {
        clearLastRemoved();
      }
    }, UNDO_WINDOW_MS);
    return () => window.clearTimeout(id);
  }, [lastRemoved, clearLastRemoved]);

  const visible = !!lastRemoved;
  const name = lastRemoved
    ? BUILDINGS[lastRemoved.building.type].name
    : "";
  const accent = lastRemoved
    ? BUILDINGS[lastRemoved.building.type].color
    : "#d4a04a";

  return (
    <AnimatePresence>
      {visible && lastRemoved && (
        <motion.div
          key={`undo-${lastRemoved.at}`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          role="status"
          className="pointer-events-auto fixed left-1/2 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-40 -translate-x-1/2"
        >
          <div
            className="flex items-center gap-1 rounded-full p-[1.5px]"
            style={{
              background:
                "linear-gradient(135deg, rgba(212,160,74,0.9) 0%, rgba(212,160,74,0.35) 60%, rgba(212,160,74,0.2) 100%)",
              boxShadow:
                "0 10px 28px -10px rgba(0,0,0,0.75), 0 0 20px -6px rgba(212,160,74,0.45)",
            }}
          >
            <div className="flex items-center gap-1.5 rounded-full bg-bg-deep/95 pl-3 pr-1 backdrop-blur">
              <span className="font-display text-[10px] uppercase tracking-[0.22em] text-text-muted">
                Removed
              </span>
              <span
                className="font-display text-[11px] font-bold uppercase tracking-[0.18em]"
                style={{ color: accent, fontFamily: "var(--font-cinzel)" }}
              >
                {name}
              </span>
              <button
                type="button"
                onClick={() => {
                  playSfx("buttonClick");
                  undoRemove();
                }}
                className="ml-1 inline-flex items-center gap-1 rounded-full border border-gold/45 bg-bg-mid/60 px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-[0.18em] text-gold transition-colors hover:border-gold/75 hover:bg-bg-mid/80"
              >
                <Undo2 className="h-3 w-3" strokeWidth={2.5} />
                Undo
              </button>
              <button
                type="button"
                onClick={() => clearLastRemoved()}
                aria-label="Dismiss"
                className="mr-0.5 rounded-full p-1 text-text-muted/70 transition-colors hover:bg-bg-mid/60 hover:text-text-primary"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
