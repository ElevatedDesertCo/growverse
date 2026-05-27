"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Copy,
  Download,
  Music,
  Music2,
  Settings,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useGameStore } from "@/lib/store";
import {
  getVolume as getSfxVolume,
  isMuted as isSfxMuted,
  playSfx,
  setMuted as setSfxMuted,
  setVolume as setSfxVolume,
} from "@/lib/systems/audioSystem";
import {
  getMusicVolume,
  isMusicMuted,
  setMusicMuted,
  setMusicVolume,
} from "@/lib/systems/musicSystem";
import { exportSave, importSave } from "@/lib/systems/saveSystem";
import {
  getNextMilestone,
  getStats,
  subscribeStats,
  type Stats,
} from "@/lib/systems/statsSystem";
import { pushToast } from "@/lib/systems/toastSystem";
import { AchievementsModal } from "./AchievementsModal";
import { HelpModal } from "./HelpModal";
import { HelpCircle, Trophy } from "lucide-react";

export function SettingsButton() {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Local mirror of the persisted audio mute flags so the toggle UI
  // re-renders when the user flips them.
  const [sfxOff, setSfxOff] = useState(false);
  const [musicOff, setMusicOff] = useState(false);
  // Volume sliders. 0–100 for the input; converted to 0–1 internally.
  const [sfxVolume, setSfxVolumeState] = useState(60);
  const [musicVolumePct, setMusicVolumePct] = useState(35);
  // Save export / import UI state.
  const [exportText, setExportText] = useState("");
  const [exportCopied, setExportCopied] = useState(false);
  const [importText, setImportText] = useState("");
  const [importErr, setImportErr] = useState<string | null>(null);
  // Lifetime stats (persisted independently of the game save).
  const [stats, setStats] = useState<Stats | null>(null);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const resetSave = useGameStore((s) => s.resetSave);

  // Sync from persisted state once we're on the client + whenever the
  // panel opens (so reflects any external changes). The setState calls
  // here are intentional one-shot hydration reads from localStorage.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setSfxOff(isSfxMuted());
    setMusicOff(isMusicMuted());
    setStats(getStats());
    setSfxVolumeState(Math.round(getSfxVolume() * 100));
    setMusicVolumePct(Math.round(getMusicVolume() * 100));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open]);

  // Global "open help" event listener — fired by KeyboardShortcuts on "?".
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOpen = () => setHelpOpen(true);
    window.addEventListener("growverse:open-help", onOpen);
    return () => window.removeEventListener("growverse:open-help", onOpen);
  }, []);

  // Live-update stats while the panel is open (e.g. user dismisses,
  // earns more, reopens — they should see the new numbers).
  useEffect(() => {
    if (!open) return;
    return subscribeStats((next) => setStats(next));
  }, [open]);

  // Portal-host detection. The ResourceBar wraps this component AND uses
  // `backdrop-blur`, which creates a containing block — a fixed-positioned
  // modal mounted inside the header would be positioned relative to the
  // header, not the viewport. Portaling to document.body fixes that. The
  // setState in this effect is a one-shot hydration flip and intentional;
  // safe to call directly.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const handleClose = () => {
    setOpen(false);
    setConfirming(false);
  };

  const handleReset = () => {
    playSfx("upgradeComplete");
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
        className="flex h-8 w-8 items-center justify-center rounded-full border border-gold/30 bg-bg-deep/70 text-gold/80 transition-colors hover:border-gold/55 hover:bg-bg-mid/80 hover:text-gold"
      >
        <Settings className="h-4 w-4" />
      </button>

      {mounted && createPortal(
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
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
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
              className="fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-3xl pb-[max(env(safe-area-inset-bottom),1rem)] backdrop-blur"
              style={{
                background:
                  "linear-gradient(180deg, rgba(212,160,74,0.85) 0%, rgba(212,160,74,0.85) 1px, rgba(15,10,6,0.97) 1px, rgba(15,10,6,0.97) 100%)",
                boxShadow:
                  "0 -20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.18), 0 0 80px -20px rgba(212,160,74,0.35)",
              }}
            >
              <div className="mx-auto max-w-md px-4 pt-3 md:max-w-2xl">
                <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-gold/30" />

                <header className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-full"
                      style={{
                        background:
                          "radial-gradient(circle at 35% 30%, #f5d97aaa, #d4a04a 50%, #8b6c2e 100%)",
                        boxShadow:
                          "0 0 12px rgba(212,160,74,0.55), inset 0 1px 0 rgba(255,255,255,0.3)",
                      }}
                      aria-hidden
                    >
                      <Settings className="h-4 w-4 text-bg-deep" strokeWidth={2.5} />
                    </div>
                    <h2
                      className="font-display text-base font-bold uppercase tracking-[0.24em] text-gold"
                      style={{
                        fontFamily: "var(--font-cinzel)",
                        textShadow: "0 1px 0 rgba(0,0,0,0.55)",
                      }}
                    >
                      Settings
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={handleClose}
                    aria-label="Close settings"
                    className="rounded-full p-1.5 text-text-muted transition-colors hover:bg-bg-mid/60 hover:text-text-primary"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </header>

                <div className="mt-3 space-y-3 pb-4">
                  {/* How to play */}
                  <button
                    type="button"
                    onClick={() => {
                      playSfx("buttonClick");
                      setHelpOpen(true);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-gold/40 bg-bg-deep/70 px-3 py-2.5 font-display text-[11px] font-bold uppercase tracking-[0.18em] text-gold transition-colors hover:border-gold/60 hover:bg-bg-mid/80"
                  >
                    <HelpCircle className="h-4 w-4" />
                    How to play
                  </button>

                  {/* Audio toggles — Sound + Music */}
                  <section
                    className="relative overflow-hidden rounded-xl border border-gold/25 bg-bg-mid/40 p-4"
                  >
                    <h3
                      className="font-display text-sm font-bold uppercase tracking-[0.18em] text-gold"
                      style={{ fontFamily: "var(--font-cinzel)" }}
                    >
                      Audio
                    </h3>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const next = !sfxOff;
                          setSfxMuted(next);
                          setSfxOff(next);
                          // Confirm with a click whenever turning ON.
                          if (!next) playSfx("buttonClick");
                        }}
                        aria-pressed={!sfxOff}
                        className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors ${
                          sfxOff
                            ? "border-text-muted/30 bg-bg-deep/40 text-text-muted"
                            : "border-gold/40 bg-bg-deep/70 text-gold hover:border-gold/60"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          {sfxOff ? (
                            <VolumeX className="h-4 w-4" />
                          ) : (
                            <Volume2 className="h-4 w-4" />
                          )}
                          <span className="font-display text-[11px] font-bold uppercase tracking-[0.16em]">
                            Sound
                          </span>
                        </span>
                        <span className="font-display text-[9px] font-bold uppercase tracking-[0.2em] text-text-muted">
                          {sfxOff ? "Off" : "On"}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !musicOff;
                          setMusicMuted(next);
                          setMusicOff(next);
                          playSfx("buttonClick");
                        }}
                        aria-pressed={!musicOff}
                        className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors ${
                          musicOff
                            ? "border-text-muted/30 bg-bg-deep/40 text-text-muted"
                            : "border-gold/40 bg-bg-deep/70 text-gold hover:border-gold/60"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          {musicOff ? (
                            <Music2 className="h-4 w-4" />
                          ) : (
                            <Music className="h-4 w-4" />
                          )}
                          <span className="font-display text-[11px] font-bold uppercase tracking-[0.16em]">
                            Music
                          </span>
                        </span>
                        <span className="font-display text-[9px] font-bold uppercase tracking-[0.2em] text-text-muted">
                          {musicOff ? "Off" : "On"}
                        </span>
                      </button>
                    </div>

                    {/* Volume sliders — independent of mute. Disabled
                        when the corresponding kind is off. */}
                    <div className="mt-3 space-y-2.5">
                      <VolumeRow
                        label="Sound"
                        value={sfxVolume}
                        disabled={sfxOff}
                        onChange={(v) => {
                          setSfxVolumeState(v);
                          setSfxVolume(v / 100);
                        }}
                        onChangeCommit={() => playSfx("buttonClick")}
                      />
                      <VolumeRow
                        label="Music"
                        value={musicVolumePct}
                        disabled={musicOff}
                        onChange={(v) => {
                          setMusicVolumePct(v);
                          setMusicVolume(v / 100);
                        }}
                      />
                    </div>

                    {/* SFX test row — tap any chip to play that hook. */}
                    <div className="mt-3 border-t border-gold/15 pt-3">
                      <p className="mb-1.5 font-display text-[9px] font-bold uppercase tracking-[0.18em] text-text-muted">
                        Test SFX
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {(["buttonClick", "resourceCollect", "buildPlaced", "upgradeComplete", "locked", "decorLeaf", "decorStone", "decorMetal"] as const).map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => playSfx(name)}
                            disabled={sfxOff}
                            className="rounded-full border border-gold/30 bg-bg-deep/70 px-2 py-1 font-display text-[9px] font-bold uppercase tracking-[0.14em] text-text-muted transition-colors hover:border-gold/55 hover:text-gold disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {name.replace(/([A-Z])/g, " $1").trim()}
                          </button>
                        ))}
                      </div>
                    </div>
                  </section>

                  {/* Lifetime stats */}
                  {stats && (
                    <section className="relative overflow-hidden rounded-xl border border-gold/25 bg-bg-mid/40 p-4">
                      <h3
                        className="font-display text-sm font-bold uppercase tracking-[0.18em] text-gold"
                        style={{ fontFamily: "var(--font-cinzel)" }}
                      >
                        Stats
                      </h3>
                      <p className="mt-1 text-[11px] leading-snug text-text-muted">
                        Lifetime totals. Persisted across save resets.
                      </p>
                      <NextMilestoneChip />

                      <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                        <StatRow label="Buildings Placed" value={stats.buildingsPlaced} accent="#7fb069" />
                        <StatRow label="Buildings Upgraded" value={stats.buildingsUpgraded} accent="#d4a04a" />
                        <StatRow label="Decor Cleared" value={stats.decorCleared} accent="#c9a878" />
                        <StatRow label="Harvests Collected" value={stats.harvestsCollected} accent="#e8964c" />
                        <StatRow label="Decor Regrown" value={stats.decorRegrown} accent="#9ed16e" />
                        <StatRow label="Daily Rewards" value={stats.dailyRewardsClaimed} accent="#b78ddf" />
                      </dl>
                      <button
                        type="button"
                        onClick={() => {
                          playSfx("buttonClick");
                          setAchievementsOpen(true);
                        }}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-gold/40 bg-bg-deep/70 px-3 py-2 font-display text-[11px] font-bold uppercase tracking-[0.18em] text-gold transition-colors hover:border-gold/60"
                      >
                        <Trophy className="h-3.5 w-3.5" />
                        View Achievements
                      </button>
                    </section>
                  )}

                  {/* Save: export + import */}
                  <section className="relative overflow-hidden rounded-xl border border-gold/25 bg-bg-mid/40 p-4">
                    <h3
                      className="font-display text-sm font-bold uppercase tracking-[0.18em] text-gold"
                      style={{ fontFamily: "var(--font-cinzel)" }}
                    >
                      Save Data
                    </h3>
                    <p className="mt-1 text-[11px] leading-snug text-text-muted">
                      Back up your progress to text and paste it on another
                      device or in a different browser.
                    </p>
                    <div className="mt-3 space-y-2">
                      {!exportText ? (
                        <button
                          type="button"
                          onClick={() => {
                            const text = exportSave();
                            setExportText(text);
                            setExportCopied(false);
                            // Best-effort clipboard copy.
                            if (
                              typeof navigator !== "undefined" &&
                              navigator.clipboard?.writeText
                            ) {
                              navigator.clipboard
                                .writeText(text)
                                .then(() => setExportCopied(true))
                                .catch(() => {
                                  /* user can still copy from the textarea */
                                });
                            }
                            playSfx("buttonClick");
                          }}
                          className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-bg-deep/70 px-3.5 py-2 font-display text-[11px] font-bold uppercase tracking-[0.16em] text-gold transition-colors hover:border-gold/60"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Export Save
                        </button>
                      ) : (
                        <div className="space-y-1.5">
                          <ExportSummary text={exportText} />
                          <textarea
                            readOnly
                            value={exportText}
                            onFocus={(e) => e.currentTarget.select()}
                            className="h-20 w-full resize-y rounded-lg border border-gold/20 bg-bg-deep/80 p-2 font-mono text-[10px] text-text-muted"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  typeof navigator !== "undefined" &&
                                  navigator.clipboard?.writeText
                                ) {
                                  navigator.clipboard
                                    .writeText(exportText)
                                    .then(() => setExportCopied(true))
                                    .catch(() => {});
                                }
                                playSfx("buttonClick");
                              }}
                              className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-bg-deep/70 px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-[0.16em] text-gold transition-colors hover:border-gold/60"
                            >
                              {exportCopied ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                              {exportCopied ? "Copied" : "Copy"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setExportText("");
                                setExportCopied(false);
                              }}
                              className="font-display text-[10px] font-medium uppercase tracking-[0.16em] text-text-muted transition-colors hover:text-text-primary"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <textarea
                          value={importText}
                          onChange={(e) => {
                            setImportText(e.target.value);
                            if (importErr) setImportErr(null);
                          }}
                          placeholder="Paste a Growverse save export here…"
                          className="h-16 w-full resize-y rounded-lg border border-gold/20 bg-bg-deep/80 p-2 font-mono text-[10px] text-text-primary placeholder:text-text-muted/60 focus:border-gold/45 focus:outline-none"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={!importText.trim()}
                            onClick={() => {
                              setImportErr(null);
                              importSave(importText.trim())
                                .then(() => {
                                  playSfx("upgradeComplete");
                                  pushToast({
                                    kind: "success",
                                    title: "Save Imported",
                                    body: "Your progress has been restored.",
                                  });
                                  setImportText("");
                                  handleClose();
                                })
                                .catch((err: unknown) => {
                                  const msg =
                                    err instanceof Error
                                      ? err.message
                                      : String(err);
                                  setImportErr(msg);
                                  playSfx("locked");
                                });
                            }}
                            className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-[0.16em] text-bg-deep transition-colors hover:bg-gold-dark disabled:cursor-not-allowed disabled:bg-gold-muted disabled:text-bg-deep/60"
                          >
                            <Upload className="h-3 w-3" />
                            Import Save
                          </button>
                          {importErr && (
                            <span className="text-[10px] text-red-300">
                              {importErr}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section
                    className="relative overflow-hidden rounded-xl border border-red-500/35 bg-gradient-to-br from-red-950/30 to-bg-deep/60 p-4"
                  >
                    <div
                      className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-25"
                      style={{
                        background:
                          "radial-gradient(circle, #d97757 0%, transparent 70%)",
                      }}
                      aria-hidden
                    />
                    <h3
                      className="font-display text-sm font-bold uppercase tracking-[0.18em] text-red-300"
                      style={{ fontFamily: "var(--font-cinzel)" }}
                    >
                      Reset Save
                    </h3>
                    <p className="mt-1.5 text-[12px] leading-snug text-text-muted">
                      Wipes all buildings, resources, and progress. Starts
                      a fresh game. <span className="text-red-300/85">Cannot be undone.</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        playSfx("buttonClick");
                        setConfirming(true);
                      }}
                      className="mt-3 inline-flex items-center gap-2 rounded-full border border-red-400/50 bg-red-500/10 px-3.5 py-2 font-display text-[11px] font-bold uppercase tracking-[0.16em] text-red-300 transition-colors hover:border-red-400/80 hover:bg-red-500/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Reset Save
                    </button>
                  </section>

                  {/* Credits + attribution */}
                  <section className="rounded-xl border border-gold/15 bg-bg-mid/30 p-4">
                    <h3
                      className="font-display text-sm font-bold uppercase tracking-[0.18em] text-gold"
                      style={{ fontFamily: "var(--font-cinzel)" }}
                    >
                      Credits
                    </h3>
                    <ul className="mt-2 space-y-1.5 text-[11px] leading-snug text-text-muted">
                      <li>
                        <span className="font-display text-[9px] font-bold uppercase tracking-[0.18em] text-gold">
                          Music
                        </span>{" "}
                        <a
                          href="https://opengameart.org/content/desert-theme"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-text-primary underline-offset-2 hover:text-gold hover:underline"
                        >
                          Desert Theme
                        </a>{" "}
                        by yd · CC0 · OpenGameArt
                      </li>
                      <li>
                        <span className="font-display text-[9px] font-bold uppercase tracking-[0.18em] text-gold">
                          SFX
                        </span>{" "}
                        <a
                          href="https://kenney.nl/assets/ui-audio"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-text-primary underline-offset-2 hover:text-gold hover:underline"
                        >
                          UI Audio
                        </a>{" "}
                        by Kenney · CC0
                      </li>
                      <li>
                        <span className="font-display text-[9px] font-bold uppercase tracking-[0.18em] text-gold">
                          Engine
                        </span>{" "}
                        Next.js · Tailwind · Framer Motion · Zustand · Lucide
                      </li>
                    </ul>
                  </section>

                  <p className="px-1 text-center font-display text-[9px] uppercase tracking-[0.32em] text-text-muted/60">
                    Growverse · Phase 2 · Guild Wars
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>,
      document.body)}
      <AchievementsModal
        open={achievementsOpen}
        onClose={() => setAchievementsOpen(false)}
      />
      <HelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />
      {/* Reset Save confirmation — proper centered modal matching the
          rest of the modal family. */}
      {mounted && createPortal(
        <AnimatePresence>
          {confirming && (
            <>
              <motion.div
                key="reset-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={() => setConfirming(false)}
                className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm"
                aria-hidden
              />
              <motion.div
                key="reset-modal"
                initial={{ opacity: 0, y: 12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="reset-modal-title"
                className="fixed left-1/2 top-1/2 z-[60] w-[min(22rem,92vw)] -translate-x-1/2 -translate-y-1/2"
              >
                <div
                  className="rounded-2xl p-[2px]"
                  style={{
                    background:
                      "linear-gradient(180deg, #f4a07a 0%, #c0573a 50%, #5a1f10 100%)",
                    boxShadow:
                      "0 24px 60px -20px rgba(0,0,0,0.85), 0 0 60px -10px rgba(217,87,87,0.4)",
                  }}
                >
                  <div className="relative flex flex-col items-center gap-3 rounded-2xl bg-bg-deep/95 p-6 backdrop-blur">
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      aria-label="Cancel"
                      className="absolute right-2 top-2 rounded-full p-1.5 text-text-muted transition-colors hover:bg-bg-mid/60 hover:text-text-primary"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-full"
                      style={{
                        background:
                          "radial-gradient(circle at 35% 30%, #f4a07acc, #d97757 50%, #7a2818 100%)",
                        boxShadow:
                          "0 0 22px rgba(217,87,87,0.55), inset 0 1px 0 rgba(255,255,255,0.3)",
                      }}
                      aria-hidden
                    >
                      <Trash2
                        className="h-7 w-7 text-bg-deep"
                        strokeWidth={2.25}
                      />
                    </div>
                    <h2
                      id="reset-modal-title"
                      className="font-display text-base font-bold uppercase tracking-[0.22em] text-red-200"
                      style={{
                        fontFamily: "var(--font-cinzel)",
                        textShadow: "0 1px 0 rgba(0,0,0,0.55)",
                      }}
                    >
                      Wipe Your Realm?
                    </h2>
                    <p className="max-w-[18rem] text-center text-[12px] leading-snug text-text-muted">
                      This deletes every building, resource, and decor item.
                      You&apos;ll start fresh with your initial bag.{" "}
                      <span className="text-red-300/90">Cannot be undone.</span>
                    </p>
                    <div className="mt-1 flex w-full items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          playSfx("buttonClick");
                          setConfirming(false);
                        }}
                        className="flex-1 rounded-full border border-gold/35 px-4 py-2.5 font-display text-[11px] font-bold uppercase tracking-[0.2em] text-text-muted transition-colors hover:border-gold/55 hover:text-text-primary"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleReset}
                        className="flex-1 rounded-full bg-red-500 px-4 py-2.5 font-display text-[11px] font-bold uppercase tracking-[0.2em] text-bg-deep shadow-[0_4px_18px_-6px_rgba(217,87,87,0.7)] transition-colors hover:bg-red-400"
                      >
                        Wipe It
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

/** Small preview card showing what's inside the exported save. */
function ExportSummary({ text }: { text: string }) {
  let buildings = 0;
  let bloom = 0;
  let amber = 0;
  let myco = 0;
  let exportedAt = "";
  try {
    const env = JSON.parse(text) as {
      exportedAt?: number;
      state?: { state?: { buildings?: unknown[]; resources?: Record<string, number> } };
    };
    const inner = env?.state?.state;
    if (inner) {
      buildings = Array.isArray(inner.buildings) ? inner.buildings.length : 0;
      bloom = inner.resources?.bloomEssence ?? 0;
      amber = inner.resources?.amberShards ?? 0;
      myco = inner.resources?.mycoDust ?? 0;
    }
    if (typeof env.exportedAt === "number") {
      exportedAt = new Date(env.exportedAt).toLocaleString();
    }
  } catch {
    /* malformed — render the card without numbers */
  }
  return (
    <div className="rounded-lg border border-gold/25 bg-bg-deep/60 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-[9px] font-bold uppercase tracking-[0.18em] text-gold">
          Snapshot
        </span>
        {exportedAt && (
          <span className="font-sans text-[9px] text-text-muted/80">
            {exportedAt}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-[10px]">
        <span className="text-text-muted">
          <span className="font-bold tabular-nums text-text-primary">{buildings}</span>{" "}
          buildings
        </span>
        <span className="text-leaf">
          <span className="font-bold tabular-nums">{bloom.toLocaleString()}</span>{" "}
          <span className="text-text-muted">Bloom</span>
        </span>
        <span className="text-fire">
          <span className="font-bold tabular-nums">{amber.toLocaleString()}</span>{" "}
          <span className="text-text-muted">Amber</span>
        </span>
        <span className="text-mushroom">
          <span className="font-bold tabular-nums">{myco.toLocaleString()}</span>{" "}
          <span className="text-text-muted">Myco</span>
        </span>
      </div>
    </div>
  );
}

/** "Next goal: Architect — 3 more buildings" chip with progress bar. */
function NextMilestoneChip() {
  const [next, setNext] = useState(() => getNextMilestone());
  useEffect(() => {
    return subscribeStats(() => setNext(getNextMilestone()));
  }, []);
  if (!next) {
    return (
      <p className="mt-2 rounded-md bg-bg-deep/60 px-2.5 py-1.5 font-display text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
        ✓ All milestones unlocked
      </p>
    );
  }
  const { milestone, current, remaining } = next;
  const pct = Math.round((current / milestone.threshold) * 100);
  return (
    <div className="mt-2 rounded-md border border-gold/15 bg-bg-deep/60 px-2.5 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display text-[9px] font-bold uppercase tracking-[0.18em] text-text-muted">
          Next goal
        </span>
        <span
          className="font-display text-[10px] font-bold uppercase tracking-[0.18em]"
          style={{ color: milestone.accent }}
        >
          {milestone.title}
        </span>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2 text-[10px] text-text-muted">
        <span>
          {remaining} more to unlock
        </span>
        <span className="font-sans tabular-nums">
          {current} / {milestone.threshold}
        </span>
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-bg-mid/70">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${milestone.accent}, ${milestone.accent}aa)`,
            boxShadow: `0 0 6px ${milestone.accent}66`,
          }}
        />
      </div>
    </div>
  );
}

function VolumeRow({
  label,
  value,
  disabled,
  onChange,
  onChangeCommit,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (v: number) => void;
  onChangeCommit?: () => void;
}) {
  return (
    <label
      className={`flex items-center gap-2.5 ${
        disabled ? "opacity-40" : ""
      }`}
    >
      <span className="w-12 flex-shrink-0 font-display text-[9px] font-bold uppercase tracking-[0.18em] text-text-muted">
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        onMouseUp={onChangeCommit}
        onTouchEnd={onChangeCommit}
        className="flex-1 accent-gold"
        aria-label={`${label} volume`}
      />
      <span className="w-9 text-right font-sans text-[10px] tabular-nums text-text-muted">
        {value}%
      </span>
    </label>
  );
}

function StatRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-gold/15 bg-bg-deep/60 px-2.5 py-1.5">
      <dt className="truncate font-display text-[9px] font-medium uppercase tracking-[0.18em] text-text-muted">
        {label}
      </dt>
      <dd
        className="font-display text-sm font-bold tabular-nums"
        style={{ color: accent, textShadow: "0 1px 0 rgba(0,0,0,0.55)" }}
      >
        {value.toLocaleString()}
      </dd>
    </div>
  );
}
