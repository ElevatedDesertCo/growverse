"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { BUILDINGS } from "@/lib/buildings";
import type { PlacedBuilding } from "@/lib/store";

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
      <div className="relative h-full w-full rounded-md">
        <Image
          src={def.imagePath}
          alt={def.name}
          fill
          sizes="(max-width: 768px) 80px, 140px"
          className="object-contain p-0.5 drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]"
          onError={(e) => {
            console.error(
              `[BuildingTile] Failed to load image for ${def.name}: ${def.imagePath}`,
              e,
            );
          }}
        />

        {/* Grow Tent progress ring */}
        {isGrowTent && growProgress !== undefined && (
          <ProgressRing progress={growProgress} ready={!!isReady} />
        )}

        {/* Amber Forge pending Fire badge */}
        {showFireBadge && (
          <span
            className="absolute -top-1 -right-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border border-black/40 bg-fire px-1 text-[10px] font-bold leading-none text-bg-deep shadow"
          >
            {pendingFire}
          </span>
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
