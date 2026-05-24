"use client";

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
import { useGameStore } from "@/lib/store";

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

export function BottomNav() {
  const editMode = useGameStore((s) => s.editMode);
  const toggleEditMode = useGameStore((s) => s.toggleEditMode);
  const openBuildMenu = useGameStore((s) => s.openBuildMenu);

  const handleTap = (key: TabKey) => {
    if (key === ACTIVE) return;
    alert("Coming in a future sprint");
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
                  className={`flex w-full flex-col items-center gap-1 rounded-lg px-1 py-1.5 transition-colors ${
                    active
                      ? "text-gold"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon
                    className="h-5 w-5"
                    strokeWidth={active ? 2.25 : 1.75}
                  />
                  <span
                    className={`font-sans text-[10px] uppercase tracking-[0.18em] ${
                      active ? "font-semibold" : "font-medium"
                    }`}
                  >
                    {label}
                  </span>
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
          <button
            type="button"
            onClick={toggleEditMode}
            aria-label={editMode ? "Done editing" : "Edit base"}
            className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors sm:h-11 sm:w-11 ${
              editMode
                ? "border-gold bg-gold text-bg-deep"
                : "border-gold/60 bg-bg-deep/60 text-gold hover:bg-gold/10"
            }`}
          >
            {editMode ? (
              <Check className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.5} />
            ) : (
              <Pencil className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2} />
            )}
          </button>

          <button
            type="button"
            onClick={() => openBuildMenu()}
            disabled={editMode}
            aria-label="Open build menu"
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-gold px-3 text-bg-deep shadow-[0_4px_18px_-6px_rgba(212,160,74,0.6)] transition-colors hover:bg-gold-dark disabled:cursor-not-allowed disabled:bg-gold-muted disabled:text-bg-deep/60 disabled:shadow-none sm:h-11 sm:px-4"
          >
            <Hammer className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.25} />
            <span className="font-sans text-xs font-bold uppercase tracking-[0.18em] sm:text-sm">
              Build
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
}
