"use client";

import { Home, Swords, Zap, Sparkle, PawPrint } from "lucide-react";

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
  const handleTap = (key: TabKey) => {
    if (key === ACTIVE) return;
    alert("Coming in a future sprint");
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gold/15 bg-bg-deep/95 backdrop-blur supports-[backdrop-filter]:bg-bg-deep/80">
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
        {TABS.map(({ key, label, Icon }) => {
          const active = key === ACTIVE;
          return (
            <li key={key} className="flex-1">
              <button
                type="button"
                onClick={() => handleTap(key)}
                className={`flex w-full flex-col items-center gap-1 rounded-lg px-2 py-1.5 transition-colors ${
                  active
                    ? "text-gold"
                    : "text-text-muted hover:text-text-primary"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
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
    </nav>
  );
}
