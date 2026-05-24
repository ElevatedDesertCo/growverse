/**
 * Asset manifest — single source of truth for every game asset path.
 *
 * Components NEVER hardcode `/icons/leaf.png` etc. Instead they call
 * `getAsset("resource.bloomEssence")` (or use `<AssetImage assetId=...>`).
 * This means we can:
 *   - Move assets to new folders without component edits
 *   - Mark assets as placeholder / generated / final and render fallback
 *     UI when no file exists
 *   - Track migration status in one place (see docs/AssetChecklist.md)
 *
 * The canonical home for NEW assets is `public/assets/{images,audio,
 * animations}/<category>/<id>.<ext>`. Existing v1.1 assets stay where
 * they are (under `/icons/`, `/buildings/`, `/brand/`) and their manifest
 * entries point to those legacy paths. Migration is a separate task —
 * components don't care, they just read the manifest.
 */

export type AssetStatus = "placeholder" | "generated" | "final";

export interface AssetEntry {
  /** Public path served by Next.js (under `/`). May or may not exist on disk. */
  path: string;
  /**
   * placeholder = file does not exist; <AssetImage> renders styled fallback.
   * generated  = file exists but is a stand-in (e.g. triptych sheet repurposed).
   * final      = approved final art.
   */
  status: AssetStatus;
  /** Short human-readable note (e.g. "cropped from concept sheet"). */
  notes?: string;
}

// ─── Building art (icons + tiles) ───────────────────────────────────
export const BUILDING_ASSETS = {
  guildCore: {
    path: "/buildings-library/soul-altar.png",
    status: "generated",
    notes: "Stand-in: Soul Altar triptych. Needs isolated Core PNG.",
  },
  bloomExtractor: {
    path: "/buildings/bloom-extractor.png",
    status: "final",
  },
  storageVault: {
    path: "/buildings-library/amber-vault-sheet.png",
    status: "generated",
    notes: "Stand-in: Amber Vault triptych. Needs isolated Vault PNG.",
  },
  trainingGrounds: {
    path: "/buildings-library/training-grounds-sheet.png",
    status: "generated",
    notes: "Stand-in: triptych sheet.",
  },
  spiritNursery: {
    path: "/buildings-library/seed-reliquary-sheet.png",
    status: "generated",
    notes: "Stand-in: Seed Reliquary triptych.",
  },
  portalGate: {
    path: "/buildings-library/obsidian-antichamber-sheet.png",
    status: "generated",
    notes: "Stand-in: Obsidian Antichamber triptych.",
  },
  relicWorkshop: {
    path: "/buildings-library/bloom-reservoir-sheet.png",
    status: "generated",
    notes: "Stand-in: Bloom Reservoir triptych.",
  },
  defenseTotem: {
    path: "/defenses-library/outpost-beacon-sheet.png",
    status: "generated",
  },
  vineWall: {
    path: "/defenses-library/root-barrier-sheet.png",
    status: "generated",
  },
  sporeTrap: {
    path: "/defenses-library/snare-totem-sheet.png",
    status: "generated",
  },
  flameTotem: {
    path: "/defenses-library/doobie-cannon-sheet.png",
    status: "generated",
  },
  waterChannel: {
    path: "/buildings-library/spirit-shrine.png",
    status: "generated",
    notes: "Temporary stand-in — no water-themed art exists yet.",
  },
  rootWall: {
    path: "/defenses-library/root-barrier-sheet.png",
    status: "generated",
  },
  mycoExtractor: {
    path: "/buildings-library/myco-reliquary-sheet.png",
    status: "generated",
  },
  // Legacy v1.1 buildings (still in old saves)
  growTent: { path: "/buildings/grow-tent.png", status: "final" as const },
  amberForge: { path: "/buildings/amber-forge.png", status: "final" as const },
  thornTrap: { path: "/buildings/thorn-trap.png", status: "final" as const },
} satisfies Record<string, AssetEntry>;

// ─── Resource icons ─────────────────────────────────────────────────
export const RESOURCE_ASSETS = {
  bloomEssence: { path: "/icons/leaf.png", status: "final" as const },
  amberShards: { path: "/icons/fire.png", status: "final" as const },
  mycoDust: { path: "/icons/mushroom.png", status: "final" as const },
  relicFragments: {
    path: "/assets/images/resources/relic-fragments.png",
    status: "placeholder",
    notes: "No art yet. Manifest path reserves the canonical home.",
  },
  spiritSeeds: {
    path: "/assets/images/resources/spirit-seeds.png",
    status: "placeholder",
  },
  portalEnergy: {
    path: "/assets/images/resources/portal-energy.png",
    status: "placeholder",
  },
  guildXp: {
    path: "/assets/images/resources/guild-xp.png",
    status: "placeholder",
  },
  cardShards: {
    path: "/assets/images/resources/card-shards.png",
    status: "placeholder",
  },
} satisfies Record<string, AssetEntry>;

// ─── Guild badges ───────────────────────────────────────────────────
export const GUILD_ASSETS = {
  bloomveil: {
    path: "/assets/images/guild-icons/bloomveil.png",
    status: "placeholder",
  },
  ember: { path: "/assets/images/guild-icons/ember.png", status: "placeholder" },
  water: { path: "/assets/images/guild-icons/water.png", status: "placeholder" },
  spores: {
    path: "/assets/images/guild-icons/spores.png",
    status: "placeholder",
  },
  thorn: { path: "/assets/images/guild-icons/thorn.png", status: "placeholder" },
  dustroot: {
    path: "/assets/images/guild-icons/dustroot.png",
    status: "placeholder",
  },
} satisfies Record<string, AssetEntry>;

// ─── Character portraits ────────────────────────────────────────────
export const CHARACTER_ASSETS = {
  anderz: {
    path: "/assets/images/characters/anderz.png",
    status: "placeholder",
  },
  solace: {
    path: "/assets/images/characters/solace.png",
    status: "placeholder",
  },
  raiin: {
    path: "/assets/images/characters/raiin.png",
    status: "placeholder",
  },
  davis: { path: "/assets/images/characters/davis.png", status: "placeholder" },
  elyra: { path: "/assets/images/characters/elyra.png", status: "placeholder" },
  ashira: {
    path: "/assets/images/characters/ashira.png",
    status: "placeholder",
  },
  myco: { path: "/assets/images/characters/myco.png", status: "placeholder" },
  zira: { path: "/assets/images/characters/zira.png", status: "placeholder" },
  athir: { path: "/assets/images/characters/athir.png", status: "placeholder" },
  art: { path: "/assets/images/characters/art.png", status: "placeholder" },
  brazzle: {
    path: "/assets/images/characters/brazzle.png",
    status: "placeholder",
  },
  nicole: {
    path: "/assets/images/characters/nicole.png",
    status: "placeholder",
  },
  armando: {
    path: "/assets/images/characters/armando.png",
    status: "placeholder",
  },
  carlito: {
    path: "/assets/images/characters/carlito.png",
    status: "placeholder",
  },
  eris: { path: "/assets/images/characters/eris.png", status: "placeholder" },
  elderThorn: {
    path: "/assets/images/characters/elder-thorn.png",
    status: "placeholder",
  },
} satisfies Record<string, AssetEntry>;

// ─── Spirit pet art ─────────────────────────────────────────────────
export const SPIRIT_PET_ASSETS = {
  solace: {
    path: "/assets/images/spirit-pets/solace.png",
    status: "placeholder",
  },
  vyrra: {
    path: "/assets/images/spirit-pets/vyrra.png",
    status: "placeholder",
  },
  fumez: {
    path: "/assets/images/spirit-pets/fumez.png",
    status: "placeholder",
  },
  wingus: {
    path: "/assets/images/spirit-pets/wingus.png",
    status: "placeholder",
  },
  berle: {
    path: "/assets/images/spirit-pets/berle.png",
    status: "placeholder",
  },
  "ashira-firefox": {
    path: "/assets/images/spirit-pets/ashira-firefox.png",
    status: "placeholder",
  },
  "armando-wolf": {
    path: "/assets/images/spirit-pets/armando-wolf.png",
    status: "placeholder",
  },
} satisfies Record<string, AssetEntry>;

// ─── Brand / backgrounds ────────────────────────────────────────────
export const BACKGROUND_ASSETS = {
  splash: {
    path: "/brand/growverse-splash.png",
    status: "final" as const,
  },
  baseAmbient: {
    path: "/assets/images/backgrounds/base-ambient.png",
    status: "placeholder",
    notes: "Soft cosmic-desert backdrop for the Guild Base view (under the grid).",
  },
} satisfies Record<string, AssetEntry>;

// ─── UI assets (frames, button skins, drawer chrome) ────────────────
export const UI_ASSETS = {
  resourceBarFrame: {
    path: "/ui/resource-bar-frame.png",
    status: "generated",
  },
  resourceBarFrameVariants: {
    path: "/ui/resource-bar-frame-variants.png",
    status: "generated",
  },
  primaryButtonSet: {
    path: "/ui/primary-button-set.png",
    status: "generated",
  },
  primaryButtonSetLeaf: {
    path: "/ui/primary-button-set-leaf.png",
    status: "generated",
  },
  panelFrameSet: { path: "/ui/panel-frame-set.png", status: "generated" },
  heroCardFrame: { path: "/ui/hero-card-frame.png", status: "generated" },
  heroCardFrameSheet: {
    path: "/ui/hero-card-frame-sheet.png",
    status: "generated",
  },
  petCardFrame: { path: "/ui/pet-card-frame.png", status: "generated" },
  petCardFrameSheet: {
    path: "/ui/pet-card-frame-sheet.png",
    status: "generated",
  },
  deploySlotFrame: { path: "/ui/deploy-slot-frame.png", status: "generated" },
  questBoard: { path: "/ui/quest-board.png", status: "generated" },
  bountyBoard: { path: "/ui/bounty-board.png", status: "generated" },
} satisfies Record<string, AssetEntry>;

// ─── VFX (sprite sheets, particle textures) ─────────────────────────
export const VFX_ASSETS = {
  emberStrike: {
    path: "/effects/ember-strike-sheet.png",
    status: "generated",
  },
  waterBurst: { path: "/effects/water-burst-sheet.png", status: "generated" },
  dustHit: { path: "/effects/dust-hit-sheet.png", status: "generated" },
  spellsSet: { path: "/effects/spells-set.png", status: "generated" },
  effectsSet: { path: "/effects/effects-set.png", status: "generated" },
  collectBurst: {
    path: "/assets/images/vfx/collect-burst.png",
    status: "placeholder",
    notes: "Particle sprite for resource collect — currently rendered via CSS.",
  },
  placementDust: {
    path: "/assets/images/vfx/placement-dust.png",
    status: "placeholder",
  },
  upgradeGlow: {
    path: "/assets/images/vfx/upgrade-glow.png",
    status: "placeholder",
  },
} satisfies Record<string, AssetEntry>;

// ─── Audio ──────────────────────────────────────────────────────────
// All placeholder until SFX/music drop. The audioSystem swallows
// missing-file errors silently — game functions identically with no audio.
export const SFX_ASSETS = {
  buttonClick: {
    path: "/assets/audio/sfx/button-click.mp3",
    status: "placeholder",
  },
  resourceCollect: {
    path: "/assets/audio/sfx/resource-collect.mp3",
    status: "placeholder",
  },
  buildPlaced: {
    path: "/assets/audio/sfx/build-placed.mp3",
    status: "placeholder",
  },
  upgradeComplete: {
    path: "/assets/audio/sfx/upgrade-complete.mp3",
    status: "placeholder",
  },
  locked: {
    path: "/assets/audio/sfx/locked.mp3",
    status: "placeholder",
  },
} satisfies Record<string, AssetEntry>;

export const MUSIC_ASSETS = {
  baseAmbient: {
    path: "/assets/audio/music/base-ambient.mp3",
    status: "placeholder",
    notes: "Loopable cosmic-desert pad for the Guild Base view.",
  },
} satisfies Record<string, AssetEntry>;

// ─── Unified access ─────────────────────────────────────────────────
// Wide accessor: assets("building.guildCore") → AssetEntry. Reads from
// the section maps above. Returns null if the section/id is unknown so
// callers can decide whether to render a placeholder.

export type AssetCategory =
  | "building"
  | "resource"
  | "guild"
  | "character"
  | "spiritPet"
  | "background"
  | "ui"
  | "vfx"
  | "sfx"
  | "music";

const SECTIONS: Record<AssetCategory, Record<string, AssetEntry>> = {
  building: BUILDING_ASSETS,
  resource: RESOURCE_ASSETS,
  guild: GUILD_ASSETS,
  character: CHARACTER_ASSETS,
  spiritPet: SPIRIT_PET_ASSETS,
  background: BACKGROUND_ASSETS,
  ui: UI_ASSETS,
  vfx: VFX_ASSETS,
  sfx: SFX_ASSETS,
  music: MUSIC_ASSETS,
};

/** Look up an asset by "category.id" string. Returns null if unknown. */
export function getAsset(ref: string): AssetEntry | null {
  const [category, id] = ref.split(".") as [AssetCategory, string];
  const section = SECTIONS[category];
  if (!section || !id) return null;
  return section[id] ?? null;
}

/** True if the asset has a real file on disk (generated or final). */
export function hasRealAsset(ref: string): boolean {
  const entry = getAsset(ref);
  return !!entry && entry.status !== "placeholder";
}

/** Resolve a ref to its public path, or null if placeholder/missing. */
export function getAssetPath(ref: string): string | null {
  const entry = getAsset(ref);
  if (!entry) return null;
  if (entry.status === "placeholder") return null;
  return entry.path;
}
