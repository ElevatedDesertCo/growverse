/**
 * Canon roster — main characters, guild leaders, supporting cast, antagonists.
 * Spirit pet pairings are referenced by `spiritPetId` (see lib/data/spiritPets.ts).
 *
 * Voice/tone tags are used by future writers (Phase 9 dialogue work) to
 * stay in canon. See docs/growverse-gdd-v2.md for sample lines.
 */

import type { ArtPath, GuildId } from "./types";

export type CharacterRole =
  | "protagonist"
  | "companion"
  | "rival"
  | "side"
  | "guildLeader"
  | "support"
  | "antagonist";

export interface CharacterDef {
  id: string;
  name: string;
  role: CharacterRole;
  /** Free-form physical / vibe description for art briefing. */
  appearance: string;
  /** Tone descriptors for dialogue writing. */
  voiceTags: string[];
  /** Spirit-pet id paired to this character, if any. */
  spiritPetId: string | null;
  /** Guild affiliation, if any. */
  guildId: GuildId | null;
  /** Portrait art path under public/, or null if pending. */
  portraitPath: ArtPath;
  /** Phase at which this character unlocks in gameplay. */
  phaseAvailable: number;
}

export const CHARACTERS: Record<string, CharacterDef> = {
  // ─── Main ────────────────────────────────────────────────────────
  anderz: {
    id: "anderz",
    name: "Anderz",
    role: "protagonist",
    appearance:
      "The Grower the player embodies. Specific look TBD by player customization later.",
    voiceTags: ["earnest", "deadpan", "self-deprecating", "willing"],
    spiritPetId: "solace",
    guildId: "bloomveil",
    portraitPath: null,
    phaseAvailable: 3,
  },
  solace: {
    id: "solace",
    name: "Solace",
    role: "companion",
    appearance:
      "Floating vine/spirit/cannabis-plant hybrid. Cluster of leaves and gold with three pollen-yellow eyes. NOT a fox.",
    voiceTags: ["dry", "sarcastic", "motherly", "exhausted-by-your-decisions"],
    spiritPetId: null, // Solace IS a spirit pet, not paired with one
    guildId: "bloomveil",
    portraitPath: null,
    phaseAvailable: 3,
  },
  raiin: {
    id: "raiin",
    name: "Raiin",
    role: "rival",
    appearance: "TBD",
    voiceTags: ["roaster", "sharp", "guarded", "thaws-into-flirt"],
    spiritPetId: "vyrra",
    guildId: "water",
    portraitPath: null,
    phaseAvailable: 4,
  },
  davis: {
    id: "davis",
    name: "Davis",
    role: "side",
    appearance: "Tall, skinny.",
    voiceTags: ["sidekick", "chill"],
    spiritPetId: "fumez",
    guildId: null,
    portraitPath: null,
    phaseAvailable: 5,
  },

  // ─── Guild Leaders ───────────────────────────────────────────────
  elyra: {
    id: "elyra",
    name: "Elyra",
    role: "guildLeader",
    appearance: "TBD — Bloomveil Guild Leader. Verdant, regal.",
    voiceTags: ["matriarchal", "calm", "knowing"],
    spiritPetId: null,
    guildId: "bloomveil",
    portraitPath: null,
    phaseAvailable: 4,
  },
  ashira: {
    id: "ashira",
    name: "Ashira",
    role: "guildLeader",
    appearance:
      "The Blaze Binder. Ember Guild Leader. Heat-warped armor, glowing forge marks.",
    voiceTags: ["fierce", "passionate", "warm-then-hot"],
    spiritPetId: "ashira-firefox",
    guildId: "ember",
    portraitPath: null,
    phaseAvailable: 4,
  },
  myco: {
    id: "myco",
    name: "Myco",
    role: "guildLeader",
    appearance: "Spores Guild Leader. Mushroom-mantled, drifting spores.",
    voiceTags: ["cryptic", "hallucinatory", "amused"],
    spiritPetId: null,
    guildId: "spores",
    portraitPath: null,
    phaseAvailable: 4,
  },
  zira: {
    id: "zira",
    name: "Zira",
    role: "guildLeader",
    appearance: "Roots/Thorn Guild Leader. Bark-armored, vine-bound.",
    voiceTags: ["stoic", "stern", "loyal"],
    spiritPetId: null,
    guildId: "thorn",
    portraitPath: null,
    phaseAvailable: 4,
  },
  athir: {
    id: "athir",
    name: "Athir",
    role: "guildLeader",
    appearance:
      "The Dustwarden. Formerly the Spirit Cartographer. Map-cloaked, weathered, eyes that have seen too many portals.",
    voiceTags: ["weary", "elegiac", "wise"],
    spiritPetId: null,
    guildId: "dustroot",
    portraitPath: null,
    phaseAvailable: 4,
  },
  // Legendary mentor — Phase 8 unlockable
  elderThorn: {
    id: "elderThorn",
    name: "Elder Thorn",
    role: "guildLeader",
    appearance: "Legendary mentor of the Thorn Guild. Also known as Master Thorn.",
    voiceTags: ["mythic", "patient", "rooted"],
    spiritPetId: null,
    guildId: "thorn",
    portraitPath: null,
    phaseAvailable: 8,
  },

  // ─── Supporting ──────────────────────────────────────────────────
  art: {
    id: "art",
    name: "Art",
    role: "support",
    appearance: "TBD.",
    voiceTags: ["calm", "observant"],
    spiritPetId: "wingus",
    guildId: null,
    portraitPath: null,
    phaseAvailable: 5,
  },
  brazzle: {
    id: "brazzle",
    name: "Brazzle",
    role: "support",
    appearance: "Larger, light-skinned, bearded relic forager.",
    voiceTags: ["gruff", "merchant-ish", "tells-too-many-stories"],
    spiritPetId: "berle",
    guildId: "dustroot",
    portraitPath: null,
    phaseAvailable: 4,
  },
  nicole: {
    id: "nicole",
    name: "Nicole",
    role: "support",
    appearance:
      "Tech Wizard. Long hair, Mexican-toned skin, flower tattoos, carries a laptop. Owns Nicole's Tech Lab.",
    voiceTags: ["fast", "tech-fluent", "sardonic", "kind"],
    spiritPetId: null,
    guildId: null,
    portraitPath: null,
    phaseAvailable: 6,
  },
  armando: {
    id: "armando",
    name: "Armando",
    role: "support",
    appearance:
      "Heavyset Mexican man, baseball cap and jersey, jeans, relic necklace, carries a bat.",
    voiceTags: ["bluff", "loyal", "tough"],
    spiritPetId: "armando-wolf",
    guildId: null,
    portraitPath: null,
    phaseAvailable: 6,
  },
  carlito: {
    id: "carlito",
    name: "Carlito",
    role: "support",
    appearance: "Information broker. TBD specifics.",
    voiceTags: ["dry", "transactional", "darkly-funny"],
    spiritPetId: null,
    guildId: null,
    portraitPath: null,
    phaseAvailable: 7,
  },

  // ─── Antagonists ─────────────────────────────────────────────────
  eris: {
    id: "eris",
    name: "Eris",
    role: "antagonist",
    appearance: "The Corrupted Spirit Weaver. Strands and shadow.",
    voiceTags: ["measured", "patient", "venomous"],
    spiritPetId: null,
    guildId: null,
    portraitPath: null,
    phaseAvailable: 3, // First foreshadowed in Chapter 1 cinematic
  },
};

/** Stable display order. */
export const CHARACTER_ORDER: string[] = [
  "anderz",
  "solace",
  "raiin",
  "davis",
  "elyra",
  "ashira",
  "myco",
  "zira",
  "athir",
  "elderThorn",
  "art",
  "brazzle",
  "nicole",
  "armando",
  "carlito",
  "eris",
];
