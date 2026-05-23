"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { BUILDINGS, type BuildingDef } from "@/lib/buildings";
import type { PlacedBuilding } from "@/lib/store";

interface Props {
  building: PlacedBuilding;
  editMode: boolean;
  isSelected: boolean;
}

export function BuildingTile({ building, editMode, isSelected }: Props) {
  const def = BUILDINGS[building.type];

  return (
    <motion.div
      className="pointer-events-none relative h-full w-full"
      animate={
        editMode
          ? { rotate: [-1.5, 1.5, -1.5] }
          : { rotate: 0 }
      }
      transition={
        editMode
          ? { duration: 0.7, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0.2 }
      }
    >
      <div
        className={`relative h-full w-full rounded-md ${
          isSelected
            ? "ring-2 ring-gold ring-offset-1 ring-offset-bg-deep shadow-[0_0_18px_rgba(212,160,74,0.55)]"
            : ""
        }`}
      >
        {def.imagePath ? (
          <Image
            src={def.imagePath}
            alt={def.name}
            fill
            sizes="(max-width: 768px) 64px, 112px"
            className="object-contain p-0.5 drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]"
          />
        ) : (
          <PlaceholderTile def={def} />
        )}

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

function PlaceholderTile({ def }: { def: BuildingDef }) {
  const initials = def.name
    .split(" ")
    .map((w) => w[0])
    .join("");

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center rounded-md p-0.5 text-center"
      style={{
        background: `radial-gradient(circle at 50% 35%, ${def.color}cc, ${def.color}55 70%, ${def.color}22)`,
      }}
    >
      <span
        className="font-display text-lg font-bold leading-none tracking-wide"
        style={{ color: "rgba(15,10,6,0.85)" }}
      >
        {initials}
      </span>
      <span
        className="mt-0.5 text-[7px] font-medium leading-tight"
        style={{ color: "rgba(15,10,6,0.7)" }}
      >
        TBD
      </span>
    </div>
  );
}
