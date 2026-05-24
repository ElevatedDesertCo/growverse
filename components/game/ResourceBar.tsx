"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { RESOURCES } from "@/lib/data";
import { useGameStore } from "@/lib/store";
import {
  getTotalStorageBonus,
} from "@/lib/systems/buildingSystem";
import {
  isCapped,
  maxFor,
  type Resources,
} from "@/lib/systems/resourceSystem";
import { SettingsButton } from "./SettingsButton";

type ResourceProps = {
  iconSrc: string;
  alt: string;
  value: number;
  max: number | null; // null = uncapped
  colorClass: string;
};

function ResourcePill({ iconSrc, alt, value, max, colorClass }: ResourceProps) {
  const display = max !== null
    ? `${value.toLocaleString()} / ${max.toLocaleString()}`
    : value.toLocaleString();
  const atCap = max !== null && value >= max;
  return (
    <div
      className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 shadow-[0_0_0_1px_rgba(212,160,74,0.05)_inset] ${
        atCap
          ? "border-red-400/60 bg-bg-deep/80"
          : "border-gold/40 bg-bg-deep/80"
      }`}
      title={`${alt}: ${display}${atCap ? " (full — build/upgrade a Storage Vault)" : ""}`}
    >
      <Image
        src={iconSrc}
        alt={alt}
        width={275}
        height={275}
        className="h-5 w-5 flex-shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
      />
      <motion.span
        key={value}
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.18, 1] }}
        transition={{ duration: 0.32, ease: "easeOut" }}
        className={`font-sans text-[11px] font-semibold tabular-nums ${colorClass}`}
      >
        {display}
      </motion.span>
    </div>
  );
}

export function ResourceBar() {
  const resources = useGameStore((s) => s.resources);
  // Subscribe to buildings so storage bonus recomputes on Vault changes.
  const buildings = useGameStore((s) => s.buildings);
  const storageBonus = getTotalStorageBonus(buildings);

  const pillFor = (field: keyof Resources, fallbackIcon: string, colorClass: string) => {
    const def = RESOURCES[field as keyof typeof RESOURCES];
    const max = isCapped(field) ? maxFor(field, storageBonus) : null;
    return (
      <ResourcePill
        iconSrc={def?.iconPath ?? fallbackIcon}
        alt={def?.name ?? field}
        value={resources[field]}
        max={max}
        colorClass={colorClass}
      />
    );
  };

  return (
    <header className="sticky top-0 z-30 border-b border-gold/15 bg-bg-deep/95 backdrop-blur supports-[backdrop-filter]:bg-bg-deep/70">
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-3 py-3 md:max-w-3xl md:px-6">
        <div className="flex items-center gap-2">
          <SettingsButton />
          <div className="flex flex-col items-start leading-none">
            <span
              className="font-display text-[17px] font-bold tracking-[0.22em] text-leaf"
              style={{
                fontFamily: "var(--font-cinzel)",
                textShadow:
                  "0 0 10px rgba(127,176,105,0.35), 0 1px 0 rgba(184,133,46,0.55), 0 2px 4px rgba(0,0,0,0.6)",
              }}
            >
              GROWVERSE
            </span>
            <span className="mt-0.5 font-sans text-[9px] uppercase tracking-[0.35em] text-text-muted">
              GC1
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {pillFor("bloomEssence", "/icons/leaf.png", "text-leaf")}
          {pillFor("amberShards", "/icons/fire.png", "text-fire")}
          {pillFor("mycoDust", "/icons/mushroom.png", "text-mushroom")}
        </div>
      </div>
    </header>
  );
}
