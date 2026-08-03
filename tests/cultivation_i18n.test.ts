// Every player-facing string the cultivation slice emits is localized.
//
// src/sim/cultivation.ts and src/sim/strain_library.ts are NOT scanned by the S3 drift
// guard (tests/localization_fixes.test.ts only parses sim.ts and server/game.ts), which
// is how the whole garden and breeding surface came to ship English while the invariant
// said otherwise. This is the missing guard: it parses both modules the same way, so a
// new emit there fails here instead of silently leaking English.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { setLanguage } from '../src/ui/i18n';
import { localizeSimText } from '../src/ui/sim_i18n';

const SCANNED = ['src/sim/cultivation.ts', 'src/sim/strain_library.ts', 'src/sim/cup.ts'];

// Every ctx.error / ctx.notice literal in the scanned modules, with the template holes
// filled by a stand-in so a RULE regex can match the shape it would see at runtime.
function emits(): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  for (const rel of SCANNED) {
    const src = readFileSync(join(__dirname, '..', rel), 'utf8');
    for (const m of src.matchAll(/ctx\.(?:error|notice)\(\s*meta\.entityId,\s*(['"`])(.*?)\1/gs)) {
      // A template hole stands in as a plausible runtime value so a RULE regex sees the
      // shape it would at runtime. NUMERIC holes must substitute a number: some rules
      // capture (\d+) rather than (.+), and a word there would fail to match for a
      // reason that has nothing to do with the string being registered.
      const text = m[2].replace(/\$\{([^}]+)\}/g, (_all, expr: string) =>
        /score|count|rank|level|seconds/i.test(expr) ? '42' : 'Fen Haze',
      );
      if (!text.includes('$')) out.push({ file: rel, text });
    }
  }
  return out;
}

describe('cultivation player text is localized', () => {
  it('finds the emits it is meant to be guarding (the scan itself works)', () => {
    const found = emits();
    expect(found.length).toBeGreaterThan(20);
    expect(found.some((e) => e.text === 'That plot is empty.')).toBe(true);
  });

  it('every emit is RECOGNIZED by the sim matcher', () => {
    // localizeSimText returns null for anything it does not recognize, so null is the
    // failure this guard exists to catch. (An earlier draft asserted "not equal to the
    // English", which null trivially satisfies: it would have passed while guarding
    // nothing.)
    setLanguage('en');
    for (const { file, text } of emits()) {
      expect(
        localizeSimText(text),
        `${file}: "${text}" is not registered in sim_i18n.ts`,
      ).not.toBeNull();
    }
  });

  it('actually renders differently in a non-English locale, not just English again', () => {
    setLanguage('es');
    try {
      for (const { file, text } of emits()) {
        expect(localizeSimText(text), `${file}: "${text}" still renders English in es`).not.toBe(
          text,
        );
      }
    } finally {
      setLanguage('en');
    }
  });

  it('English round-trips unchanged, so the matcher never garbles the source locale', () => {
    setLanguage('en');
    for (const { text } of emits()) expect(localizeSimText(text)).toBe(text);
  });
});
