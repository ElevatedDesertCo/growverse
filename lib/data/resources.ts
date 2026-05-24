/**
 * The 8 canonical resources of Growverse: Guild Wars.
 *
 * Data-only — no store wiring. The runtime `Resources` interface in
 * lib/store.ts currently uses v1.1 short field names (`leaf`/`fire`/`mushroom`)
 * for save-compat. The `legacyField` mapping below is the bridge: when a
 * v2 component wants to display "Bloom Essence", it looks up the canon
 * record here and reads the value off of `store.resources[def.legacyField!]`.
 *
 * Resources without `legacyField` are not yet stored — their UI ships
 * alongside the system that grants them in a later phase.
 */

import type { ResourceId } from "./types";

export interface ResourceDef {
  id: ResourceId;
  /** Canon display name. */
  name: string;
  /** Display blurb. */
  description: string;
  /** Lucide-style icon path under public/icons/, or null until art ships. */
  iconPath: string | null;
  /** Hex color for tinting numbers + badges. */
  color: string;
  /** One-line "earned from" hook. */
  earnedFrom: string;
  /** Bulleted "used for" list. */
  uses: string[];
  /** v1.1 store field name if this resource is currently persisted there. */
  legacyField?: "leaf" | "fire" | "mushroom";
  /** Phase number this resource lands as a real interactive currency. */
  phaseAvailable: number;
}

export const RESOURCES: Record<ResourceId, ResourceDef> = {
  bloomEssence: {
    id: "bloomEssence",
    name: "Bloom Essence",
    description: "Sacred plant lifeforce. The foundation currency.",
    iconPath: "/icons/leaf.png",
    color: "#7fb069",
    earnedFrom:
      "Bloomveil buildings (was: Grow Tent harvest), corrupted-camp raids, Bloomveil quests",
    uses: [
      "Bloomveil upgrades",
      "Healing buildings",
      "Spirit pet bonding",
      "Vine defenses",
      "Basic base upgrades",
    ],
    legacyField: "leaf",
    phaseAvailable: 1,
  },
  amberShards: {
    id: "amberShards",
    name: "Amber Shards",
    description: "Fiery crystalline shards of distilled cannabis resin.",
    iconPath: "/icons/fire.png",
    color: "#e8964c",
    earnedFrom: "Amber Forge passive, Ember-zone raids",
    uses: [
      "Ember upgrades",
      "Weapon upgrades",
      "Attack buildings",
      "Forge buildings",
      "Damage units",
    ],
    legacyField: "fire",
    phaseAvailable: 1,
  },
  mycoDust: {
    id: "mycoDust",
    name: "Myco Dust",
    description: "Iridescent spore powder. Trippy, dangerous, lucrative.",
    iconPath: "/icons/mushroom.png",
    color: "#a875d4",
    earnedFrom: "Spores-zone raids, Myco Reliquary buildings",
    uses: [
      "Spores upgrades",
      "Poison abilities",
      "Hallucination traps",
      "Fungal units",
      "Control buildings",
    ],
    legacyField: "mushroom",
    phaseAvailable: 1,
  },
  relicFragments: {
    id: "relicFragments",
    name: "Relic Fragments",
    description: "Shards of pre-Corruption tech and lore. Brazzle's bread and butter.",
    iconPath: null,
    color: "#8a7d68",
    earnedFrom: "Brazzle's foraging quests, ruined-portal raids",
    uses: [
      "Ancient tech",
      "Portal upgrades",
      "Rare building upgrades",
      "Unlocking lore",
      "Special character upgrades",
    ],
    phaseAvailable: 4,
  },
  spiritSeeds: {
    id: "spiritSeeds",
    name: "Spirit Seeds",
    description: "Dormant pet essence. Cracks open in the Spirit Nursery.",
    iconPath: null,
    color: "#7fb069",
    earnedFrom: "Spirit Nursery, story chapter rewards",
    uses: [
      "Unlocking spirit pets",
      "Evolving spirit pets",
      "Spirit Nursery upgrades",
      "Pet bonding",
    ],
    phaseAvailable: 4,
  },
  portalEnergy: {
    id: "portalEnergy",
    name: "Portal Energy",
    description: "Charge for crossing into portals. Regenerates over time.",
    iconPath: null,
    color: "#a875d4",
    earnedFrom: "Time-gated regeneration, Guild contributions",
    uses: [
      "Unlocking new zones",
      "Story chapter gates",
      "Event portals",
      "Raid map travel",
    ],
    phaseAvailable: 4,
  },
  guildXp: {
    id: "guildXp",
    name: "Guild XP",
    description: "Reputation among Growers. Unlocks tiers and perks.",
    iconPath: null,
    color: "#d4a04a",
    earnedFrom: "Cooperative raids, Guild Wars participation",
    uses: [
      "Player level",
      "Guild level",
      "Unlocking features",
      "Progression milestones",
    ],
    phaseAvailable: 5,
  },
  cardShards: {
    id: "cardShards",
    name: "Card Shards",
    description: "Crafting matter from duplicate booster pulls.",
    iconPath: null,
    color: "#d4a04a",
    earnedFrom: "Booster pack duplicates, Achievement Wall",
    uses: [
      "Crafting cards",
      "Upgrading digital cards",
      "Unlocking booster rewards",
    ],
    phaseAvailable: 5,
  },
};

/** Stable ordered list for iterating (matches GDD v2 resource table order). */
export const RESOURCE_ORDER: ResourceId[] = [
  "bloomEssence",
  "amberShards",
  "mycoDust",
  "relicFragments",
  "spiritSeeds",
  "portalEnergy",
  "guildXp",
  "cardShards",
];
