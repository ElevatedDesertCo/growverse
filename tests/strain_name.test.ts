// Shape rules for player-authored strain names (src/sim/strain_name.ts).
//
// This is the first player-authored text this fork puts in front of other players, so
// the shape half is pinned hard here. The CONTENT half (profanity) is deliberately not
// covered by this file: it lives at the server boundary, where `offensiveName` can read
// the operator's runtime word lists. See the module header.

import { describe, expect, it } from 'vitest';
import {
  normalizeStrainName,
  STRAIN_NAME_MAX,
  STRAIN_NAME_MIN,
  validStrainName,
} from '../src/sim/strain_name';

describe('normalizeStrainName', () => {
  it('accepts ordinary names', () => {
    expect(normalizeStrainName('Blue Dream')).toBe('Blue Dream');
    expect(normalizeStrainName('Probe Prime')).toBe('Probe Prime');
    expect(normalizeStrainName('Bloom9')).toBe('Bloom9');
  });

  it('accepts the punctuation a strain name actually needs', () => {
    expect(normalizeStrainName("Marlow's Pride")).toBe("Marlow's Pride");
    expect(normalizeStrainName('Fen-Grown Haze')).toBe('Fen-Grown Haze');
  });

  it('canonicalizes padding and interior whitespace runs', () => {
    expect(normalizeStrainName('  Blue Dream  ')).toBe('Blue Dream');
    expect(normalizeStrainName('Blue   Dream')).toBe('Blue Dream');
    expect(normalizeStrainName('Blue\tDream')).toBe('Blue Dream');
  });

  it('rejects anything outside the length band', () => {
    expect(normalizeStrainName('ab')).toBeNull();
    expect(normalizeStrainName('a'.repeat(STRAIN_NAME_MAX + 1))).toBeNull();
    expect(normalizeStrainName('a'.repeat(STRAIN_NAME_MIN))).toBe('a'.repeat(STRAIN_NAME_MIN));
    expect(normalizeStrainName('a'.repeat(STRAIN_NAME_MAX))).toBe('a'.repeat(STRAIN_NAME_MAX));
  });

  it('measures length AFTER trimming, so padding cannot buy characters', () => {
    expect(normalizeStrainName(`  ${'a'.repeat(STRAIN_NAME_MAX)}  `)).toBe(
      'a'.repeat(STRAIN_NAME_MAX),
    );
    expect(normalizeStrainName(`  ab  `)).toBeNull();
  });

  it('rejects punctuation runs used as padding', () => {
    expect(normalizeStrainName('Blue---Dream')).toBeNull();
    expect(normalizeStrainName("Blue''Dream")).toBeNull();
    expect(normalizeStrainName('Blue -Dream')).toBeNull();
  });

  it('rejects names that do not open and close alphanumeric', () => {
    expect(normalizeStrainName('-Blue Dream')).toBeNull();
    expect(normalizeStrainName('Blue Dream-')).toBeNull();
    expect(normalizeStrainName("'Blue'")).toBeNull();
  });

  it('rejects markup, control, and non-string input', () => {
    expect(normalizeStrainName('<b>Blue</b>')).toBeNull();
    expect(normalizeStrainName('Blue\nDream')).toBe('Blue Dream'); // newline is whitespace
    expect(normalizeStrainName('Blue\u0000Dream')).toBeNull(); // NUL, written as an escape
    expect(normalizeStrainName(null)).toBeNull();
    expect(normalizeStrainName(undefined)).toBeNull();
    expect(normalizeStrainName(42)).toBeNull();
    expect(normalizeStrainName({ name: 'Blue' })).toBeNull();
  });

  it('is idempotent: normalizing a canonical name returns it unchanged', () => {
    for (const raw of ['  Blue   Dream ', "Marlow's Pride", 'Fen-Grown Haze']) {
      const once = normalizeStrainName(raw);
      expect(once).not.toBeNull();
      expect(normalizeStrainName(once)).toBe(once);
    }
  });

  it('validStrainName agrees with normalizeStrainName', () => {
    for (const raw of ['Blue Dream', 'ab', 'Blue---Dream', '', "Marlow's Pride", null]) {
      expect(validStrainName(raw)).toBe(normalizeStrainName(raw) !== null);
    }
  });
});
