/**
 * Spirit pets — canon companions paired with characters.
 *
 * Phase 1 data shape only. Bond levels / abilities are placeholder fields
 * — the Spirit Nursery system (v2 Phase 4) will implement actual mechanics
 * that read these defs.
 */

import type { ArtPath, ElementId } from "./types";

export type PetSpecies =
  | "vineSpirit"
  | "waterDragon"
  | "ghostFox"
  | "hawk"
  | "beetle"
  | "fireFox"
  | "wolf";

export interface PetAbility {
  id: string;
  name: string;
  description: string;
  /** "passive" auto-effect or "active" triggered ability. */
  kind: "passive" | "active";
}

export interface SpiritPetDef {
  id: string;
  name: string;
  species: PetSpecies;
  element: ElementId;
  /** Owner character id, or null for unbonded / shop pets. */
  ownerCharacterId: string | null;
  /** Free-form vibe / look. */
  appearance: string;
  /** Max bond level — caps the pet's stat scaling. */
  maxBondLevel: number;
  /** Hook abilities — actual implementations land in Phase 4. */
  abilities: PetAbility[];
  artPath: ArtPath;
  /** Phase at which this pet is obtainable. */
  phaseAvailable: number;
}

export const SPIRIT_PETS: Record<string, SpiritPetDef> = {
  solace: {
    id: "solace",
    name: "Solace",
    species: "vineSpirit",
    element: "bloom",
    ownerCharacterId: "anderz",
    appearance:
      "Floating vine/spirit/cannabis-plant hybrid. Cluster of leaves and gold with three pollen-yellow eyes.",
    maxBondLevel: 10,
    abilities: [
      {
        id: "bloomBond",
        name: "Bloom Bond",
        description: "Passive +N% Bloom Essence yield from owner's harvests.",
        kind: "passive",
      },
      {
        id: "verbalShield",
        name: "Verbal Shield",
        description:
          "Active: deflects one Corruption-spirit attack with a withering one-liner.",
        kind: "active",
      },
    ],
    artPath: null,
    phaseAvailable: 3,
  },
  vyrra: {
    id: "vyrra",
    name: "Vyrra",
    species: "waterDragon",
    element: "water",
    ownerCharacterId: "raiin",
    appearance: "Sinuous water dragon. Crystalline scales.",
    maxBondLevel: 10,
    abilities: [
      {
        id: "tidalSurge",
        name: "Tidal Surge",
        description: "Active: AoE water knockback.",
        kind: "active",
      },
    ],
    artPath: null,
    phaseAvailable: 4,
  },
  fumez: {
    id: "fumez",
    name: "Fumez",
    species: "ghostFox",
    element: "spore",
    ownerCharacterId: "davis",
    appearance: "Glowing blue ghost fox. Translucent, lambent.",
    maxBondLevel: 10,
    abilities: [
      {
        id: "phaseStep",
        name: "Phase Step",
        description: "Active: short teleport, leaves spore trail.",
        kind: "active",
      },
    ],
    artPath: null,
    phaseAvailable: 5,
  },
  wingus: {
    id: "wingus",
    name: "Wingus",
    species: "hawk",
    element: "dust",
    ownerCharacterId: "art",
    appearance: "Hawk spirit. Wind-marked plumage.",
    maxBondLevel: 10,
    abilities: [
      {
        id: "scout",
        name: "Scout",
        description: "Passive: reveals adjacent raid map nodes earlier.",
        kind: "passive",
      },
    ],
    artPath: null,
    phaseAvailable: 5,
  },
  berle: {
    id: "berle",
    name: "Berle",
    species: "beetle",
    element: "dust",
    ownerCharacterId: "brazzle",
    appearance: "Mysterious beetle companion. Iridescent carapace.",
    maxBondLevel: 10,
    abilities: [
      {
        id: "relicSniff",
        name: "Relic Sniff",
        description: "Passive: +N% Relic Fragment drop rate.",
        kind: "passive",
      },
    ],
    artPath: null,
    phaseAvailable: 4,
  },
  "ashira-firefox": {
    id: "ashira-firefox",
    name: "Ashira's Fire-Fox",
    species: "fireFox",
    element: "fire",
    ownerCharacterId: "ashira",
    appearance: "Fire-fox. Smoldering paws and crowned flame.",
    maxBondLevel: 10,
    abilities: [
      {
        id: "blazeRush",
        name: "Blaze Rush",
        description: "Active: fast line dash, leaves burning ground.",
        kind: "active",
      },
    ],
    artPath: null,
    phaseAvailable: 4,
  },
  "armando-wolf": {
    id: "armando-wolf",
    name: "Armando's Wolf",
    species: "wolf",
    element: "thorn",
    ownerCharacterId: "armando",
    appearance: "Dark canine/wolf spirit with green glowing markings.",
    maxBondLevel: 10,
    abilities: [
      {
        id: "packGuard",
        name: "Pack Guard",
        description: "Passive: nearby units take less damage.",
        kind: "passive",
      },
    ],
    artPath: null,
    phaseAvailable: 6,
  },
};

export const SPIRIT_PET_ORDER: string[] = [
  "solace",
  "vyrra",
  "fumez",
  "wingus",
  "berle",
  "ashira-firefox",
  "armando-wolf",
];
