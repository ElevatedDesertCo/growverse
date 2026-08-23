// The drift guard src/world_api/appearance.ts promises four times over.
//
// That module deliberately does NOT duplicate the renderer's ~40 style enums
// (they would drift the day a new haircut lands). What it pins instead is the
// key SET and the value BOUNDS, and it cites this file as the thing that stops
// those from silently falling out of step with the renderer. Without it, a
// future style id containing a '-', or a new slider, fails to save with no CI
// signal at all: the player's look just quietly does not persist.

import { describe, expect, it } from 'vitest';
import {
  BODY_SLIDERS,
  DEFAULT_APPEARANCE,
  FACE_SLIDERS,
  HAIR_STYLES,
} from '../src/render/characters/modular';
import {
  APPEARANCE_BODY_SLIDER_KEYS,
  APPEARANCE_FACE_SLIDER_KEYS,
  APPEARANCE_MAX_WIRE_BYTES,
  APPEARANCE_WIRE_KEYS,
  sanitizeAppearance,
} from '../src/world_api/appearance';

describe('wire key set vs the renderer', () => {
  it('carries every key the renderer authors in a default look', () => {
    // DEFAULT_APPEARANCE is the renderer's own statement of what a look is
    // made of. A key it has that the wire drops is a setting the player can
    // change and never save.
    const missing = Object.keys(DEFAULT_APPEARANCE).filter(
      (k) => !APPEARANCE_WIRE_KEYS.includes(k),
    );
    expect(missing, `wire is missing renderer keys: ${missing.join(', ')}`).toEqual([]);
  });

  it('pins the face slider list to the renderer table', () => {
    expect([...APPEARANCE_FACE_SLIDER_KEYS].sort()).toEqual([...FACE_SLIDERS].sort());
  });

  it('pins the body slider list to the renderer table', () => {
    expect([...APPEARANCE_BODY_SLIDER_KEYS].sort()).toEqual([...BODY_SLIDERS].sort());
  });
});

describe('style id bounds vs the renderer', () => {
  it('accepts every hair style the renderer defines', () => {
    // The sanitizer bounds ids with /^[a-z0-9_]{1,24}$/ so the JSONB column can
    // never become a channel for attacker-chosen text. If a future id needs a
    // character outside that class, this fails at CI rather than in production
    // as a look that silently will not save.
    const rejected = HAIR_STYLES.filter((id) => sanitizeAppearance({ hair: id })?.hair !== id);
    expect(rejected, `ids the wire would drop: ${rejected.join(', ')}`).toEqual([]);
  });

  it('rejects an id outside the character class', () => {
    expect(sanitizeAppearance({ hair: 'has-a-dash' })).toBeNull();
    expect(sanitizeAppearance({ hair: 'x'.repeat(25) })).toBeNull();
    expect(sanitizeAppearance({ hair: 'Uppercase' })).toBeNull();
  });
});

describe('wire byte ceiling', () => {
  it('is a real measured ceiling, not an estimate', () => {
    // Build the largest document sanitizeAppearance can return: every scalar
    // key at the longest legal id, and every slider map full at full float
    // precision, then measure it rather than trusting the constant.
    const maximal: Record<string, unknown> = {};
    for (const key of APPEARANCE_WIRE_KEYS) {
      if (key === 'face' || key === 'body') continue;
      maximal[key] = 'x'.repeat(24);
    }
    maximal.face = Object.fromEntries(APPEARANCE_FACE_SLIDER_KEYS.map((k) => [k, 0.123456789]));
    maximal.body = Object.fromEntries(APPEARANCE_BODY_SLIDER_KEYS.map((k) => [k, 0.123456789]));

    const out = sanitizeAppearance(maximal);
    expect(out).not.toBeNull();
    const bytes = Buffer.byteLength(JSON.stringify(out), 'utf8');
    expect(
      bytes,
      `maximal sanitized document is ${bytes} bytes, over the declared ceiling`,
    ).toBeLessThanOrEqual(APPEARANCE_MAX_WIRE_BYTES);
  });

  it('leaves a real default look far inside the ceiling', () => {
    const out = sanitizeAppearance(DEFAULT_APPEARANCE as unknown as Record<string, unknown>);
    expect(out).not.toBeNull();
    expect(Buffer.byteLength(JSON.stringify(out), 'utf8')).toBeLessThan(APPEARANCE_MAX_WIRE_BYTES);
  });
});
