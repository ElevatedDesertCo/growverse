"use client";

import { ArrowUp } from "lucide-react";
import { motion } from "framer-motion";
import { BUILDINGS } from "@/lib/buildings";
import { useGameStore, type PlacedBuilding } from "@/lib/store";
import {
  canAffordUpgrade,
  isMaxLevel,
} from "@/lib/systems/upgradeSystem";
import { AssetImage } from "./AssetImage";
import { ActionIcon } from "./ActionIcon";

interface Props {
  building: PlacedBuilding;
  editMode: boolean;
  /** Growing progress 0..1 (growTent only). */
  growProgress?: number;
  /** True if this Grow Tent is ready to harvest. */
  isReady?: boolean;
  /** Pending Fire units (amberForge only). */
  pendingFire?: number;
}

export function BuildingTile({
  building,
  editMode,
  growProgress,
  isReady,
  pendingFire,
}: Props) {
  const def = BUILDINGS[building.type];
  const isGrowTent = def.growDurationMs !== undefined;
  const isAmberForge = def.firePerSecond !== undefined;
  const showFireBadge = isAmberForge && (pendingFire ?? 0) >= 1;

  // "Upgrade available" signal — true when the player has enough resources
  // to upgrade this building right now and it isn't maxed. Drives a small
  // pulsing badge so the player can see at a glance what to spend on next.
  const resources = useGameStore((s) => s.resources);
  const canUpgrade =
    !isMaxLevel(building.type, building.level) &&
    canAffordUpgrade(resources, building.type, building.level);

  return (
    <motion.div
      className="pointer-events-none relative h-full w-full"
      animate={
        editMode
          ? { rotate: [-1.5, 1.5, -1.5] }
          : isReady
            ? { scale: [1, 1.05, 1] }
            : { rotate: 0, scale: 1 }
      }
      transition={
        editMode
          ? { duration: 0.7, repeat: Infinity, ease: "easeInOut" }
          : isReady
            ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.2 }
      }
    >
      <div
        className="relative h-full w-full rounded-md"
        style={{
          // Soft elliptical ground shadow under the building for "weight".
          backgroundImage:
            "radial-gradient(ellipse 60% 18% at 50% 88%, rgba(0,0,0,0.45) 0%, transparent 70%)",
        }}
      >
        {/* Scale the building art slightly larger than its cell + use
            object-cover so the silhouette fills aggressively rather than
            shrinking inside a contain box. Drop-shadow gives lift. */}
        <div className="absolute inset-[-8%] overflow-visible">
          <AssetImage
            assetId={`building.${building.type}`}
            alt={def.name}
            fill
            sizes="(max-width: 768px) 96px, 168px"
            className="drop-shadow-[0_4px_5px_rgba(0,0,0,0.65)]"
            placeholderColor={def.color}
            placeholderLabel={def.name}
          />
        </div>

        {/* Grow Tent progress ring */}
        {isGrowTent && growProgress !== undefined && (
          <ProgressRing progress={growProgress} ready={!!isReady} />
        )}

        {/* Amber Forge pending Fire badge — number pill, with optional
            painted Collect icon next to it once the asset ships. */}
        {showFireBadge && (
          <div className="absolute -top-1 -right-1 flex items-center gap-0.5">
            <ActionIcon
              assetId="ui.actionCollect"
              alt="Ready to collect"
              size={18}
              className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
            />
            <span
              className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border border-black/40 bg-fire px-1 text-[10px] font-bold leading-none text-bg-deep shadow"
            >
              {pendingFire}
            </span>
          </div>
        )}

        {/* Grow Tent ready-to-harvest tag — painted Collect badge if art
            has shipped (the pulse on isReady stays from the parent). */}
        {isGrowTent && isReady && (
          <div className="pointer-events-none absolute -top-1 -right-1">
            <ActionIcon
              assetId="ui.actionCollect"
              alt="Ready to harvest"
              size={20}
              className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
            />
          </div>
        )}

        {/* Grow Tent in-progress — painted Timer glyph centered while
            growing. Renders nothing until the painted asset ships. */}
        {isGrowTent && !isReady && growProgress !== undefined && growProgress < 1 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <ActionIcon
              assetId="ui.actionTimer"
              alt="Growing"
              size={28}
              className="opacity-90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]"
            />
          </div>
        )}

        {/* Affordable-upgrade pulse — a subtle gold halo around the
            tile + a small ↑ chevron at top-left. Hides while a collect
            badge is showing on the right so the indicators don't fight. */}
        {canUpgrade && !showFireBadge && (
          <>
            <motion.div
              className="pointer-events-none absolute inset-0 rounded-md"
              animate={{
                boxShadow: [
                  "0 0 0 0 rgba(212,160,74,0.0), inset 0 0 8px rgba(212,160,74,0.0)",
                  "0 0 14px 2px rgba(212,160,74,0.55), inset 0 0 12px rgba(212,160,74,0.35)",
                  "0 0 0 0 rgba(212,160,74,0.0), inset 0 0 8px rgba(212,160,74,0.0)",
                ],
              }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden
            />
            <span
              className="absolute -top-1 -left-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-black/40 bg-gold text-bg-deep shadow"
              aria-label="Upgrade available"
            >
              <ArrowUp className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
          </>
        )}

        {/* Level badge */}
        <span
          className="absolute bottom-0.5 right-0.5 rounded-full border border-black/40 px-1 py-px text-[8px] font-bold leading-none text-bg-deep shadow"
          style={{ backgroundColor: def.color }}
        >
          Lv {building.level}
        </span>
      </div>
    </motion.div>
  );
}

function ProgressRing({
  progress,
  ready,
}: {
  progress: number;
  ready: boolean;
}) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const dashOffset = c * (1 - progress);
  const stroke = ready ? "#f5d97a" : "#d4a04a";
  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      {/* track */}
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="rgba(0,0,0,0.3)"
        strokeWidth="3"
      />
      {/* progress */}
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={dashOffset}
        transform="rotate(-90 50 50)"
        style={{
          filter: ready
            ? "drop-shadow(0 0 6px rgba(245,217,122,0.8))"
            : "drop-shadow(0 0 3px rgba(212,160,74,0.4))",
          transition: "stroke-dashoffset 200ms linear",
        }}
      />
    </svg>
  );
}
