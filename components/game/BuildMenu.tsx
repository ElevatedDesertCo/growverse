"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import {
  BUILDINGS,
  BUILDING_TYPES,
  type BuildingDef,
  type BuildingType,
  type ResourceCost,
} from "@/lib/buildings";
import { Lock } from "lucide-react";
import { RESOURCES } from "@/lib/data";
import type { Resources } from "@/lib/systems/resourceSystem";
import { playSfx } from "@/lib/systems/audioSystem";
import { pushToast } from "@/lib/systems/toastSystem";
import { useRef, useState } from "react";
import { AssetImage } from "./AssetImage";

/** Display label for a resource field (canon short name). */
function labelFor(field: string): string {
  switch (field as keyof Resources) {
    case "bloomEssence": return "Bloom";
    case "amberShards": return "Amber";
    case "mycoDust": return "Myco";
    case "relicFragments": return "Relic";
    case "spiritSeeds": return "Seeds";
    case "portalEnergy": return "Portal";
    case "guildXp": return "XP";
    case "cardShards": return "Shards";
    default: return field;
  }
}

/** Color tint for a resource field. */
function colorFor(field: string): string {
  return (
    RESOURCES[field as keyof typeof RESOURCES]?.color ?? "#d4a04a"
  );
}
import {
  canPlace,
  cellFromClientPoint,
  isAlreadyPlaced,
  useGameStore,
} from "@/lib/store";
import {
  getGuildCoreLevel,
  isUnlockedAtCoreLevel,
} from "@/lib/systems/buildingSystem";
import { canAffordCost, missingFor } from "@/lib/systems/resourceSystem";

export function BuildMenu() {
  const open = useGameStore((s) => s.buildMenuOpen);
  const selectedCell = useGameStore((s) => s.selectedCell);
  const buildings = useGameStore((s) => s.buildings);
  const resources = useGameStore((s) => s.resources);
  const placeBuilding = useGameStore((s) => s.placeBuilding);
  const closeBuildMenu = useGameStore((s) => s.closeBuildMenu);
  const dragState = useGameStore((s) => s.dragState);
  const coreLevel = getGuildCoreLevel(buildings);

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
                  const cost = def.buildCost ?? { bloomEssence: def.baseCost };
                  const unlocked = isUnlockedAtCoreLevel(type, coreLevel);
                  const singletonBlocked =
                    def.singleton === true && isAlreadyPlaced(type, buildings);
                  const fits =
                    ready &&
                    canPlace(type, selectedCell!.x, selectedCell!.y, buildings);
                  const afford = canAffordCost(resources, cost);
                  let reason: string | null = null;
                  if (!unlocked) {
                    reason = `Needs Core L${def.unlockCoreLevel}`;
                  } else if (singletonBlocked) {
                    reason = "Already placed";
                  } else if (ready) {
                    if (!fits) reason = "No room here";
                    else if (!afford) {
                      const missing = missingFor(resources, cost);
                      const first = Object.entries(missing)[0];
                      reason = first
                        ? `Need ${first[1]} more ${labelFor(first[0])}`
                        : "Insufficient";
                    }
                  }
                  return (
                    <BuildingCard
                      key={type}
                      def={def}
                      cost={cost}
                      tapDisabled={
                        !unlocked ||
                        singletonBlocked ||
                        !ready ||
                        !fits ||
                        !afford
                      }
                      dragDisabled={!unlocked || singletonBlocked}
                      locked={!unlocked}
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
  cost,
  tapDisabled,
  dragDisabled = false,
  locked = false,
  reason,
  onTap,
  type,
}: {
  def: BuildingDef;
  cost: ResourceCost;
  tapDisabled: boolean;
  dragDisabled?: boolean;
  locked?: boolean;
  reason: string | null;
  onTap: () => void;
  type: BuildingType;
}) {
  const startPlaceDrag = useGameStore((s) => s.startPlaceDrag);
  const setHoverCell = useGameStore((s) => s.setHoverCell);
  const commitDrag = useGameStore((s) => s.commitDrag);
  const cancelDrag = useGameStore((s) => s.cancelDrag);
  const draggingRef = useRef(false);
  const [shakeKey, setShakeKey] = useState(0);

  const triggerLockedShake = () => {
    playSfx("locked");
    setShakeKey((k) => k + 1);
    if (reason) {
      pushToast({
        kind: "error",
        title: "Can't place",
        body: `${def.name}: ${reason}`,
      });
    }
  };

  return (
    <motion.button
      type="button"
      drag={!dragDisabled}
      dragSnapToOrigin
      dragElastic={0}
      dragMomentum={false}
      whileDrag={{ scale: 1.05, opacity: 0.95, zIndex: 70 }}
      animate={
        shakeKey > 0
          ? { x: [0, -6, 6, -4, 4, -2, 0] }
          : undefined
      }
      transition={shakeKey > 0 ? { duration: 0.35 } : undefined}
      onAnimationComplete={() => {
        // Reset so a future shake replays the animation.
        // Doesn't change `shakeKey > 0` until next render, which is fine.
      }}
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
        if (tapDisabled) {
          triggerLockedShake();
          return;
        }
        playSfx("buttonClick");
        onTap();
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
        <AssetImage
          assetId={`building.${type}`}
          alt={def.name}
          fill
          sizes="80px"
          className={`p-1 ${locked ? "grayscale" : ""}`}
          notDraggable
          placeholderColor={def.color}
          placeholderLabel={def.name}
        />
        {locked && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-deep/60">
            <Lock className="h-6 w-6 text-gold/80" />
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
        <p className="mt-0.5 text-[9px] uppercase tracking-[0.2em] text-text-muted/70">
          {def.size.w} × {def.size.h}
          {def.category && (
            <span className="ml-1 text-text-muted/60">· {def.category}</span>
          )}
        </p>
        <CostLine cost={cost} />
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

/** Inline multi-resource cost display: "30 Bloom · 10 Amber". */
function CostLine({ cost }: { cost: ResourceCost }) {
  const entries = Object.entries(cost).filter(([, v]) => (v ?? 0) > 0);
  if (entries.length === 0) {
    return (
      <p className="mt-1 font-sans text-[11px] font-bold tabular-nums text-leaf">
        Free
      </p>
    );
  }
  return (
    <p className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 font-sans text-[11px] font-bold tabular-nums">
      {entries.map(([k, v]) => (
        <span key={k} style={{ color: colorFor(k) }}>
          {v}
          <span className="ml-0.5 text-text-muted">{labelFor(k)}</span>
        </span>
      ))}
    </p>
  );
}
