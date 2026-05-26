"use client";

import { useEffect } from "react";
import { useGameStore } from "@/lib/store";
import { playSfx } from "@/lib/systems/audioSystem";

/**
 * Headless. Global keyboard shortcuts for desktop play:
 *   B → open Build menu (or close if already open)
 *   E → toggle Edit mode
 *   Esc → close Build menu / Upgrade modal / Edit mode (in that order)
 *
 * Skips when the user is typing in an input/textarea so the shortcuts
 * don't fight with text fields (Settings save-import textarea, etc.).
 */
export function KeyboardShortcuts() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: KeyboardEvent) => {
      // Don't capture typing inside forms.
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      const s = useGameStore.getState();
      if (e.key === "Escape") {
        if (s.upgradeModalId !== null) {
          s.closeUpgradeModal();
          playSfx("buttonClick");
          e.preventDefault();
          return;
        }
        if (s.buildMenuOpen) {
          s.closeBuildMenu();
          playSfx("buttonClick");
          e.preventDefault();
          return;
        }
        if (s.editMode) {
          s.toggleEditMode();
          playSfx("buttonClick");
          e.preventDefault();
          return;
        }
        return;
      }
      // Single-letter keys — ignore when a modifier is held.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "b") {
        if (s.editMode) return; // build disabled while editing
        if (s.buildMenuOpen) s.closeBuildMenu();
        else s.openBuildMenu();
        playSfx("buttonClick");
        e.preventDefault();
      } else if (k === "e") {
        s.toggleEditMode();
        playSfx("buttonClick");
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return null;
}
