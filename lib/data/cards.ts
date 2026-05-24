/**
 * TCG card schema — Phase 6 system.
 *
 * Categories taken from canon (GDD v2): Growers, Spirit Pets, Abilities,
 * Relics, Terrain, Guild Blessings, Strains, Pure Art Collector Cards.
 *
 * Schema only in v2 Phase 1. Card catalog ships with the booster pack
 * MVP in Phase 6.
 */

import type { ArtPath, CardCategory, GuildId, Rarity } from "./types";

export interface CardDef {
  id: string;
  name: string;
  category: CardCategory;
  rarity: Rarity;
  guildId: GuildId | null;
  /** Flavor text — write in canon voice (see GDD v2 tone samples). */
  flavor: string;
  /** Reference id into the relevant data module:
   *  - "grower" → CHARACTERS id
   *  - "spiritPet" → SPIRIT_PETS id
   *  - "ability" / "relic" / "strain" / "terrain" / "guildBlessing" / "pureArt"
   *    → free-form (no cross-module reference yet)
   */
  referenceId: string | null;
  artPath: ArtPath;
  phaseAvailable: number;
}

export const CARDS: Record<string, CardDef> = {};

export const CARD_ORDER: string[] = [];

export const CARD_CATEGORY_LABELS: Record<CardCategory, string> = {
  grower: "Grower",
  spiritPet: "Spirit Pet",
  ability: "Ability",
  relic: "Relic",
  terrain: "Terrain",
  guildBlessing: "Guild Blessing",
  strain: "Strain",
  pureArt: "Pure Art",
};
