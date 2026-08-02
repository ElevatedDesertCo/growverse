// Shape rules for strain names.
//
// Strain names are GENERATED, not typed (see strain_naming.ts), so this is NOT a
// moderation gate: nothing a player authors reaches another player through the
// strain system, which is exactly why that design was chosen. What this module
// is instead is the generator's own guard rail. A pool edit or a blend rule that
// produced an over-long, empty, or malformed label would otherwise ship a broken
// name into a market listing, where it is read by every buyer.
//
// Kept as a separate leaf from the generator so a Vitest can pin the rules
// directly, and so the two cannot drift: `nameCross` validates its own output
// through `normalizeStrainName` before returning.
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
