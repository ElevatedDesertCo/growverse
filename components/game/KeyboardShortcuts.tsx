"use client";

import { useEffect } from "react";
import { useGameStore } from "@/lib/store";
import {
  isMuted as isSfxMuted,
  playSfx,
  setMuted as setSfxMuted,
} from "@/lib/systems/audioSystem";
import { isMusicMuted, setMusicMuted } from "@/lib/systems/musicSystem";
import { pushToast } from "@/lib/systems/toastSystem";

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
      // "?" → fire global open-help event (SettingsButton listens).
      if (e.key === "?") {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("growverse:open-help"));
        }
        playSfx("buttonClick");
        e.preventDefault();
        return;
      }
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
      } else if (k === "m") {
        // Mute toggle — flips BOTH SFX and music together so the player
        // gets a single quiet-the-game shortcut. State derived from SFX
        // mute: if currently audible, mute both; otherwise unmute both.
        const wasMuted = isSfxMuted() && isMusicMuted();
        const nextMuted = !wasMuted;
        setSfxMuted(nextMuted);
        setMusicMuted(nextMuted);
        // Play feedback chime BEFORE muting, or skip when muting.
        if (!nextMuted) playSfx("buttonClick");
        pushToast({
          kind: "info",
          title: nextMuted ? "Muted" : "Unmuted",
          body: nextMuted ? "All audio off." : "Audio restored.",
          accent: nextMuted ? "#7a7a7a" : "#d4a04a",
          ttlMs: 1600,
        });
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return null;
}
