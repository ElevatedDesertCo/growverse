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
  isMuted as isSfxMuted,
  playSfx,
  setMuted as setSfxMuted,
} from "@/lib/systems/audioSystem";
import {
  isMusicMuted,
  setMusicMuted,
} from "@/lib/systems/musicSystem";
import { exportSave, importSave } from "@/lib/systems/saveSystem";
import {
  getStats,
  subscribeStats,
  type Stats,
} from "@/lib/systems/statsSystem";
import { pushToast } from "@/lib/systems/toastSystem";

export function SettingsButton() {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Local mirror of the persisted audio mute flags so the toggle UI
  // re-renders when the user flips them.
  const [sfxOff, setSfxOff] = useState(false);
  const [musicOff, setMusicOff] = useState(false);
  // Save export / import UI state.
  const [exportText, setExportText] = useState("");
  const [exportCopied, setExportCopied] = useState(false);
  const [importText, setImportText] = useState("");
  const [importErr, setImportErr] = useState<string | null>(null);
  // Lifetime stats (persisted independently of the game save).
  const [stats, setStats] = useState<Stats | null>(null);
  const resetSave = useGameStore((s) => s.resetSave);

  // Sync from persisted state once we're on the client + whenever the
  // panel opens (so reflects any external changes). The setState calls
  // here are intentional one-shot hydration reads from localStorage.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setSfxOff(isSfxMuted());
    setMusicOff(isMusicMuted());
    setStats(getStats());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open]);

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
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                        <StatRow label="Buildings Placed" value={stats.buildingsPlaced} accent="#7fb069" />
                        <StatRow label="Buildings Upgraded" value={stats.buildingsUpgraded} accent="#d4a04a" />
                        <StatRow label="Decor Cleared" value={stats.decorCleared} accent="#c9a878" />
                        <StatRow label="Harvests Collected" value={stats.harvestsCollected} accent="#e8964c" />
                        <StatRow label="Decor Regrown" value={stats.decorRegrown} accent="#9ed16e" />
                        <StatRow label="Daily Rewards" value={stats.dailyRewardsClaimed} accent="#b78ddf" />
                      </dl>
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
                    {!confirming ? (
                      <button
                        type="button"
                        onClick={() => setConfirming(true)}
                        className="mt-3 inline-flex items-center gap-2 rounded-full border border-red-400/50 bg-red-500/10 px-3.5 py-2 font-display text-[11px] font-bold uppercase tracking-[0.16em] text-red-300 transition-colors hover:border-red-400/80 hover:bg-red-500/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Reset Save
                      </button>
                    ) : (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleReset}
                          className="inline-flex items-center gap-2 rounded-full bg-red-500 px-3.5 py-2 font-display text-[11px] font-bold uppercase tracking-[0.16em] text-bg-deep shadow-[0_4px_16px_-4px_rgba(217,87,87,0.7)] transition-colors hover:bg-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Yes, Wipe Everything
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirming(false)}
                          className="inline-flex items-center rounded-full border border-gold/30 px-3.5 py-2 font-display text-[11px] font-bold uppercase tracking-[0.16em] text-text-muted transition-colors hover:border-gold/55 hover:text-text-primary"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
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
    </>
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
