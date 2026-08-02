// Player-authored strain names: the shape rules, and nothing else.
//
// Naming a cross is the branding layer of the strain economy: a bred strain carries
// its author's name and its breeder's, and both travel with it when the strain is
// traded. That makes this the first PLAYER-AUTHORED TEXT this fork puts in front of
// other players, so it is gated in two independent places:
//
//   1. SHAPE, here. Pure, deterministic, host-agnostic, and enforced in the sim so
//      offline and online agree. Length, character set, and whitespace only.
//   2. CONTENT, at the server boundary (server/game.ts), through the same
//      `offensiveName` matcher that already gates account and character names.
//      The sim cannot do this: it must not import from server/, and the word lists
//      are operator-configurable at runtime.
//
// Offline play gets rule 1 only, which is correct: a single-player name is never
// shown to anyone else. The moment a name can reach another player it has crossed
// the server, where rule 2 applies.
//
// `src/sim`-pure: no DOM/Three/render-ui-game-net imports, no rng, no clock.

export const STRAIN_NAME_MIN = 3;
export const STRAIN_NAME_MAX = 24;

// Letters, digits, and single interior spaces, hyphens, or apostrophes; must open and
// close on an alphanumeric. Modelled on the guild-name rule (server/social.ts) rather
// than the character-name rule, because a strain name is a label other players read in
// a market listing, not a proper noun that has to look like a person.
const SHAPE = /^[A-Za-z0-9][A-Za-z0-9 '-]*[A-Za-z0-9]$/;

/** Canonical form: trim the ends, collapse interior whitespace runs to one space.
 *  The client trims before sending, but the sim is the authority, so a padded name
 *  from a direct API client normalizes here too. */
export function normalizeStrainName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  if (cleaned.length < STRAIN_NAME_MIN || cleaned.length > STRAIN_NAME_MAX) return null;
  if (!SHAPE.test(cleaned)) return null;
  // No runs of the punctuation characters: "Blue---Dream" and "Blue '' Dream" read as
  // padding attempts rather than names.
  if (/[ '-]{2,}/.test(cleaned)) return null;
  return cleaned;
}

export function validStrainName(raw: unknown): boolean {
  return normalizeStrainName(raw) !== null;
}
