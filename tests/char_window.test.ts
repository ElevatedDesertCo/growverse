import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The character window painter is a DOM module; driving the live DOM + events is
// the opt-in browser suite. This is the no-DOM-suite
// equivalent: it asserts the painter source carries the a11y
// attributes + focus-return, the token discipline, and that the
// Three.js preview + skin-event randomness stay out of the painter (HUD-owned),
// driving the paperdoll off the pure core.
const painter = readFileSync(new URL('../src/ui/char_window.ts', import.meta.url), 'utf8');

describe('char_window: no magic values', () => {
  it('carries no literal color in TS (colors live in tokens/stylesheet)', () => {
    const hex = painter.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hex, `hex colors must move to tokens/CSS: ${hex.join(', ')}`).toEqual([]);
    expect(painter, 'rgb()/hsl() color literal must move to tokens/CSS').not.toMatch(
      /\b(?:rgba?|hsla?)\(/,
    );
  });

  it('routes the quality + empty-slot colors through CSS tokens', () => {
    expect(painter).toContain("const QUALITY_DEFAULT_COLOR = 'var(--color-quality-default)'");
    expect(painter).toContain("const SLOT_EMPTY_TEXT_COLOR = 'var(--color-slot-empty-text)'");
    expect(painter).toContain("const SLOT_EMPTY_BORDER_COLOR = 'var(--color-slot-empty-border)'");
  });

  it('uses no em or en dashes (ASCII separators only)', () => {
    expect(painter.includes('—'), 'em dash found').toBe(false);
    expect(painter.includes('–'), 'en dash found').toBe(false);
  });
});

describe('char_window: WCAG 2.2 AA', () => {
  it('returns focus to the opener on close', () => {
    expect(painter).toContain('captureFocus');
    expect(painter).toContain('restoreFocus');
    const close = painter.slice(painter.indexOf('close(): void {'));
    expect(close).toContain('this.deps.restoreFocus(this.openerFocus)');
  });

  it('labels its controls (close, unequip, the skin row)', () => {
    expect(painter).toContain('hud.options.returnToGame'); // close button aria-label key
    expect(painter).toContain('hudChrome.paperdoll.unequipAria'); // unequip button aria-label
    expect(painter).toContain('role="list"'); // the skin row
    expect(painter).toContain("t('auth.appearance')"); // skin-row aria-label
  });

  it('keeps the keyboard/touch unequip focus on the rebuilt slot', () => {
    expect(painter).toContain('this.doUnequip(slot, true)'); // x button keeps focus
    expect(painter).toContain('document.getElementById'); // looks up the rebuilt slot row
  });
});

describe('char_window: paperdoll core + HUD-owned preview boundary', () => {
  it('drives the paperdoll off the pure char_view core', () => {
    expect(painter).toContain('buildPaperdollView(world.equipment, ITEMS)');
  });

  it('preserves the unequip / drag / context-menu dispatch', () => {
    expect(painter).toContain('this.deps.unequip(slot)');
    expect(painter).toContain('this.deps.beginUnequipDrag(slot)');
    expect(painter).toContain('this.deps.endUnequipDrag()');
    expect(painter).toContain("row.addEventListener('contextmenu'");
  });

  it('triggers the 3D preview + skin picker by callback, never building them here', () => {
    expect(painter).toContain('this.deps.renderPreview()');
    expect(painter).toContain('this.deps.renderSkinPicker()');
  });

  it('imports no Three / render layer and carries no skin-event randomness', () => {
    expect(painter).not.toMatch(/from\s+['"]\.\.\/render\//);
    expect(painter).not.toMatch(/from\s+['"]three['"]/);
    expect(painter).not.toMatch(/\bCharacterPreview\b/);
    expect(painter).not.toMatch(/\bMath\.random\b/);
  });
});

describe('char_window: professions panel', () => {
  it('drives the professions rows off the pure professions_view core', () => {
    expect(painter).toContain('buildProfessionsView(world.professions)');
  });

  it('labels the panel + each skill via hudChrome.professions keys', () => {
    expect(painter).toContain("t('hudChrome.professions.title')");
    expect(painter).toContain("t('hudChrome.professions.skillAria'");
    expect(painter).toContain('hudChrome.professions.mining');
    expect(painter).toContain('hudChrome.professions.herbalism');
    expect(painter).toContain('hudChrome.professions.logging');
  });
});

describe('char_window: embedded bags', () => {
  it('builds a persistent shell (main / bags-slot / footer) so a repaint keeps the bags', () => {
    // The bags node is reparented into the slot; only .char-main is innerHTML-rebuilt.
    expect(painter).toContain("className = 'char-main'");
    expect(painter).toContain("slot.id = 'char-bags-slot'");
    expect(painter).toContain("className = 'char-footer'");
    // The repaint targets the titlebar + main, never the whole root, so the bags
    // slot (the third grid column) + its embedded bags survive every render.
    expect(painter).toContain('main.innerHTML = gear + rail');
    expect(painter).not.toContain('el.innerHTML =');
  });

  it('reparents + repaints the bags through the HUD deps, never building bags here', () => {
    expect(painter).toContain('this.deps.embedBags()');
    // embed/restore are HUD-owned (the #bags lifecycle + cross-window modes are).
    expect(painter).toContain('embedBags(): void');
    expect(painter).toContain('restoreBags(): void');
    // The bag grid itself is NOT rebuilt in this painter.
    expect(painter).not.toMatch(/\bbuildBagGrid\b/);
  });

  it('restores the bags to their own window on close', () => {
    const close = painter.slice(painter.indexOf('close(): void {'));
    expect(close).toContain('this.deps.restoreBags()');
  });
});

describe('char_window: loadouts', () => {
  it('renders saved loadouts as apply chips wired through the deps', () => {
    expect(painter).toContain('world.loadouts');
    expect(painter).toContain('world.activeLoadout');
    expect(painter).toContain('data-loadout');
    expect(painter).toContain('this.deps.applyLoadout(i)');
    expect(painter).toContain('applyLoadout(index: number): void');
  });

  it('labels the panel + chips via hudChrome.loadouts keys', () => {
    expect(painter).toContain("t('hudChrome.loadouts.title')");
    expect(painter).toContain("t('hudChrome.loadouts.hint')");
    expect(painter).toContain("t('hudChrome.loadouts.applyAria'");
  });
});
