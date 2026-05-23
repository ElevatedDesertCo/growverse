"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { BUILDINGS, BUILDING_TYPES, type BuildingDef } from "@/lib/buildings";
import { useGameStore } from "@/lib/store";

export function BuildMenu() {
  const open = useGameStore((s) => s.buildMenuOpen);
  const selectedCell = useGameStore((s) => s.selectedCell);
  const placeBuilding = useGameStore((s) => s.placeBuilding);
  const closeBuildMenu = useGameStore((s) => s.closeBuildMenu);

  const ready = selectedCell !== null;

  return (
    <>
      {open && (
        <div
          onClick={closeBuildMenu}
          className="fixed inset-0 z-40 bg-black/60 transition-opacity"
          aria-hidden
        />
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            key="drawer"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
            role="dialog"
            aria-label="Build menu"
            aria-modal="true"
            className="fixed inset-x-0 bottom-0 z-40 max-h-[60dvh] overflow-y-auto rounded-t-3xl border-t border-gold/30 bg-bg-deep/95 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-[0_-20px_60px_rgba(0,0,0,0.55)] backdrop-blur"
          >
            <div className="mx-auto max-w-md px-4 pt-3 md:max-w-3xl">
              <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-gold/30" />

              <header className="flex items-end justify-between">
                <div className="flex flex-col leading-none">
                  <h2
                    className="font-display text-base font-semibold tracking-[0.22em] text-gold"
                    style={{ fontFamily: "var(--font-cinzel)" }}
                  >
                    BUILD
                  </h2>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-text-muted">
                    {ready
                      ? `Cell ${selectedCell!.x + 1}, ${selectedCell!.y + 1}`
                      : "Tap an empty cell first"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeBuildMenu}
                  className="rounded-full p-1.5 text-text-muted transition-colors hover:bg-bg-mid/60 hover:text-text-primary"
                  aria-label="Close build menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {BUILDING_TYPES.map((type) => (
                  <BuildingCard
                    key={type}
                    def={BUILDINGS[type]}
                    disabled={!ready}
                    onPlace={() => placeBuilding(type)}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function BuildingCard({
  def,
  disabled,
  onPlace,
}: {
  def: BuildingDef;
  disabled: boolean;
  onPlace: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPlace}
      disabled={disabled}
      className="group flex flex-col items-center gap-2 rounded-xl border border-gold/20 bg-bg-mid/60 p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:border-gold/50 enabled:active:scale-[0.98]"
    >
      <div
        className="relative h-20 w-20 overflow-hidden rounded-lg"
        style={{ backgroundColor: `${def.color}1a` }}
      >
        {def.imagePath ? (
          <Image
            src={def.imagePath}
            alt={def.name}
            fill
            sizes="80px"
            className="object-contain p-1"
          />
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center font-display"
            style={{ color: def.color }}
          >
            <span className="text-2xl font-bold tracking-wider">
              {def.name
                .split(" ")
                .map((w) => w[0])
                .join("")}
            </span>
            <span className="mt-0.5 text-[8px] uppercase tracking-[0.2em] opacity-70">
              Art TBD
            </span>
          </div>
        )}
      </div>

      <div className="w-full text-center">
        <div className="font-display text-sm font-semibold tracking-wide text-text-primary">
          {def.name}
        </div>
        <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-text-muted">
          {def.description}
        </p>
      </div>

      <span
        className="mt-auto inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-bg-deep transition-colors"
        style={{ backgroundColor: disabled ? "#5a4a30" : def.color }}
      >
        Place
      </span>
    </button>
  );
}
