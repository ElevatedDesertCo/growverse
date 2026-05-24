/**
 * Building data foundation.
 *
 * Phase 2 V2 LIVE roster — what BuildMenu actually surfaces:
 *   Guild Core, Bloom Extractor, Storage Vault, Training Grounds,
 *   Spirit Nursery, Portal Gate, Defense Totem, Vine Wall.
 *
 * Legacy v1.1 building types (growTent, amberForge, thornTrap) are KEPT
 * in the BUILDINGS record so existing saves still render them. They're
 * just not in BUILDING_TYPES, so the BuildMenu doesn't offer new ones.
 *
 * Each Phase-2 def carries the full spec'd shape: category, guildId,
 * maxLevel, baseCost, upgradeCosts[level → ResourceBag], productionRate,
 * storageBonus, health, unlockCoreLevel, etc.
 */

import type { GuildId, ResourceId } from "./data/types";
import type { Resources } from "./systems/resourceSystem";

export type BuildingType =
  // v1.1 Phase 1 (kept in data; not in v2 P2 BUILDING_TYPES)
  | "growTent"
  | "bloomExtractor"
  | "amberForge"
  | "thornTrap"
  // v2 canon
  | "guildCore"
  | "mycoExtractor"
  | "storageVault"
  | "trainingGrounds"
  | "spiritNursery"
  | "portalGate"
  | "relicWorkshop"
  | "defenseTotem"
  | "vineWall"
  | "sporeTrap"
  | "flameTotem"
  | "waterChannel"
  | "rootWall";

export type BuildingCategory =
  | "core"
  | "resource"
  | "storage"
  | "training"
  | "spiritPet"
  | "portal"
  | "defense"
  | "legacy";

/** Resource bag for costs. Subset of Resources. */
export type ResourceCost = Partial<Resources>;

export interface BuildingDef {
  type: BuildingType;
  name: string;
  description: string;
  imagePath: string;
  color: string;
  category: BuildingCategory;
  guildId?: GuildId | null;
  /** Footprint on the grid, in cells. */
  size: { w: number; h: number };
  /** Max upgrade level. Defaults to 5 if unset. */
  maxLevel?: number;
  /** HP at level 1 (used by Phase 7 defense system; stored now for completeness). */
  health?: number;
  /** Resource this building produces (resource buildings only). */
  producesResource?: ResourceId | null;
  /** Per-level Storage Vault bonus (storage buildings only). */
  storageBonus?: number;
  /** Required Guild Core level to unlock in BuildMenu. */
  unlockCoreLevel: number;

  // ─── Production economy ───────────────────────────────────────────
  /** Time in ms for one production cycle (legacy growTent only). */
  growDurationMs?: number;
  /** Yield per harvest at level 1 (legacy growTent only). */
  harvestYield?: number;
  /** Passive resource rate at level 1, per second
   *  (bloomExtractor produces bloomEssence, amberForge produces amberShards,
   *  mycoExtractor produces mycoDust). */
  firePerSecond?: number;

  // ─── Costs ────────────────────────────────────────────────────────
  /** Bloom-only legacy cost (Phase 1 compat). Use `buildCost` instead going forward. */
  baseCost: number;
  /** Full per-resource cost to PLACE at level 1. */
  buildCost?: ResourceCost;
  /** Per-resource costs to upgrade from level N to N+1. Index 0 = L1→L2. */
  upgradeCosts?: ResourceCost[];
  /** Legacy per-building cost multiplier (defaults to 1.5×). */
  costMultiplier?: number;

  // ─── Meta ─────────────────────────────────────────────────────────
  /** Phase at which this building becomes placeable. */
  phaseAvailable: number;
  /** Single-instance buildings (Guild Core, etc.). */
  singleton?: boolean;
  /** Defense contribution flag (Phase 7+ defense score). */
  isDefense?: boolean;
  /** True when imagePath is a stand-in awaiting proper art. */
  placeholderArt?: boolean;
}

// ─── Helper: produce a 4-tier upgrade cost ramp from a base bag ──────
// L1→L2 = base, L2→L3 = base × 1.5, L3→L4 = × 2.25, L4→L5 = × 3.375.
function ramp(base: ResourceCost): ResourceCost[] {
  const multipliers = [1, 1.5, 2.25, 3.375];
  return multipliers.map((m) => {
    const out: ResourceCost = {};
    (Object.keys(base) as (keyof Resources)[]).forEach((k) => {
      out[k] = Math.ceil((base[k] ?? 0) * m);
    });
    return out;
  });
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  // ─── v2 P2 LIVE — the 8 canonical Phase 2 buildings ───────────────
  guildCore: {
    type: "guildCore",
    name: "Guild Core",
    description:
      "The beating heart of your base. Higher Core levels unlock more buildings. Single instance.",
    imagePath: "/buildings-library/soul-altar.png",
    color: "#d4a04a",
    category: "core",
    size: { w: 3, h: 3 },
    maxLevel: 5,
    health: 1000,
    unlockCoreLevel: 0, // always available (it IS the core)
    baseCost: 0,
    buildCost: {},
    upgradeCosts: ramp({ bloomEssence: 200, amberShards: 50 }),
    phaseAvailable: 2,
    singleton: true,
    placeholderArt: true,
  },
  bloomExtractor: {
    type: "bloomExtractor",
    name: "Bloom Extractor",
    description:
      "Cultivates Bloom Essence from leyline residue. Tap to collect.",
    imagePath: "/buildings/bloom-extractor.png",
    color: "#7fb069",
    category: "resource",
    guildId: "bloomveil",
    size: { w: 2, h: 2 },
    maxLevel: 5,
    health: 300,
    producesResource: "bloomEssence",
    firePerSecond: 0.4, // 24/min at L1; scales 1.5× per level via statAtLevel
    unlockCoreLevel: 1,
    baseCost: 50,
    buildCost: { bloomEssence: 50 },
    upgradeCosts: ramp({ bloomEssence: 75 }),
    phaseAvailable: 2,
  },
  storageVault: {
    type: "storageVault",
    name: "Storage Vault",
    description:
      "Increases the storage cap for every resource. Build more to hoard more.",
    imagePath: "/buildings-library/amber-vault-sheet.png",
    color: "#b8852e",
    category: "storage",
    size: { w: 2, h: 2 },
    maxLevel: 5,
    health: 400,
    storageBonus: 500, // L1 = +500 cap on every capped resource; scales 1.5× per level
    unlockCoreLevel: 1,
    baseCost: 70,
    buildCost: { bloomEssence: 70 },
    upgradeCosts: ramp({ bloomEssence: 110, amberShards: 20 }),
    phaseAvailable: 2,
    placeholderArt: true,
  },
  trainingGrounds: {
    type: "trainingGrounds",
    name: "Training Grounds",
    description: "Trains Growers and units for raids and defense.",
    imagePath: "/buildings-library/training-grounds-sheet.png",
    color: "#d4a04a",
    category: "training",
    size: { w: 3, h: 2 },
    maxLevel: 5,
    health: 500,
    unlockCoreLevel: 2,
    baseCost: 120,
    buildCost: { bloomEssence: 120, amberShards: 40 },
    upgradeCosts: ramp({ bloomEssence: 150, amberShards: 60 }),
    phaseAvailable: 2,
    placeholderArt: true,
  },
  spiritNursery: {
    type: "spiritNursery",
    name: "Spirit Nursery",
    description:
      "Cracks open Spirit Seeds. Unlocks and evolves spirit pets.",
    imagePath: "/buildings-library/seed-reliquary-sheet.png",
    color: "#7fb069",
    category: "spiritPet",
    size: { w: 2, h: 2 },
    maxLevel: 5,
    health: 350,
    unlockCoreLevel: 3,
    baseCost: 180,
    buildCost: { bloomEssence: 180, spiritSeeds: 5 },
    upgradeCosts: ramp({ bloomEssence: 220, spiritSeeds: 5 }),
    phaseAvailable: 2,
    placeholderArt: true,
  },
  portalGate: {
    type: "portalGate",
    name: "Portal Gate",
    description:
      "Channels Portal Energy. Unlocks raid map travel and story zones.",
    imagePath: "/buildings-library/obsidian-antichamber-sheet.png",
    color: "#a875d4",
    category: "portal",
    size: { w: 2, h: 2 },
    maxLevel: 5,
    health: 450,
    unlockCoreLevel: 4,
    baseCost: 250,
    buildCost: { bloomEssence: 250, relicFragments: 10 },
    upgradeCosts: ramp({ bloomEssence: 300, relicFragments: 15 }),
    phaseAvailable: 2,
    placeholderArt: true,
  },
  defenseTotem: {
    type: "defenseTotem",
    name: "Defense Totem",
    description: "Generic base-defense structure. Contributes defense score.",
    imagePath: "/defenses-library/outpost-beacon-sheet.png",
    color: "#6b5a3a",
    category: "defense",
    size: { w: 2, h: 2 },
    maxLevel: 5,
    health: 600,
    unlockCoreLevel: 2,
    baseCost: 80,
    buildCost: { bloomEssence: 80, amberShards: 25 },
    upgradeCosts: ramp({ bloomEssence: 100, amberShards: 40 }),
    phaseAvailable: 2,
    isDefense: true,
    placeholderArt: true,
  },
  vineWall: {
    type: "vineWall",
    name: "Vine Wall",
    description: "Bloomveil defensive barrier of living vines.",
    imagePath: "/defenses-library/root-barrier-sheet.png",
    color: "#7fb069",
    category: "defense",
    guildId: "bloomveil",
    size: { w: 2, h: 1 },
    maxLevel: 5,
    health: 250,
    unlockCoreLevel: 2,
    baseCost: 35,
    buildCost: { bloomEssence: 35 },
    upgradeCosts: ramp({ bloomEssence: 50 }),
    phaseAvailable: 2,
    isDefense: true,
    placeholderArt: true,
  },

  // ─── v1.1 LEGACY — kept in data, not in v2 P2 BUILDING_TYPES ──────
  growTent: {
    type: "growTent",
    name: "Bloom Garden", // legacy label kept for old saves
    description:
      "Legacy cultivator (replaced by Bloom Extractor). Existing instances still harvest.",
    imagePath: "/buildings/grow-tent.png",
    color: "#7fb069",
    category: "legacy",
    guildId: "bloomveil",
    size: { w: 2, h: 2 },
    growDurationMs: 30_000,
    harvestYield: 25,
    baseCost: 30,
    unlockCoreLevel: 99, // effectively hidden
    phaseAvailable: 1,
    producesResource: "bloomEssence",
  },
  amberForge: {
    type: "amberForge",
    name: "Amber Forge",
    description:
      "Legacy passive Amber generator (predecessor of v2 forge buildings).",
    imagePath: "/buildings/amber-forge.png",
    color: "#e8964c",
    category: "legacy",
    guildId: "ember",
    size: { w: 2, h: 2 },
    firePerSecond: 0.5,
    baseCost: 60,
    unlockCoreLevel: 99,
    phaseAvailable: 1,
    producesResource: "amberShards",
  },
  thornTrap: {
    type: "thornTrap",
    name: "Root Wall",
    description: "Legacy defensive plant — preserved for old saves.",
    imagePath: "/buildings/thorn-trap.png",
    color: "#a875d4",
    category: "legacy",
    guildId: "thorn",
    size: { w: 2, h: 2 },
    baseCost: 40,
    unlockCoreLevel: 99,
    phaseAvailable: 1,
    isDefense: true,
  },

  // ─── v2 canon, data-only (not in BUILDING_TYPES until later phases) ──
  mycoExtractor: {
    type: "mycoExtractor",
    name: "Myco Extractor",
    description: "Cultivates spore strains. Generates Myco Dust passively.",
    imagePath: "/buildings-library/myco-reliquary-sheet.png",
    color: "#a875d4",
    category: "resource",
    guildId: "spores",
    size: { w: 2, h: 2 },
    maxLevel: 5,
    health: 300,
    producesResource: "mycoDust",
    firePerSecond: 0.3,
    unlockCoreLevel: 3,
    baseCost: 80,
    buildCost: { bloomEssence: 80, mycoDust: 10 },
    upgradeCosts: ramp({ bloomEssence: 100, mycoDust: 15 }),
    phaseAvailable: 3,
    placeholderArt: true,
  },
  relicWorkshop: {
    type: "relicWorkshop",
    name: "Relic Workshop",
    description: "Crafts gear and relics from Relic Fragments.",
    imagePath: "/buildings-library/bloom-reservoir-sheet.png",
    color: "#8a7d68",
    category: "training",
    size: { w: 2, h: 2 },
    maxLevel: 5,
    health: 400,
    unlockCoreLevel: 4,
    baseCost: 200,
    buildCost: { bloomEssence: 200, relicFragments: 8 },
    upgradeCosts: ramp({ bloomEssence: 240, relicFragments: 12 }),
    phaseAvailable: 4,
    placeholderArt: true,
  },
  sporeTrap: {
    type: "sporeTrap",
    name: "Spore Trap",
    description: "Spores Guild control trap. Hallucinates intruders.",
    imagePath: "/defenses-library/snare-totem-sheet.png",
    color: "#a875d4",
    category: "defense",
    guildId: "spores",
    size: { w: 2, h: 2 },
    maxLevel: 5,
    health: 280,
    unlockCoreLevel: 3,
    baseCost: 55,
    buildCost: { bloomEssence: 55, mycoDust: 10 },
    upgradeCosts: ramp({ bloomEssence: 80, mycoDust: 15 }),
    phaseAvailable: 7,
    isDefense: true,
    placeholderArt: true,
  },
  flameTotem: {
    type: "flameTotem",
    name: "Flame Totem",
    description: "Ember Guild offensive totem. Burns approaching raiders.",
    imagePath: "/defenses-library/doobie-cannon-sheet.png",
    color: "#e8964c",
    category: "defense",
    guildId: "ember",
    size: { w: 2, h: 2 },
    maxLevel: 5,
    health: 320,
    unlockCoreLevel: 3,
    baseCost: 75,
    buildCost: { bloomEssence: 75, amberShards: 30 },
    upgradeCosts: ramp({ bloomEssence: 100, amberShards: 45 }),
    phaseAvailable: 7,
    isDefense: true,
    placeholderArt: true,
  },
  waterChannel: {
    type: "waterChannel",
    name: "Water Channel",
    description:
      "Water Guild flow structure. Heals nearby units, slows enemies.",
    imagePath: "/buildings-library/spirit-shrine.png",
    color: "#5fa9d4",
    category: "defense",
    guildId: "water",
    size: { w: 2, h: 1 },
    maxLevel: 5,
    health: 240,
    unlockCoreLevel: 3,
    baseCost: 65,
    buildCost: { bloomEssence: 65 },
    upgradeCosts: ramp({ bloomEssence: 90 }),
    phaseAvailable: 8,
    placeholderArt: true,
  },
  rootWall: {
    type: "rootWall",
    name: "Root Wall",
    description:
      "Roots/Thorn Guild defensive wall. Thorny, sentient, grumpy.",
    imagePath: "/defenses-library/root-barrier-sheet.png",
    color: "#6b8e4e",
    category: "defense",
    guildId: "thorn",
    size: { w: 2, h: 1 },
    maxLevel: 5,
    health: 200,
    unlockCoreLevel: 2,
    baseCost: 45,
    buildCost: { bloomEssence: 45 },
    upgradeCosts: ramp({ bloomEssence: 60 }),
    phaseAvailable: 7,
    isDefense: true,
    placeholderArt: true,
  },
};

/**
 * The Phase 2 LIVE roster shown in BuildMenu. Order matters — Guild
 * Core first as the foundation, then resource + storage, then defense.
 * BuildMenu still gates each by `unlockCoreLevel` against the player's
 * current Guild Core level.
 */
export const BUILDING_TYPES: BuildingType[] = [
  "guildCore",
  "bloomExtractor",
  "storageVault",
  "trainingGrounds",
  "defenseTotem",
  "vineWall",
  "spiritNursery",
  "portalGate",
];

/** Every v2 canon building, in display order. */
export const ALL_BUILDING_TYPES: BuildingType[] = [
  "guildCore",
  "bloomExtractor",
  "storageVault",
  "trainingGrounds",
  "defenseTotem",
  "vineWall",
  "spiritNursery",
  "portalGate",
  "mycoExtractor",
  "relicWorkshop",
  "sporeTrap",
  "flameTotem",
  "waterChannel",
  "rootWall",
  // legacy
  "growTent",
  "amberForge",
  "thornTrap",
];

/** Grid size — single source of truth. */
export const GRID_COLS = 16;
export const GRID_ROWS = 16;
