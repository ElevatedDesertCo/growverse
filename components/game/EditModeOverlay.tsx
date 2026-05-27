"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "@/lib/store";

/**
 * Edge glow that frames the viewport whenever edit mode is active.
 * Layered above the playfield, below the HUD/banners — non-interactive.
 * Pairs with the existing EditModeHint banner so the mode is
 * unmistakable from anywhere on screen, not just the top center.
 */
export function EditModeOverlay() {
  const editMode = useGameStore((s) => s.editMode);
  return (
    <AnimatePresence>
      {editMode && (
        <motion.div
          key="edit-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="pointer-events-none fixed inset-0 z-20"
          aria-hidden
        >
          <div
            className="absolute inset-0"
            style={{
              boxShadow:
                "inset 0 0 80px rgba(212,160,74,0.18), inset 0 0 0 2px rgba(212,160,74,0.35)",
            }}
          />
          <motion.div
            className="absolute inset-0"
            animate={{
              opacity: [0.35, 0.7, 0.35],
            }}
            transition={{
              duration: 2.6,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{
              boxShadow:
                "inset 0 0 36px rgba(232,150,76,0.4)",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
