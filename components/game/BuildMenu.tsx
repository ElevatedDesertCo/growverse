"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useRef } from "react";
import {
  BUILDINGS,
  BUILDING_TYPES,
  type BuildingDef,
  type BuildingType,
} from "@/lib/buildings";
import {
  canPlace,
  cellFromClientPoint,
  isAlreadyPlaced,
  useGameStore,
} from "@/lib/store";
import { canAfford } from "@/lib/economy";

export function BuildMenu() {
  const open = useGameStore((s) => s.buildMenuOpen);
  const selectedCell = useGameStore((s) => s.selectedCell);
  const buildings = useGameStore((s) => s.buildings);
  const leaf = useGameStore((s) => s.resources.bloomEssence);
  const placeBuilding = useGameStore((s) => s.placeBuilding);
  const closeBuildMenu = useGameStore((s) => s.closeBuildMenu);
  const dragState = useGameStore((s) => s.dragState);

  const ready = selectedCell !== null;
  const draggingPlace = dragState?.kind === "place";

  return (
    <>
      {open && ready && (
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
            className={`fixed inset-x-0 bottom-0 z-40 max-h-[60dvh] rounded-t-3xl border-t border-gold/30 bg-bg-deep/95 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-[0_-20px_60px_rgba(0,0,0,0.55)] backdrop-blur ${
              draggingPlace ? "overflow-visible" : "overflow-y-auto"
            }`}
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
                  <p
                    className={`mt-1 text-[11px] uppercase tracking-[0.22em] ${
                      draggingPlace
                        ? "text-gold"
                        : ready
                          ? "text-text-muted"
                          : "animate-pulse text-gold"
                    }`}
                  >
                    {draggingPlace
                      ? "Release on a grid cell to drop"
                      : ready
                        ? `Cell ${selectedCell!.x + 1}, ${selectedCell!.y + 1} · tap a card`
                        : "↑ Tap a glowing cell, or drag a card onto the grid"}
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
                {BUILDING_TYPES.map((type) => {
                  const def = BUILDINGS[type];
                  const singletonBlocked =
                    def.singleton === true && isAlreadyPlaced(type, buildings);
                  const fits =
                    ready &&
                    canPlace(type, selectedCell!.x, selectedCell!.y, buildings);
                  const afford = canAfford(leaf, def.baseCost);
                  const reason = singletonBlocked
                    ? "Already placed"
                    : !ready
                      ? null
                      : !fits
                        ? "No room here"
                        : !afford
                          ? `Need ${def.baseCost - leaf} Bloom`
                          : null;
                  return (
                    <BuildingCard
                      key={type}
                      def={def}
                      tapDisabled={singletonBlocked || !ready || !fits || !afford}
                      dragDisabled={singletonBlocked}
                      reason={reason}
                      onTap={() => placeBuilding(type)}
                      type={type}
                    />
                  );
                })}
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
  tapDisabled,
  dragDisabled = false,
  reason,
  onTap,
  type,
}: {
  def: BuildingDef;
  tapDisabled: boolean;
  dragDisabled?: boolean;
  reason: string | null;
  onTap: () => void;
  type: BuildingType;
}) {
  const startPlaceDrag = useGameStore((s) => s.startPlaceDrag);
  const setHoverCell = useGameStore((s) => s.setHoverCell);
  const commitDrag = useGameStore((s) => s.commitDrag);
  const cancelDrag = useGameStore((s) => s.cancelDrag);
  const draggingRef = useRef(false);

  return (
    <motion.button
      type="button"
      drag={!dragDisabled}
      dragSnapToOrigin
      dragElastic={0}
      dragMomentum={false}
      whileDrag={{ scale: 1.05, opacity: 0.95, zIndex: 70 }}
      onDragStart={() => {
        draggingRef.current = true;
        startPlaceDrag(type);
      }}
      onDrag={(_, info) => {
        setHoverCell(cellFromClientPoint(info.point.x, info.point.y));
      }}
      onDragEnd={() => {
        commitDrag();
        // Small delay so the synthesized click that follows pointerUp
        // doesn't trigger onClick after a drop.
        setTimeout(() => {
          draggingRef.current = false;
        }, 50);
      }}
      onPointerCancel={() => {
        if (draggingRef.current) {
          cancelDrag();
          draggingRef.current = false;
        }
      }}
      onClick={(e) => {
        if (draggingRef.current) {
          e.preventDefault();
          return;
        }
        if (!tapDisabled) onTap();
      }}
      aria-label={`Place ${def.name}`}
      className={`group relative flex flex-col items-center gap-2 rounded-xl border border-gold/20 bg-bg-mid/60 p-3 text-left transition select-none ${
        tapDisabled
          ? "cursor-grab opacity-90"
          : "cursor-grab hover:border-gold/50 active:cursor-grabbing"
      }`}
      style={{ touchAction: "none" }}
    >
      <div
        className="relative h-20 w-20 overflow-hidden rounded-lg"
        style={{ backgroundColor: `${def.color}1a` }}
      >
        <Image
          src={def.imagePath}
          alt={def.name}
          fill
          sizes="80px"
          className="object-contain p-1"
          draggable={false}
          onError={(e) => {
            console.error(
              `[BuildMenu] Failed to load card image for ${def.name}: ${def.imagePath}`,
              e,
            );
          }}
        />
      </div>

      <div className="w-full text-center">
        <div className="font-display text-sm font-semibold tracking-wide text-text-primary">
          {def.name}
        </div>
        <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-text-muted">
          {def.description}
        </p>
        <p className="mt-0.5 text-[9px] uppercase tracking-[0.2em] text-text-muted/70">
          {def.size.w} × {def.size.h}
        </p>
        <p className="mt-1 font-sans text-[11px] font-bold tabular-nums text-leaf">
          {def.baseCost} <span className="text-text-muted">Bloom</span>
        </p>
      </div>

      <span
        className="mt-auto inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-bg-deep transition-colors"
        style={{ backgroundColor: tapDisabled ? "#5a4a30" : def.color }}
      >
        {reason ?? "Place"}
      </span>
    </motion.button>
  );
}
