/**
 * Shared base types for v2 data modules.
 * Pure types — no runtime values, no imports from other data modules.
 *
 * Naming convention: every domain entity has an `id` (kebab-case stable
 * identifier — used as save key) and a `name` (display string).
 *
 * Save-compat note: ids in data modules are stable forever. Renames must
 * happen via display-name only.
 */

// ─── Domain identifiers ────────────────────────────────────────────
export type GuildId =
  | "bloomveil"
  | "ember"
  | "water"
  | "spores"
  | "thorn"
  | "dustroot";

export type ElementId =
  | "bloom"
  | "fire"
  | "water"
  | "spore"
  | "thorn"
  | "dust";

export type ResourceId =
  | "bloomEssence"
  | "amberShards"
  | "mycoDust"
  | "relicFragments"
  | "spiritSeeds"
  | "portalEnergy"
  | "guildXp"
  | "cardShards";

export type CardCategory =
  | "grower"
  | "spiritPet"
  | "ability"
  | "relic"
  | "terrain"
  | "guildBlessing"
  | "strain"
  | "pureArt";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

// ─── Asset references ──────────────────────────────────────────────
/** Path under `public/` to a PNG, or `null` for placeholder. */
export type ArtPath = string | null;

// ─── Stat scaling shape (reused by buildings, units, pets, cards) ──
export interface TieredStat {
  /** Base value at level 1. */
  base: number;
  /** Per-level multiplier (defaults to 1.5 to match v1.1 cost curve). */
  multiplier?: number;
}

// ─── Resource bundles ──────────────────────────────────────────────
/** A partial bag of resources — used for costs, rewards, requirements. */
export type ResourceBag = Partial<Record<ResourceId, number>>;

// ─── Common record shapes ──────────────────────────────────────────
export interface NamedRecord {
  id: string;
  name: string;
  description: string;
}
