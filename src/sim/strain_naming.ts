// Strain naming: every cross gets a name, and the game picks it.
//
// Names are GENERATED rather than player-authored, which is a deliberate design
// choice with two consequences worth stating up front:
//
//   1. No moderation surface. Nothing a player types reaches another player's
//      screen through this system, so there is no profanity gate, no server
//      round-trip to validate, and no way to smuggle text into a market listing.
//   2. No localization burden. A strain name is a proper noun, the same class of
//      text as a player name, which this codebase already splices verbatim in
//      every locale (see src/render/CLAUDE.md). Generated names ship as-is.
//
// How a cross is named follows how breeders actually name them: by BLENDING the
// parents. Crossing "Fen Haze" with "Copper Diesel" yields "Fen Diesel" or
// "Copper Haze", so a name carries its lineage audibly, and a line that has been
// bred toward one trait for generations keeps sounding related. When a blend
// would collide with a parent's own name (both parents share a head or tail
// word) the generator falls back to the authored pools so a cross is never
// mistaken for its own parent.
//
// A landrace (every trait expressed at GENE_MAX, the rare prize phenotype) earns
// a prestige prefix, so the thing worth bragging about announces itself.
//
// DETERMINISM: every choice draws from the passed `Rng`, never Math.random, so a
// (parents, rng-state) pair always produces the same name and the parity gate
// holds. The caller owns draw ORDER; this module draws a fixed number of times
// per call (see `nameCross`) so adding a name never shifts the global stream by
// a variable amount.
//
// `src/sim`-pure: no DOM/Three/render-ui-game-net imports, no clock.

import type { Rng } from './rng';
import { normalizeStrainName } from './strain_name';

// Head words: colour, place, and condition, the three things real strain names
// lead with. Kept deliberately in the fork's vale/marsh/peaks register rather
// than borrowed from real-world brands.
const HEADS = [
  'Fen',
  'Copper',
  'Amber',
  'Hollow',
  'Bramble',
  'Cinder',
  'Frost',
  'Dusk',
  'Mire',
  'Gilded',
  'Quiet',
  'Sunken',
  'Wild',
  'Thorn',
  'Velvet',
  'Storm',
  'Moss',
  'Ash',
] as const;

// Tail words: the "what it is" half.
const TAILS = [
  'Haze',
  'Diesel',
  'Kush',
  'Dream',
  'Widow',
  'Skunk',
  'Bloom',
  'Frost',
  'Petal',
  'Crown',
  'Lantern',
  'Reverie',
  'Drift',
  'Gold',
  'Silk',
  'Ember',
] as const;

// Earned by a landrace only: every trait at GENE_MAX.
const LANDRACE_PREFIXES = ['True', 'Pure', 'Heirloom', 'Old-Growth'] as const;

function pick<T>(rng: Rng, pool: readonly T[]): T {
  return pool[Math.floor(rng.next() * pool.length) % pool.length];
}

/** Split a name into its head and tail word. A single-word name is all tail, so
 *  blending still has something to take from either side. */
function splitName(name: string): { head: string; tail: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { head: '', tail: parts[0] ?? '' };
  return { head: parts.slice(0, -1).join(' '), tail: parts[parts.length - 1] ?? '' };
}

/**
 * Name a cross of `a` and `b`.
 *
 * Draws EXACTLY three times from `rng` on every path, so the shape of the global
 * draw stream does not depend on which branch is taken. Falls back to the
 * authored pools whenever a blend would be empty, malformed, or identical to a
 * parent's name.
 */
export function nameCross(rng: Rng, aName: string, bName: string, landrace: boolean): string {
  // Fixed draw budget: swap direction, head fallback, tail fallback.
  const swap = rng.next() < 0.5;
  const headFallback = pick(rng, HEADS);
  const tailFallback = pick(rng, TAILS);

  const a = splitName(aName);
  const b = splitName(bName);
  const head = (swap ? b.head : a.head) || headFallback;
  const tail = (swap ? a.tail : b.tail) || tailFallback;

  let blended = head === tail ? `${headFallback} ${tail}` : `${head} ${tail}`;
  // A blend that reproduces a parent exactly reads as "you bred nothing", so
  // reach for the authored head instead. Two library entries CAN share a name
  // (two harvests of the same base strain both discover "Common Bloom"), so this
  // is a real path, not just a self-cross edge case.
  if (blended === aName || blended === bName) blended = `${headFallback} ${tail}`;
  if (blended === aName || blended === bName) blended = `${head} ${tailFallback}`;
  // Both fallbacks can THEMSELVES collide: the drawn head and tail are pool
  // words, and the parent's own words may be the same pool words. Walk the head
  // pool until the collision breaks. Bounded by the pool size and consumes no
  // extra draw, so the fixed draw budget above still holds.
  for (let i = 0; (blended === aName || blended === bName) && i < HEADS.length; i++) {
    const alt =
      HEADS[(HEADS.indexOf(headFallback as (typeof HEADS)[number]) + 1 + i) % HEADS.length];
    blended = `${alt} ${tail}`;
  }

  const prefixed = landrace ? `${LANDRACE_PREFIXES[0]} ${blended}` : blended;
  // The shape rules are the generator's own guard: a pool edit that produced a
  // malformed or over-long name would otherwise ship a broken label into the
  // market. Fall back to the plain blend, then to a minimal authored pair.
  return (
    normalizeStrainName(prefixed) ??
    normalizeStrainName(blended) ??
    normalizeStrainName(`${headFallback} ${tailFallback}`) ??
    'Wild Bloom'
  );
}

export const STRAIN_NAME_POOLS_FOR_TEST = { HEADS, TAILS, LANDRACE_PREFIXES };
