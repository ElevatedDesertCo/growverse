/**
 * Story chapters.
 *
 * Chapter 1 (Portal Awakening) script lives in
 * docs/portal-awakening-cinematic.md. This file is the typed metadata
 * for the chapter system + reserved ids for Chapter 1 and Chapter 2.
 *
 * The actual cinematic scene data ships in lib/cinematic.ts (Phase 3)
 * derived from the same script doc.
 */

import type { ResourceBag } from "./types";

export interface ChapterDef {
  id: string;
  /** Display name, e.g. "Chapter 1: Portal Awakening". */
  name: string;
  /** One-line synopsis for chapter list UI. */
  synopsis: string;
  /** Path to companion script doc for writers. */
  scriptDoc: string;
  /** Resources granted on first completion. */
  firstCompletionRewards: ResourceBag;
  /** Character ids unlocked on first completion. */
  unlocksCharacters?: string[];
  /** Spirit pet ids unlocked on first completion. */
  unlocksSpiritPets?: string[];
  /** Building type ids unlocked on first completion. */
  unlocksBuildings?: string[];
  /** Prerequisites — chapter ids that must be completed first. */
  requires?: string[];
  /** Phase at which this chapter is playable. */
  phaseAvailable: number;
}

export const CHAPTERS: Record<string, ChapterDef> = {
  ch1_portal_awakening: {
    id: "ch1_portal_awakening",
    name: "Chapter 1: Portal Awakening",
    synopsis:
      "Anderz touches the wrong glowing thing. Solace introduces herself. The first portal opens. The Guild Core wakes up broken.",
    scriptDoc: "docs/portal-awakening-cinematic.md",
    firstCompletionRewards: {
      bloomEssence: 10,
    },
    unlocksCharacters: ["anderz", "solace"],
    unlocksSpiritPets: ["solace"],
    phaseAvailable: 3,
  },
  ch2_reality_trust_issues: {
    id: "ch2_reality_trust_issues",
    name: "Chapter 2: Reality Has Trust Issues",
    synopsis:
      "The Core's first repair flickers. Raiin arrives via collapsed portal, mostly to roast Anderz. Vyrra introduces herself by getting wet on someone.",
    scriptDoc: "docs/chapters/ch2-reality-trust-issues.md", // TBD draft
    firstCompletionRewards: {
      bloomEssence: 25,
      relicFragments: 1,
    },
    unlocksCharacters: ["raiin"],
    unlocksSpiritPets: ["vyrra"],
    requires: ["ch1_portal_awakening"],
    phaseAvailable: 3,
  },
};

export const CHAPTER_ORDER: string[] = [
  "ch1_portal_awakening",
  "ch2_reality_trust_issues",
];
