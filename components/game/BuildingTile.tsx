"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { BUILDINGS } from "@/lib/buildings";
import type { PlacedBuilding } from "@/lib/store";

interface Props {
  building: PlacedBuilding;
  editMode: boolean;
  isSelected: boolean;
}

export function BuildingTile({ building, editMode }: Props) {
  const def = BUILDINGS[building.type];

  return (
    <motion.div
      className="pointer-events-none relative h-full w-full"
      animate={editMode ? { rotate: [-1.5, 1.5, -1.5] } : { rotate: 0 }}
      transition={
        editMode
          ? { duration: 0.7, repeat: Infinity, ease: "easeInOut" }
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
            // Don't render a placeholder — just log so we know if a path 404s.
            console.error(
              `[BuildingTile] Failed to load image for ${def.name}: ${def.imagePath}`,
              e,
            );
          }}
        />

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
