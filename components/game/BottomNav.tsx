"use client";

import { motion } from "framer-motion";
import {
  Home,
  Swords,
  Zap,
  Sparkle,
  PawPrint,
  Pencil,
  Hammer,
  Check,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/store";
import { playSfx } from "@/lib/systems/audioSystem";
import { showComingSoon } from "@/lib/systems/comingSoonStore";
import { ActionIcon } from "./ActionIcon";

const EDITED_KEY = "growverse-has-edited";

type TabKey = "base" | "train" | "raid" | "heroes" | "pets";

type Tab = {
  key: TabKey;
  label: string;
  Icon: typeof Home;
};

const TABS: Tab[] = [
  { key: "base", label: "Base", Icon: Home },
  { key: "train", label: "Train", Icon: Swords },
  { key: "raid", label: "Raid", Icon: Zap },
  { key: "heroes", label: "Heroes", Icon: Sparkle },
  { key: "pets", label: "Pets", Icon: PawPrint },
];

const ACTIVE: TabKey = "base";

/** Per-tab copy shown by the Coming Soon modal. */
const COMING_SOON_COPY: Record<Exclude<TabKey, "base">, { title: string; body: string; phase: string }> = {
  train: {
    title: "Training Grounds",
    phase: "Phase 3",
    body: "Train and deploy combat units to defend your guild and raid enemy bases. Coming with the combat system.",
  },
  raid: {
    title: "Raid Map",
    phase: "Phase 3",
    body: "Cross zone borders and raid rival guilds for resources, relics, and reputation. Coming with the raid system.",
  },
  heroes: {
    title: "Heroes",
    phase: "Phase 4",
    body: "Recruit and level legendary growers — Anderz, Solace, Raiin and more — each with signature abilities.",
  },
  pets: {
    title: "Spirit Pets",
    phase: "Phase 4",
    body: "Bond with spirit creatures from the Spirit Nursery. Evolve them into combat allies and resource collectors.",
  },
};

export function BottomNav() {
  const editMode = useGameStore((s) => s.editMode);
  const toggleEditMode = useGameStore((s) => s.toggleEditMode);
  const openBuildMenu = useGameStore((s) => s.openBuildMenu);
  const hasBuildings = useGameStore((s) => s.buildings.length > 0);

  // First-run hook: pulse the Build button if the player has 0 buildings.
  // Guild Core is free, so they can always afford SOMETHING when empty.
  const shouldPulseBuild = !hasBuildings && !editMode;

  // Second-run hook: pulse the Edit button after the player has placed
  // at least one building but has never used edit mode. Persisted via
  // localStorage so the pulse doesn't keep showing on subsequent loads.
  const [hasEverEdited, setHasEverEdited] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      // Intentional one-shot hydration read from localStorage.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasEverEdited(localStorage.getItem(EDITED_KEY) === "1");
    } catch {
      /* storage disabled */
    }
  }, []);
  const shouldPulseEdit =
    hasBuildings && !editMode && !hasEverEdited;

  const handleTap = (key: TabKey) => {
    if (key === ACTIVE) return;
    playSfx("buttonClick");
    const copy = COMING_SOON_COPY[key as Exclude<TabKey, "base">];
    if (copy) showComingSoon(copy);
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gold/15 bg-bg-deep/95 backdrop-blur supports-[backdrop-filter]:bg-bg-deep/80">
      <div className="mx-auto flex items-stretch gap-2 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 md:gap-4 md:px-6">
        {/* Nav tabs */}
        <ul className="flex flex-1 items-stretch justify-between">
          {TABS.map(({ key, label, Icon }) => {
            const active = key === ACTIVE;
            return (
              <li key={key} className="flex-1">
                <button
                  type="button"
                  onClick={() => handleTap(key)}
                  className={`group relative flex w-full flex-col items-center gap-1 rounded-lg px-1 py-1.5 transition-colors ${
                    active
                      ? "text-gold"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {/* Active-tab gold glow disc behind the icon. */}
                  {active && (
                    <span
                      className="pointer-events-none absolute left-1/2 top-1 h-7 w-7 -translate-x-1/2 rounded-full opacity-90"
                      style={{
                        background:
                          "radial-gradient(circle at 50% 40%, rgba(245,217,122,0.55) 0%, rgba(212,160,74,0.25) 40%, rgba(212,160,74,0) 75%)",
                      }}
                      aria-hidden
                    />
                  )}
                  <Icon
                    className="relative h-5 w-5"
                    strokeWidth={active ? 2.5 : 1.75}
                    style={
                      active
                        ? {
                            filter:
                              "drop-shadow(0 0 6px rgba(212,160,74,0.7))",
                          }
                        : undefined
                    }
                  />
                  <span
                    className={`relative font-sans text-[10px] uppercase tracking-[0.18em] ${
                      active ? "font-bold" : "font-medium"
                    }`}
                  >
                    {label}
                  </span>
                  {/* Bottom indicator bar for active tab. */}
                  {active && (
                    <span
                      className="pointer-events-none absolute -bottom-2 left-1/2 h-[2.5px] w-8 -translate-x-1/2 rounded-full bg-gold"
                      style={{
                        boxShadow: "0 0 6px rgba(212,160,74,0.8)",
                      }}
                      aria-hidden
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Divider */}
        <div
          className="my-1 w-px self-stretch bg-gold/15"
          aria-hidden
        />

        {/* Action cluster: Edit + Build */}
        <div className="flex items-center gap-2">
          <motion.button
            type="button"
            onClick={() => {
              playSfx("buttonClick");
              toggleEditMode();
              if (!hasEverEdited) {
                setHasEverEdited(true);
                try {
                  localStorage.setItem(EDITED_KEY, "1");
                } catch {
                  /* storage disabled */
                }
              }
            }}
            aria-label={editMode ? "Done editing" : "Edit base"}
            animate={
              shouldPulseEdit
                ? {
                    scale: [1, 1.06, 1],
                    boxShadow: [
                      "0 0 0 0 rgba(212,160,74,0)",
                      "0 0 16px 2px rgba(212,160,74,0.7)",
                      "0 0 0 0 rgba(212,160,74,0)",
                    ],
                  }
                : { scale: 1 }
            }
            transition={
              shouldPulseEdit
                ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.2 }
            }
            className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors sm:h-11 sm:w-11 ${
              editMode
                ? "border-gold bg-gold text-bg-deep"
                : "border-gold/60 bg-bg-deep/60 text-gold hover:bg-gold/10"
            }`}
          >
            {editMode ? (
              <Check className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.5} />
            ) : (
              <ActionIcon
                assetId="ui.actionMove"
                alt="Edit base"
                fallback={Pencil}
                size={20}
                className="h-4 w-4 sm:h-5 sm:w-5"
                strokeWidth={2}
              />
            )}
          </motion.button>

          <motion.button
            type="button"
            onClick={() => {
              playSfx("buttonClick");
              openBuildMenu();
            }}
            disabled={editMode}
            aria-label="Open build menu"
            animate={
              shouldPulseBuild
                ? {
                    scale: [1, 1.06, 1],
                    boxShadow: [
                      "0 4px 18px -6px rgba(212,160,74,0.6)",
                      "0 6px 28px -4px rgba(212,160,74,0.9)",
                      "0 4px 18px -6px rgba(212,160,74,0.6)",
                    ],
                  }
                : { scale: 1 }
            }
            transition={
              shouldPulseBuild
                ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.2 }
            }
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-gold px-3 text-bg-deep shadow-[0_4px_18px_-6px_rgba(212,160,74,0.6)] transition-colors hover:bg-gold-dark disabled:cursor-not-allowed disabled:bg-gold-muted disabled:text-bg-deep/60 disabled:shadow-none sm:h-11 sm:px-4"
          >
            <ActionIcon
              assetId="ui.actionBuild"
              alt="Build"
              fallback={Hammer}
              size={20}
              className="h-4 w-4 sm:h-5 sm:w-5"
              strokeWidth={2.25}
            />
            <span className="font-sans text-xs font-bold uppercase tracking-[0.18em] sm:text-sm">
              Build
            </span>
          </motion.button>
        </div>
      </div>
    </nav>
  );
}
