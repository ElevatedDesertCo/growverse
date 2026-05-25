"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Move, Pencil } from "lucide-react";
import { useGameStore } from "@/lib/store";

/**
 * Floating helper banner that appears under the HUD whenever the player
 * is in edit mode. Explains the gesture options so the mode isn't
 * silent. Dismisses with edit mode itself; nothing to click.
 */
export function EditModeHint() {
  const editMode = useGameStore((s) => s.editMode);
  const hasBuildings = useGameStore((s) => s.buildings.length > 0);

  // Edit mode without buildings has nothing to do — skip the banner.
  const show = editMode && hasBuildings;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="edit-hint"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top)+8rem)] z-30 -translate-x-1/2 sm:top-[calc(env(safe-area-inset-top)+7rem)]"
          role="status"
        >
          <div
            className="flex items-center gap-2 rounded-full p-[1.5px]"
            style={{
              background:
                "linear-gradient(135deg, rgba(212,160,74,0.95) 0%, rgba(212,160,74,0.4) 50%, rgba(212,160,74,0.2) 100%)",
              boxShadow:
                "0 8px 24px -8px rgba(0,0,0,0.7), 0 0 24px -8px rgba(212,160,74,0.55)",
            }}
          >
            <div className="flex items-center gap-2.5 rounded-full bg-bg-deep/95 px-3.5 py-1.5 backdrop-blur">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full"
                style={{
                  background:
                    "radial-gradient(circle at 35% 30%, #f5d97aaa, #d4a04a 50%, #8b6c2e 100%)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)",
                }}
                aria-hidden
              >
                <Pencil
                  className="h-3 w-3 text-bg-deep"
                  strokeWidth={2.5}
                />
              </span>
              <div className="flex flex-col items-start leading-none">
                <span
                  className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-gold"
                  style={{ fontFamily: "var(--font-cinzel)" }}
                >
                  Edit Mode
                </span>
                <span className="mt-0.5 flex items-center gap-1 font-sans text-[10px] text-text-muted">
                  <Move className="h-2.5 w-2.5" strokeWidth={2} />
                  Tap a building, then tap a new cell to move
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
