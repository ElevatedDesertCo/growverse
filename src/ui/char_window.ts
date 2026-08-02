// Thin DOM painter for the character window (the paperdoll sheet).
//
// The consumer half of the pure-core + thin-painter split: it paints
// #char-window from the structured PaperdollView (char_view.ts) plus the
// HUD-supplied stat / talent / progression fragments, and wires the equip-slot
// unequip / drag / tooltip affordances. It owns no Sim reference and reaches into
// Hud only through its deps.
//
// Two regions stay HUD concerns and are triggered here through callbacks, never
// built in this module: the shared 3D turntable preview (the single WebGL preview
// is borrowed by the skin-event overlay and the player card, so its lifecycle
// stays HUD-owned) and the cosmetic skin picker (its async mech-asset loading +
// preview remounts live with the preview). The pure core stays paperdoll-only; no
// 3D types or RNG cross into it.
//
// Colors live in the extracted stylesheet: item-quality tint comes
// from the shared QUALITY_COLOR map and the empty-slot greys are CSS tokens, so no
// raw hex sits in this painter.

import { audio } from '../game/audio';
import { ITEMS } from '../sim/data';
import type { EquipSlot, ProfessionId } from '../sim/types';
import type { IWorld } from '../world_api';
import { buildPaperdollView, type PaperdollSlot } from './char_view';
import { markDialogRoot } from './dialog_root';
import { classDisplayName, itemDisplayName } from './entity_i18n';
import { esc } from './esc';
import { formatNumber, t } from './i18n';
import { iconDataUrl, QUALITY_COLOR } from './icons';
import {
  buildOverviewView,
  type OverviewRepRow,
  type OverviewSessionRow,
  type OverviewStrainRow,
} from './overview_view';
import type { PainterHostPresentation } from './painter_host';
import { hydratePortraits, portraitChipHtml } from './portrait_chip';
import { buildProfessionsView } from './professions_view';
import type { StatId } from './stat_tooltip';
import { svgIcon } from './ui_icons';

// Quality / empty-slot colors as CSS custom properties: the shared
// QUALITY_COLOR map carries the per-quality hex, and these tokens cover the
// unranked item plus the empty-slot label and icon border, so no raw hex lives
// in this painter.
const QUALITY_DEFAULT_COLOR = 'var(--color-quality-default)';
const SLOT_EMPTY_TEXT_COLOR = 'var(--color-slot-empty-text)';
const SLOT_EMPTY_BORDER_COLOR = 'var(--color-slot-empty-border)';

// The ten character-sheet stat cells, primaries down the left column and derived
// stats down the right (the CSS grid wraps two per row). The HUD builds each cell
// from the unit-tested stat_tooltip_view model, so the order is the only stat
// concern this painter owns.
const STAT_GRID: readonly StatId[] = [
  'str',
  'armor',
  'agi',
  'attackPower',
  'sta',
  'dps',
  'int',
  'critChance',
  'spi',
  'dodge',
  'spellPower',
];

/**
 * Hud-supplied glue. Composes the shared PainterHostPresentation bag
 * (icon/tooltip) and adds the character-sheet surface: world reads, the localized
 * slot name, the HUD-built stat / talent / progression fragments, the unequip +
 * drag plumbing (the bags drop target reads HUD's drag slot), focus capture for
 * WCAG focus-return, and the two HUD-owned render regions (3D preview + skin
 * picker) invoked by callback.
 */
export interface CharWindowDeps extends PainterHostPresentation {
  root(): HTMLElement;
  world(): IWorld;
  closeOthers(): void;
  hideTooltip(): void;
  captureFocus(): HTMLElement | null;
  restoreFocus(target: HTMLElement | null): void;
  slotName(slot: EquipSlot): string;
  statCellHtml(stat: StatId): string;
  statTooltipHtml(stat: StatId): string;
  talentSummaryHtml(): string;
  progressionHtml(level: number): string;
  /** Remove the equipped piece in `slot` to bags and repaint bags + the sheet. */
  unequip(slot: EquipSlot): void;
  /** Stage a drag-to-unequip: record the slot HUD-side and reveal the bags drop. */
  beginUnequipDrag(slot: EquipSlot): void;
  /** End a drag-to-unequip: clear the HUD slot and the bags drop-target hint. */
  endUnequipDrag(): void;
  /** Mount the shared 3D turntable into the model panel (HUD-owned lifecycle). */
  renderPreview(): void;
  /** Paint the cosmetic skin picker into the skin row (HUD-owned cosmetics). */
  renderSkinPicker(): void;
  openPlayerCard(): void;
  openPrestige(): void;
  /** Reparent the live #bags node into the char window's slot and repaint it. */
  embedBags(): void;
  /** Return #bags to its own floating window and hide it (on char close). */
  restoreBags(): void;
  /** Apply a saved gear + talent loadout by index (swaps gear + talents). */
  applyLoadout(index: number): void;
}

const SHARE_GLYPH =
  '<svg class="pc-share-ico" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M18 16.1a3 3 0 0 0-2.3 1.1l-6.7-3.9a3 3 0 0 0 0-2.6l6.7-3.9A3 3 0 1 0 15 4l-6.7 3.9a3 3 0 1 0 0 8.2L15 20a3 3 0 1 0 3-3.9z"/></svg>';

// The gathering-profession skill names, keyed by ProfessionId, resolved through
// t() at paint time (the ids themselves never surface to the player). `as const`
// keeps the values as literal translation keys so t() type-checks them.
const PROFESSION_LABEL_KEY = {
  mining: 'hudChrome.professions.mining',
  herbalism: 'hudChrome.professions.herbalism',
  logging: 'hudChrome.professions.logging',
  cultivation: 'hudChrome.professions.cultivation',
  breeding: 'hudChrome.professions.breeding',
  fishing: 'hudChrome.professions.fishing',
  cooking: 'hudChrome.professions.cooking',
  alchemy: 'hudChrome.professions.alchemy',
  smithing: 'hudChrome.professions.smithing',
  enchanting: 'hudChrome.professions.enchanting',
  lockpicking: 'hudChrome.professions.lockpicking',
} as const satisfies Record<ProfessionId, string>;

// The character sheet's two tabs: the Gear view (paperdoll + stats + bags) and the
// grower's Overview dashboard (commune standing + Bloom Sessions + strain library).
// The label values are literal translation keys so t() type-checks them.
type CharTab = 'character' | 'overview';
const CHAR_TABS = [
  { id: 'character', label: 'hudChrome.overview.gearTab' },
  { id: 'overview', label: 'hudChrome.overview.overviewTab' },
] as const satisfies readonly { id: CharTab; label: string }[];

export class CharWindow {
  private openerFocus: HTMLElement | null = null;
  // Which tab is showing. Persists while the window is open; a fresh open keeps the
  // last-viewed tab (the shell rebuilds identically either way).
  private tab: CharTab = 'character';

  constructor(private readonly deps: CharWindowDeps) {}

  get isOpen(): boolean {
    return this.deps.root().style.display === 'block';
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
      return;
    }
    this.openerFocus = this.deps.captureFocus();
    this.deps.closeOthers();
    this.render();
    this.deps.root().style.display = 'block';
  }

  close(): void {
    const el = this.deps.root();
    if (el.style.display !== 'block') return;
    // Return the embedded bags to its own floating window before hiding the sheet,
    // so a later standalone bags open (B) finds it where it belongs.
    this.deps.restoreBags();
    el.style.display = 'none';
    this.deps.hideTooltip();
    this.deps.restoreFocus(this.openerFocus);
    this.openerFocus = null;
  }

  renderIfOpen(): void {
    if (this.isOpen) this.render();
  }

  render(): void {
    const el = this.deps.root();
    const world = this.deps.world();
    const p = world.player;
    const className = classDisplayName(world.cfg.playerClass);
    const level = formatNumber(p.level, { maximumFractionDigits: 0 });
    // WCAG 2.2 AA: name the focus-trapped root via the character title span.
    markDialogRoot(el, { labelledBy: 'char-title' });
    // Persistent shell: a full-width titlebar, a tab strip, and a `main` region are
    // rebuilt every render; the `bags-slot` (which holds the reparented live #bags
    // node) and the `footer` are built once. On the Gear tab main is
    // `display:contents`, so its gear + rail columns and the bags slot are the three
    // grid columns of .char-body; the Overview tab collapses the body to one column.
    // Only the titlebar / tabs / main are innerHTML-rebuilt, so a repaint never
    // destroys the embedded bags.
    const { titlebar, tabs, main, body } = this.ensureShell(el);

    titlebar.innerHTML = `<div class="panel-title char-title-portrait">${portraitChipHtml({ cls: world.cfg.playerClass, skin: p.skin ?? 0, name: p.name, variant: 'md' })}<span class="char-title-text" id="char-title">${esc(p.name)} <span class="panel-subtitle">${esc(t('itemUi.equipment.levelClass', { level, className }))}</span></span><button type="button" class="x-btn" data-close aria-label="${esc(t('hud.options.returnToGame'))}">${svgIcon('close')}</button></div>`;
    hydratePortraits(titlebar);
    titlebar.querySelector('[data-close]')?.addEventListener('click', () => this.close());

    this.paintTabs(tabs);

    if (this.tab === 'overview') {
      body.classList.add('char-body-overview');
      main.innerHTML = this.overviewHtml(world);
    } else {
      body.classList.remove('char-body-overview');
      this.paintGearTab(main, world, p.level);
    }

    // Reparent + repaint the bags grid into the slot so gear and inventory read as
    // one view (hidden by CSS on the Overview tab, but kept parented so a
    // close->restore stays symmetric). HUD-owned because the #bags lifecycle and
    // cross-window modes are.
    this.deps.embedBags();
  }

  // Paint the Gear tab into `main`: the paperdoll column plus the rail (stats,
  // specialization, professions, loadouts, progression), then wire the equip slots,
  // stat tooltips, and the HUD-owned 3D preview + skin picker.
  private paintGearTab(main: HTMLElement, world: IWorld, level: number): void {
    // Column 1: the paperdoll (equip slots flanking the 3D model). Column 2: the rail
    // (stats, specialization, professions, progression). Column 3 is the bags slot.
    const gear = `<div class="char-col-gear"><div class="paperdoll">
      <div class="equip-col" id="equip-col-left"></div>
      <div class="char-model-panel">
        <div id="char-model-preview" class="char-model-preview" role="img" aria-label="${esc(t('hudChrome.character.modelPreview'))}"></div>
        <div id="char-skin-row" class="skin-row char-skin-row" role="list" aria-label="${esc(t('auth.appearance'))}"></div>
      </div>
      <div class="equip-col equip-col-right" id="equip-col-right"></div>
    </div></div>`;
    const rail =
      `<div class="char-col-rail">` +
      `<div class="char-stats">${STAT_GRID.map((stat) => this.deps.statCellHtml(stat)).join('')}</div>` +
      this.deps.talentSummaryHtml() +
      this.professionsHtml(world) +
      this.loadoutsHtml(world) +
      this.deps.progressionHtml(level) +
      `</div>`;
    main.innerHTML = gear + rail;
    main
      .querySelector('[data-act="prestige"]')
      ?.addEventListener('click', () => this.deps.openPrestige());
    for (const chip of main.querySelectorAll<HTMLElement>('[data-loadout]')) {
      chip.addEventListener('click', () => {
        const i = Number(chip.dataset.loadout);
        if (Number.isInteger(i)) this.deps.applyLoadout(i);
      });
    }

    const view = buildPaperdollView(world.equipment, ITEMS);
    const leftCol = main.querySelector('#equip-col-left');
    const rightCol = main.querySelector('#equip-col-right');
    for (const cell of view.left) leftCol?.appendChild(this.buildSlotRow(cell));
    for (const cell of view.right) rightCol?.appendChild(this.buildSlotRow(cell));

    for (const cell of main.querySelectorAll<HTMLElement>('.char-stats [data-stat]')) {
      const stat = cell.dataset.stat as StatId;
      // Resolve the tooltip lazily, on show, so the breakdown reflects the
      // player's current stats at the moment they hover, not at render time.
      this.deps.attachTooltip(cell, () => this.deps.statTooltipHtml(stat));
    }

    this.deps.renderPreview();
    this.deps.renderSkinPicker();
  }

  // Paint the tab strip and wire the switch. Clicking the inactive tab flips the
  // stored tab and repaints the whole sheet (the bags stay parented in their slot).
  private paintTabs(tabs: HTMLElement): void {
    tabs.innerHTML =
      `<div class="char-tabs-inner" role="tablist" aria-label="${esc(t('hudChrome.overview.tablistAria'))}">` +
      CHAR_TABS.map((tb) => {
        const active = tb.id === this.tab;
        const cls = active ? 'char-tab active' : 'char-tab';
        return `<button type="button" class="${cls}" role="tab" aria-selected="${active}" data-tab="${tb.id}">${esc(t(tb.label))}</button>`;
      }).join('') +
      `</div>`;
    for (const btn of tabs.querySelectorAll<HTMLElement>('[data-tab]')) {
      btn.addEventListener('click', () => {
        const next: CharTab = btn.dataset.tab === 'overview' ? 'overview' : 'character';
        if (next === this.tab) return;
        this.tab = next;
        this.render();
      });
    }
  }

  // Build the persistent titlebar / tabs / body(main + bags-slot) / footer shell once,
  // returning the rebuilt regions plus the body (whose class toggles the Overview
  // single-column layout). The footer's share button is wired here (it lives outside
  // the rebuilt main so its listener survives every repaint); the close, tab, and
  // prestige buttons are re-wired per render since they live in the titlebar / tabs /
  // rail.
  private ensureShell(el: HTMLElement): {
    titlebar: HTMLElement;
    tabs: HTMLElement;
    main: HTMLElement;
    body: HTMLElement;
  } {
    const main = el.querySelector<HTMLElement>('.char-main');
    const titlebar = el.querySelector<HTMLElement>('.char-titlebar');
    const tabs = el.querySelector<HTMLElement>('.char-tabs');
    const body = el.querySelector<HTMLElement>('.char-body');
    if (main && titlebar && tabs && body) return { titlebar, tabs, main, body };
    el.textContent = '';
    const tb = document.createElement('div');
    tb.className = 'char-titlebar';
    const tabsEl = document.createElement('div');
    tabsEl.className = 'char-tabs';
    const bodyEl = document.createElement('div');
    bodyEl.className = 'char-body';
    const mainEl = document.createElement('div');
    mainEl.className = 'char-main';
    const slot = document.createElement('div');
    slot.className = 'char-bags-slot';
    slot.id = 'char-bags-slot';
    bodyEl.append(mainEl, slot);
    const footer = document.createElement('div');
    footer.className = 'char-footer';
    footer.innerHTML = `<div class="pc-share-row"><button type="button" class="btn pc-share-btn" data-act="share-card">${SHARE_GLYPH}<span>${esc(t('playerCard.shareButton'))}</span></button></div>`;
    footer.querySelector('[data-act="share-card"]')?.addEventListener('click', () => {
      audio.click();
      this.deps.openPlayerCard();
    });
    el.append(tb, tabsEl, bodyEl, footer);
    return { titlebar: tb, tabs: tabsEl, main: mainEl, body: bodyEl };
  }

  // The Professions group on the character sheet: one skill bar per gathering
  // profession (Mining / Herbalism / Logging), matching the .char-progression
  // chrome the spec and progression blocks use. The fill fraction rides a CSS
  // custom property (--prof-pct), so no layout literal sits in this painter, and
  // each row carries a localized aria label naming the skill and its ceiling.
  private professionsHtml(world: IWorld): string {
    const view = buildProfessionsView(world.professions);
    const rows = view.rows
      .map((row) => {
        const name = t(PROFESSION_LABEL_KEY[row.id]);
        const skill = formatNumber(row.skill, { maximumFractionDigits: 0 });
        const max = formatNumber(row.max, { maximumFractionDigits: 0 });
        const aria = t('hudChrome.professions.skillAria', { profession: name, skill, max });
        return (
          `<div class="prof-row" role="group" aria-label="${esc(aria)}">` +
          `<span class="prof-name">${esc(name)}</span>` +
          `<div class="prof-bar" style="--prof-pct:${row.pct}%"><div class="prof-bar-fill"></div></div>` +
          `<span class="prof-skill">${esc(skill)} / ${esc(max)}</span>` +
          `</div>`
        );
      })
      .join('');
    return (
      `<div class="char-progression char-professions">` +
      `<div class="cp-title">${t('hudChrome.professions.title')}</div>` +
      `<div class="prof-list">${rows}</div></div>`
    );
  }

  // The Loadouts group: saved gear + talent sets as clickable chips (the active one
  // highlighted). Clicking a chip applies that set (swaps gear + talents, server-
  // validated). Saving/naming stays in the Talents panel; this is the quick-switch.
  // Hidden entirely when the player has no saved loadouts, with a one-line hint.
  private loadoutsHtml(world: IWorld): string {
    const loadouts = world.loadouts;
    const active = world.activeLoadout;
    const title = `<div class="cp-title">${t('hudChrome.loadouts.title')}</div>`;
    if (loadouts.length === 0) {
      return (
        `<div class="char-progression char-loadouts">${title}` +
        `<div class="cp-none">${esc(t('hudChrome.loadouts.hint'))}</div></div>`
      );
    }
    const chips = loadouts
      .map((lo, i) => {
        const cls = i === active ? 'loadout-chip active' : 'loadout-chip';
        const aria = t('hudChrome.loadouts.applyAria', { name: lo.name });
        return `<button type="button" class="${cls}" data-loadout="${i}" aria-label="${esc(aria)}">${esc(lo.name)}</button>`;
      })
      .join('');
    return (
      `<div class="char-progression char-loadouts">${title}` +
      `<div class="loadout-chips">${chips}</div></div>`
    );
  }

  // The Overview tab: a read-only grower's dashboard aggregating three IWorld reads
  // via the pure overview core: commune standing, active Bloom Sessions, and the
  // strain library. Actionable breeding stays in the Breeding window at the Grow
  // Station; this is the always-reachable summary.
  private overviewHtml(world: IWorld): string {
    const view = buildOverviewView(world.reputation, world.strains, world.player.auras ?? []);
    return (
      `<div class="char-overview">` +
      this.communeHtml(view.reputation) +
      this.sessionsHtml(view.sessions) +
      this.strainsHtml(view.strains) +
      `</div>`
    );
  }

  // Commune standing: one row per faction with its tier and a fill toward the next
  // tier (full at the exalted cap). Tier names reuse the reputation catalog keys.
  private communeHtml(rows: OverviewRepRow[]): string {
    const title = `<div class="cp-title">${t('hudChrome.overview.commune')}</div>`;
    if (rows.length === 0) {
      return `<div class="char-progression char-overview-panel">${title}<div class="cp-none">${esc(t('hudChrome.breeding.empty'))}</div></div>`;
    }
    const body = rows
      .map((r) => {
        const tierName = t(`hudChrome.reputation.tier.${r.tier}` as Parameters<typeof t>[0]);
        const points = formatNumber(r.points, { maximumFractionDigits: 0 });
        const label = r.atMax
          ? points
          : `${points} / ${formatNumber(r.nextThreshold ?? 0, { maximumFractionDigits: 0 })}`;
        return (
          `<div class="ov-rep-row">` +
          `<span class="ov-rep-name">${esc(r.name)}</span>` +
          `<span class="ov-rep-tier">${esc(tierName)}</span>` +
          `<div class="ov-bar"><div class="ov-bar-fill" style="width:${r.pct}%"></div></div>` +
          `<span class="ov-rep-pts">${esc(label)}</span>` +
          `</div>`
        );
      })
      .join('');
    return `<div class="char-progression char-overview-panel">${title}<div class="ov-rep-list">${body}</div></div>`;
  }

  // Active Bloom Sessions: the running tonic buffs with a duration-fill timer bar, or
  // a one-line hint pointing at the Alchemy Lab when none are active.
  private sessionsHtml(rows: OverviewSessionRow[]): string {
    const title = `<div class="cp-title">${t('hudChrome.overview.sessions')}</div>`;
    if (rows.length === 0) {
      return `<div class="char-progression char-overview-panel">${title}<div class="cp-none">${esc(t('hudChrome.overview.noSessions'))}</div></div>`;
    }
    const body = rows
      .map((s) => {
        const time = this.formatSessionTime(s.remaining);
        const aria = t('hudChrome.overview.sessionAria', { name: s.name, time });
        return (
          `<div class="ov-session-row" role="group" aria-label="${esc(aria)}">` +
          `<span class="ov-session-name">${esc(s.name)}</span>` +
          `<div class="ov-bar ov-bar-timed"><div class="ov-bar-fill" style="width:${s.pct}%"></div></div>` +
          `<span class="ov-session-time">${esc(time)}</span>` +
          `</div>`
        );
      })
      .join('');
    return `<div class="char-progression char-overview-panel">${title}<div class="ov-session-list">${body}</div></div>`;
  }

  // Strain library: the expressed-phenotype rows (potency / vigor / yield), or the
  // shared "no strains yet" empty line. Trait + landrace labels reuse breeding keys.
  private strainsHtml(rows: OverviewStrainRow[]): string {
    const title = `<div class="cp-title">${t('hudChrome.overview.strains')}</div>`;
    if (rows.length === 0) {
      return `<div class="char-progression char-overview-panel">${title}<div class="cp-none">${esc(t('hudChrome.breeding.empty'))}</div></div>`;
    }
    const num = (n: number): string => formatNumber(n, { maximumFractionDigits: 0 });
    const body = rows
      .map((s) => {
        const landrace = s.landrace
          ? `<span class="ov-landrace">${esc(t('hudChrome.breeding.landrace'))}</span>`
          : '';
        const traits =
          `<span class="ov-trait">${esc(t('hudChrome.breeding.potency'))} ${esc(num(s.potency))}</span>` +
          `<span class="ov-trait">${esc(t('hudChrome.breeding.vigor'))} ${esc(num(s.vigor))}</span>` +
          `<span class="ov-trait">${esc(t('hudChrome.breeding.yield'))} ${esc(num(s.yield))}</span>`;
        return (
          `<div class="ov-strain">` +
          `<div class="ov-strain-head"><span class="ov-strain-name">${esc(s.name)}</span>${landrace}</div>` +
          `<div class="ov-traits">${traits}</div>` +
          `</div>`
        );
      })
      .join('');
    return `<div class="char-progression char-overview-panel">${title}<div class="ov-strain-list">${body}</div></div>`;
  }

  // A compact buff-timer label: whole minutes past a minute, whole seconds below it,
  // both through the unit templates so the number stays locale-formatted.
  private formatSessionTime(seconds: number): string {
    if (seconds >= 60) {
      const mins = formatNumber(Math.ceil(seconds / 60), { maximumFractionDigits: 0 });
      return t('hudChrome.overview.minutesShort', { n: mins });
    }
    return t('hudChrome.overview.secondsShort', {
      n: formatNumber(seconds, { maximumFractionDigits: 0 }),
    });
  }

  private buildSlotRow(cell: PaperdollSlot): HTMLElement {
    const { slot, item } = cell;
    const row = document.createElement('div');
    row.className = 'equip-slot';
    // Stable id + programmatic focusability so the corner-x rebuild can hand focus
    // back to this slot (the rebuilt row may be empty, with no x to focus).
    row.id = `equip-slot-${slot}`;
    row.tabIndex = -1;
    const qColor = !item
      ? SLOT_EMPTY_TEXT_COLOR
      : (QUALITY_COLOR[item.quality ?? 'common'] ?? QUALITY_DEFAULT_COLOR);
    const icon = item
      ? this.deps.itemIcon(item)
      : `<img class="item-icon" style="border-color:${SLOT_EMPTY_BORDER_COLOR}" src="${iconDataUrl('item', 'slot_empty')}" alt="" draggable="false">`;
    row.innerHTML = `${icon}
        <div><div class="slot-name">${esc(this.deps.slotName(slot))}</div><div class="slot-item" style="color:${qColor}">${item ? esc(itemDisplayName(item)) : esc(t('itemUi.equipment.empty'))}</div></div>`;
    if (item) {
      this.deps.attachTooltip(
        row,
        () =>
          `${this.deps.itemTooltip(item)}<div class="tt-sub">${esc(t('hudChrome.paperdoll.unequipHint'))}</div>`,
      );
      // Corner x: a styled glyph control (not an in-game icon), revealed on
      // hover/focus and always shown on touch where right-click is unavailable.
      const unequip = document.createElement('button');
      unequip.type = 'button';
      unequip.className = 'equip-unequip-btn';
      unequip.textContent = '×';
      unequip.setAttribute(
        'aria-label',
        t('hudChrome.paperdoll.unequipAria', { item: itemDisplayName(item) }),
      );
      unequip.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.doUnequip(slot, true);
      });
      row.appendChild(unequip);
      // Right-click the slot (classic-MMO muscle memory; matches the bags grid).
      row.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        this.doUnequip(slot, false);
      });
      // Drag the piece out onto the bags window to unequip it.
      row.draggable = true;
      row.addEventListener('dragstart', (e) => {
        this.deps.beginUnequipDrag(slot);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
        this.deps.hideTooltip();
      });
      row.addEventListener('dragend', () => this.deps.endUnequipDrag());
    } else {
      // Empty slot: still swallow the native menu so right-click feels consistent.
      row.addEventListener('contextmenu', (ev) => ev.preventDefault());
    }
    return row;
  }

  // `keepFocus` hands focus back to the now-empty slot row after the unequip
  // rebuilds the paperdoll (the innerHTML rebuild otherwise drops focus to
  // <body>); the keyboard/touch x path needs this, right-click and drag do not.
  private doUnequip(slot: EquipSlot, keepFocus: boolean): void {
    this.deps.unequip(slot);
    if (keepFocus) {
      const rebuilt = document.getElementById(`equip-slot-${slot}`);
      this.deps.restoreFocus(rebuilt instanceof HTMLElement ? rebuilt : null);
    }
  }
}
