/**
 * Building data foundation.
 *
 * The original 4 v1.1 Phase 1 building types (growTent, bloomExtractor,
 * amberForge, thornTrap) are LIVE in the BuildMenu and cannot have their
 * type ids renamed without breaking saves.
 *
 * The 11 new v2 canon buildings (Guild Core, Myco Extractor, Storage Vault,
 * Training Grounds, Spirit Nursery, Portal Gate, Relic Workshop, Defense
 * Totem, Vine Wall, Spore Trap, Flame Totem, Water Channel, Root Wall) are
 * DATA-ONLY here in Phase 1 of v2. They land in the BuildMenu in their
 * respective later phases — see `phaseAvailable` on each def and the
 * `LIVE_BUILDING_TYPES` array which is what the BuildMenu actually reads.
 *
 * Display labels for the 4 legacy types are updated to v2 canon below.
 * Underlying type ids are unchanged.
 */

import type { GuildId, ResourceId } from "./data/types";

export type BuildingType =
  // v1.1 Phase 1 (LIVE)
  | "growTent"
  | "bloomExtractor"
  | "amberForge"
  | "thornTrap"
  // v2 canon (data-only, surfaced per-phase)
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

export interface BuildingDef {
  type: BuildingType;
  name: string;
  description: string;
  imagePath: string;
  color: string;
  /** Footprint on the grid, in cells. */
  size: { w: number; h: number };

  // ─── Sprint 3 economy ───────────────────────────────────────────────
  /** Time in ms for one grow cycle (harvest-cycle buildings). */
  growDurationMs?: number;
  /** Resource yield per harvest at level 1. */
  harvestYield?: number;
  /** Passive resource generation rate at level 1 (per second). */
  firePerSecond?: number;

  // ─── Sprint 4 economy ───────────────────────────────────────────────
  /** Leaf cost to place at level 1. */
  baseCost: number;
  /** Per-building override of the 1.5x cost multiplier. */
  costMultiplier?: number;

  // ─── v2 metadata ────────────────────────────────────────────────────
  /** Phase at which this building becomes placeable in the BuildMenu. */
  phaseAvailable: number;
  /** Resource this building primarily produces (null = no production). */
  producesResource?: ResourceId | null;
  /** Guild affiliation, if any. */
  guildId?: GuildId | null;
  /** Single-instance buildings (Guild Core, etc.) cannot be placed twice. */
  singleton?: boolean;
  /** Defense buildings contribute to base defense score (Phase 7+). */
  isDefense?: boolean;
  /**
   * If true, the image path is a stand-in (typically a triptych sheet from
   * `buildings-library/` or `defenses-library/`) and needs proper isolated
   * art before the building goes live in the BuildMenu.
   */
  placeholderArt?: boolean;
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  // ─── LIVE — v1.1 Phase 1 (display labels updated to v2 canon) ──────
  growTent: {
    type: "growTent",
    name: "Bloom Garden", // v2 canon label (was "Grow Tent")
    description:
      "Cultivates sacred cannabis. Produces Bloom Essence at harvest.",
    imagePath: "/buildings/grow-tent.png",
    color: "#7fb069",
    size: { w: 2, h: 2 },
    growDurationMs: 30_000,
    harvestYield: 25,
    baseCost: 30,
    phaseAvailable: 1,
    producesResource: "bloomEssence",
    guildId: "bloomveil",
  },
  bloomExtractor: {
    type: "bloomExtractor",
    name: "Bloom Extractor",
    description:
      "Multiplies harvest yield from nearby Bloom Gardens.",
    imagePath: "/buildings/bloom-extractor.png",
    color: "#d4a04a",
    size: { w: 2, h: 2 },
    baseCost: 50,
    phaseAvailable: 1,
    producesResource: null,
    guildId: "bloomveil",
  },
  amberForge: {
    type: "amberForge",
    name: "Amber Forge",
    description: "Passively generates Amber Shards over time.",
    imagePath: "/buildings/amber-forge.png",
    color: "#e8964c",
    size: { w: 2, h: 2 },
    firePerSecond: 0.5,
    baseCost: 60,
    phaseAvailable: 1,
    producesResource: "amberShards",
    guildId: "ember",
  },
  thornTrap: {
    type: "thornTrap",
    name: "Root Wall", // v2 canon label (was "Thorn Trap")
    description: "A vigilant defensive plant. Guards the base perimeter.",
    imagePath: "/buildings/thorn-trap.png",
    color: "#a875d4",
    size: { w: 2, h: 2 },
    baseCost: 40,
    phaseAvailable: 1,
    isDefense: true,
    guildId: "thorn",
  },

  // ─── DATA-ONLY — v2 canon, surfaced per-phase ──────────────────────
  guildCore: {
    type: "guildCore",
    name: "Guild Core",
    description:
      "The beating heart of your base. Damaged at game start; repair it to unlock progression. One per base.",
    imagePath: "/buildings-library/soul-altar.png",
    color: "#d4a04a",
    size: { w: 3, h: 3 },
    baseCost: 0, // tutorial grants it; cost is repair tiers
    phaseAvailable: 2,
    singleton: true,
    placeholderArt: true,
  },
  mycoExtractor: {
    type: "mycoExtractor",
    name: "Myco Extractor",
    description: "Cultivates spore strains. Generates Myco Dust passively.",
    imagePath: "/buildings-library/myco-reliquary-sheet.png",
    color: "#a875d4",
    size: { w: 2, h: 2 },
    firePerSecond: 0.3, // shape — actual value tuned in P3
    baseCost: 80,
    phaseAvailable: 3,
    producesResource: "mycoDust",
    guildId: "spores",
    placeholderArt: true,
  },
  storageVault: {
    type: "storageVault",
    name: "Storage Vault",
    description: "Expands resource caps. Stockpile for the long siege.",
    imagePath: "/buildings-library/amber-vault-sheet.png",
    color: "#b8852e",
    size: { w: 2, h: 2 },
    baseCost: 70,
    phaseAvailable: 2,
    placeholderArt: true,
  },
  trainingGrounds: {
    type: "trainingGrounds",
    name: "Training Grounds",
    description: "Trains Growers and units for raids and defense.",
    imagePath: "/buildings-library/training-grounds-sheet.png",
    color: "#d4a04a",
    size: { w: 3, h: 2 },
    baseCost: 100,
    phaseAvailable: 5,
    placeholderArt: true,
  },
  spiritNursery: {
    type: "spiritNursery",
    name: "Spirit Nursery",
    description:
      "Cracks open Spirit Seeds. Unlocks and evolves spirit pets.",
    imagePath: "/buildings-library/seed-reliquary-sheet.png",
    color: "#7fb069",
    size: { w: 2, h: 2 },
    baseCost: 120,
    phaseAvailable: 4,
    placeholderArt: true,
  },
  portalGate: {
    type: "portalGate",
    name: "Portal Gate",
    description:
      "Channels Portal Energy. Unlocks raid map travel and story zones.",
    imagePath: "/buildings-library/obsidian-antichamber-sheet.png",
    color: "#a875d4",
    size: { w: 2, h: 2 },
    baseCost: 150,
    phaseAvailable: 5,
    placeholderArt: true,
  },
  relicWorkshop: {
    type: "relicWorkshop",
    name: "Relic Workshop",
    description: "Crafts gear and relics from Relic Fragments.",
    imagePath: "/buildings-library/bloom-reservoir-sheet.png",
    color: "#8a7d68",
    size: { w: 2, h: 2 },
    baseCost: 100,
    phaseAvailable: 4,
    placeholderArt: true,
  },
  defenseTotem: {
    type: "defenseTotem",
    name: "Defense Totem",
    description: "Generic base-defense structure.",
    imagePath: "/defenses-library/outpost-beacon-sheet.png",
    color: "#6b5a3a",
    size: { w: 2, h: 2 },
    baseCost: 60,
    phaseAvailable: 7,
    isDefense: true,
    placeholderArt: true,
  },
  vineWall: {
    type: "vineWall",
    name: "Vine Wall",
    description: "Bloomveil defensive barrier of living vines.",
    imagePath: "/defenses-library/root-barrier-sheet.png",
    color: "#7fb069",
    size: { w: 2, h: 1 },
    baseCost: 35,
    phaseAvailable: 7,
    isDefense: true,
    guildId: "bloomveil",
    placeholderArt: true,
  },
  sporeTrap: {
    type: "sporeTrap",
    name: "Spore Trap",
    description: "Spores Guild control trap. Hallucinates intruders.",
    imagePath: "/defenses-library/snare-totem-sheet.png",
    color: "#a875d4",
    size: { w: 2, h: 2 },
    baseCost: 55,
    phaseAvailable: 7,
    isDefense: true,
    guildId: "spores",
    placeholderArt: true,
  },
  flameTotem: {
    type: "flameTotem",
    name: "Flame Totem",
    description: "Ember Guild offensive totem. Burns approaching raiders.",
    imagePath: "/defenses-library/doobie-cannon-sheet.png",
    color: "#e8964c",
    size: { w: 2, h: 2 },
    baseCost: 75,
    phaseAvailable: 7,
    isDefense: true,
    guildId: "ember",
    placeholderArt: true,
  },
  waterChannel: {
    type: "waterChannel",
    name: "Water Channel",
    description:
      "Water Guild flow structure. Heals nearby units, slows enemies.",
    imagePath: "/buildings-library/spirit-shrine.png", // placeholder — no water-themed art yet
    color: "#5fa9d4",
    size: { w: 2, h: 1 },
    baseCost: 65,
    phaseAvailable: 8,
    guildId: "water",
    placeholderArt: true,
  },
  rootWall: {
    type: "rootWall",
    name: "Root Wall",
    description:
      "Roots/Thorn Guild defensive wall. Thorny, sentient, grumpy.",
    imagePath: "/defenses-library/root-barrier-sheet.png",
    color: "#6b8e4e",
    size: { w: 2, h: 1 },
    baseCost: 45,
    phaseAvailable: 7,
    isDefense: true,
    guildId: "thorn",
    placeholderArt: true,
  },
};

/**
 * Buildings currently surfaced in the BuildMenu (v1.1 Phase 1 four).
 * BuildMenu code reads this array (not ALL_BUILDING_TYPES) so new types
 * stay invisible until their phase wires them in.
 */
export const BUILDING_TYPES: BuildingType[] = [
  "growTent",
  "bloomExtractor",
  "amberForge",
  "thornTrap",
];

/** Full v2 canon roster, in display order. Used by the v2 GDD / docs / future BuildMenu. */
export const ALL_BUILDING_TYPES: BuildingType[] = [
  // Phase 1
  "growTent",
  "bloomExtractor",
  "amberForge",
  "thornTrap",
  // Phase 2 (Guild Core + storage)
  "guildCore",
  "storageVault",
  // Phase 3 (resources expand)
  "mycoExtractor",
  // Phase 4 (relics + nursery)
  "spiritNursery",
  "relicWorkshop",
  // Phase 5 (training + portal)
  "trainingGrounds",
  "portalGate",
  // Phase 7+ (defense layer)
  "defenseTotem",
  "vineWall",
  "sporeTrap",
  "flameTotem",
  "rootWall",
  // Phase 8 (guild expansion)
  "waterChannel",
];

/** Grid size — single source of truth. */
export const GRID_COLS = 16;
export const GRID_ROWS = 16;
