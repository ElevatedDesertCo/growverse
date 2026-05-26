/**
 * The 6 canonical guilds of Growverse: Guild Wars.
 * Each guild has an element, an element theme, a leader character id
 * (resolved against lib/data/characters.ts), and a primary spirit pet
 * archetype.
 */

import type { ElementId, GuildId } from "./types";

export interface GuildDef {
  id: GuildId;
  /** Display name without the "Guild" suffix unless it's part of the name. */
  name: string;
  /** Element / theme. */
  element: ElementId;
  /** One-liner theme description. */
  theme: string;
  /** Long-form pitch. */
  description: string;
  /** Leader character id (must exist in CHARACTERS). null if TBD. */
  leaderCharacterId: string | null;
  /** Hex color used for guild badges + UI tinting. */
  color: string;
  /** Phase this guild lights up as a real playable affiliation. */
  phaseAvailable: number;
}

export const GUILDS: Record<GuildId, GuildDef> = {
  bloomveil: {
    id: "bloomveil",
    name: "Bloomveil Guild",
    element: "bloom",
    theme: "Plant / Bloom energy, healing, growth",
    description:
      "The original cultivators. Keepers of Bloom Energy and the sacred Grow. Connected to Anderz and Solace.",
    leaderCharacterId: "elyra",
    color: "#7fb069",
    phaseAvailable: 1,
  },
  ember: {
    id: "ember",
    name: "Ember Guild",
    element: "fire",
    theme: "Fire / forge / aggression",
    description:
      "Smelters and burners. Ashira the Blaze Binder shapes Amber Shards into weapons of light.",
    leaderCharacterId: "ashira",
    color: "#e8964c",
    phaseAvailable: 2,
  },
  water: {
    id: "water",
    name: "Water Guild",
    element: "water",
    theme: "Water / flow / healing",
    description:
      "Channelers of currents and tides in a world that forgot the sea. Connected to Raiin and Vyrra.",
    leaderCharacterId: null,
    color: "#5fa9d4",
    phaseAvailable: 3,
  },
  spores: {
    id: "spores",
    name: "Spores Guild",
    element: "spore",
    theme: "Mushrooms / spores / hallucinations",
    description:
      "Fungal mystics. Myco's growers cultivate trip caps and weaponized mycelium.",
    leaderCharacterId: "myco",
    color: "#a875d4",
    phaseAvailable: 3,
  },
  thorn: {
    id: "thorn",
    name: "Roots / Thorn Guild",
    element: "thorn",
    theme: "Roots / thorns / defense",
    description:
      "Walls and barbs. Zira leads under the legacy of Elder Thorn (a.k.a. Master Thorn), a legendary defensive mentor whose vine still grows.",
    leaderCharacterId: "zira",
    color: "#6b8e4e",
    phaseAvailable: 4,
  },
  dustroot: {
    id: "dustroot",
    name: "Dustroot Archive",
    element: "dust",
    theme: "Maps / relics / portal lore",
    description:
      "Cartographers and archivists. Athir the Dustwarden — formerly the Spirit Cartographer — keeps the maps the Corruption tried to burn.",
    leaderCharacterId: "athir",
    color: "#b8a07c",
    phaseAvailable: 4,
  },
};

export const GUILD_ORDER: GuildId[] = [
  "bloomveil",
  "ember",
  "water",
  "spores",
  "thorn",
  "dustroot",
];
