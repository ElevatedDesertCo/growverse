export type BuildingType =
  | "growTent"
  | "bloomExtractor"
  | "amberForge"
  | "thornTrap";

export interface BuildingDef {
  type: BuildingType;
  name: string;
  description: string;
  imagePath: string;
  color: string;
  /** Footprint on the grid, in cells. */
  size: { w: number; h: number };

  // ─── Sprint 3 economy ───────────────────────────────────────────────
  /** Time in ms for one grow cycle (growTent only). */
  growDurationMs?: number;
  /** Leaf yield per harvest (growTent only). */
  harvestYield?: number;
  /** Passive Fire generation rate per second (amberForge only). */
  firePerSecond?: number;
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  growTent: {
    type: "growTent",
    name: "Grow Tent",
    description: "Cultivates sacred cannabis. Produces Leaf at harvest.",
    imagePath: "/buildings/grow-tent.png",
    color: "#7fb069",
    size: { w: 2, h: 2 },
    growDurationMs: 30_000,
    harvestYield: 25,
  },
  bloomExtractor: {
    type: "bloomExtractor",
    name: "Bloom Extractor",
    description: "Multiplies harvest yield from nearby Grow Tents.",
    imagePath: "/buildings/bloom-extractor.png",
    color: "#d4a04a",
    size: { w: 2, h: 2 },
  },
  amberForge: {
    type: "amberForge",
    name: "Amber Forge",
    description: "Passively generates Fire over time.",
    imagePath: "/buildings/amber-forge.png",
    color: "#e8964c",
    size: { w: 2, h: 2 },
    firePerSecond: 0.5,
  },
  thornTrap: {
    type: "thornTrap",
    name: "Thorn Trap",
    description: "A vigilant defensive plant. Guards the base.",
    imagePath: "/buildings/thorn-trap.png",
    color: "#a875d4",
    size: { w: 2, h: 2 },
  },
};

export const BUILDING_TYPES: BuildingType[] = [
  "growTent",
  "bloomExtractor",
  "amberForge",
  "thornTrap",
];

/** Grid size — single source of truth. */
export const GRID_COLS = 16;
export const GRID_ROWS = 16;
