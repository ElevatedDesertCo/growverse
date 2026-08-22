// Mount lifecycle and persistence for the character appearance customizer.
//
// Ported from World of ClaudeCraft, where this logic sits inline in main.ts.
// Here it is a sibling module because main.ts is a firewall, not a home (see
// the root CLAUDE.md): main.ts declares the host map and calls in, and every
// piece of state the customizer needs lives behind this seam.
//
// The 3D half of the upstream feature (composing a body from the modular GLB)
// is NOT ported: growverse's CharacterPreview has no setModular. Rather than
// hard-wire that absence, the preview is an injected hook -- when the modular
// renderer lands, main.ts passes a callback and nothing in this file changes.

import {
  ARMOR_SETS,
  type ArmorLoadout,
  type ArmorSetId,
  classArmorSet,
  fullSet,
  type ModularAppearance,
  normalizeAppearance,
} from '../render/characters/modular';
import type { PlayerClass } from '../sim/types';
import { type AppearanceCustomizer, mountAppearanceCustomizer } from './appearance_customizer';
import {
  appearancePanelIsStale,
  forgetAppearancePanel,
  noteAppearancePanelMounted,
} from './appearance_panel_locale';

const MODULAR_APPEARANCE_KEY = 'woc.modularAppearance';
const MODULAR_ARMOR_KEY = 'woc.modularArmorSet';

/** Repaint the creation turntable for a look. Absent until the modular
 *  renderer is ported, in which case the form still edits and persists. */
export type AppearancePreviewHook = (
  app: ModularAppearance,
  worn: ArmorLoadout,
  cls: PlayerClass,
) => void;

let previewHook: AppearancePreviewHook | null = null;
let hosts: Record<string, string> = {};

/** Wire the module to its host map, and optionally to a live preview. */
export function initAppearanceMounts(
  hostMap: Record<string, string>,
  onPreview?: AppearancePreviewHook,
): void {
  hosts = hostMap;
  previewHook = onPreview ?? null;
}

function readStoredAppearance(): ModularAppearance {
  try {
    const raw = localStorage.getItem(MODULAR_APPEARANCE_KEY);
    return normalizeAppearance(raw ? (JSON.parse(raw) as Partial<ModularAppearance>) : null);
  } catch {
    // private mode / corrupt value: a default body is always better than none
    return normalizeAppearance(null);
  }
}

let modularAppearance: ModularAppearance = readStoredAppearance();
const appearanceUis = new Map<string, AppearanceCustomizer>();

/** The look the player is currently editing, for callers that persist it. */
export function currentAppearance(): ModularAppearance {
  return modularAppearance;
}

// The creator emits on every `input` and every `pointermove` (the colour
// wheels), and localStorage.setItem is synchronous: a wheel drag would pay a
// stringify plus a store write per pointer sample. Coalesce to one trailing
// write, flushed on pagehide so a refresh mid-drag still keeps the look.
const APPEARANCE_STORE_DEBOUNCE_MS = 200;
let appearancePendingStore: ModularAppearance | null = null;
let appearanceStoreTimer: number | null = null;

/** Write any coalesced look immediately. Bind to pagehide/beforeunload. */
export function flushAppearanceStore(): void {
  if (appearanceStoreTimer !== null) {
    window.clearTimeout(appearanceStoreTimer);
    appearanceStoreTimer = null;
  }
  const pending = appearancePendingStore;
  appearancePendingStore = null;
  if (!pending) return;
  try {
    localStorage.setItem(MODULAR_APPEARANCE_KEY, JSON.stringify(pending));
  } catch {
    /* storage unavailable: the look still applies for this session */
  }
}

function storeAppearance(a: ModularAppearance): void {
  appearancePendingStore = a;
  if (appearanceStoreTimer !== null) return;
  appearanceStoreTimer = window.setTimeout(flushAppearanceStore, APPEARANCE_STORE_DEBOUNCE_MS);
}

/** The armour set a class's composed body wears: the per-class storage
 *  override when one is set, else the class kit. The legacy un-scoped key
 *  applies to the warrior only, so a set left there cannot dress all nine
 *  classes as knights. */
function readStoredArmorSet(cls: PlayerClass): ArmorSetId {
  try {
    const raw =
      localStorage.getItem(`${MODULAR_ARMOR_KEY}.${cls}`) ??
      (cls === 'warrior' ? localStorage.getItem(MODULAR_ARMOR_KEY) : null);
    return (ARMOR_SETS as readonly string[]).includes(raw ?? '')
      ? (raw as ArmorSetId)
      : classArmorSet(cls);
  } catch {
    return classArmorSet(cls);
  }
}

/** Whether the creation turntable shows the set's helm. A view of the
 *  character, not a property of them, so it lives here and not in the stored
 *  appearance: a saved look must not carry "was previewing the helmet". */
let creationHelm = false;

/** The creation loadout for a class's set: everything it has, MINUS the helm
 *  unless it has been switched back on, so the player can see the face, hair
 *  and skin tone they are picking. */
function creationLoadout(cls: PlayerClass): ArmorLoadout {
  const set = readStoredArmorSet(cls);
  const full = fullSet(set);
  return creationHelm ? full : { ...full, head: null };
}

function repaint(cls: PlayerClass, app: ModularAppearance = modularAppearance): void {
  previewHook?.(app, creationLoadout(cls), cls);
}

/** The class each panel's customizer is currently editing. The customizer
 *  mounts ONCE per panel and survives class switches (its rows are class-
 *  agnostic), so its closures must read the panel's live class from here
 *  rather than capture the class they mounted under; a captured one would
 *  keep previewing the first class's kit after a switch. */
const appearancePanelClass = new Map<string, PlayerClass>();

/** Mount (or refresh) the appearance customizer under a class-details panel.
 *  Locale staleness (the customizer bakes its labels at mount, and the create
 *  panel mounts before the locale chunk resolves) is tracked by
 *  appearance_panel_locale.ts, so one relocalize pass covers every panel. */
export function syncAppearanceUi(panelId: string, cls: PlayerClass): void {
  const hostSel = hosts[panelId];
  if (!hostSel) return;
  const host = document.querySelector(hostSel) as HTMLElement | null;
  if (!host) return;
  appearancePanelClass.set(panelId, cls);
  host.hidden = false;

  const existing = appearanceUis.get(panelId);
  if (existing && !appearancePanelIsStale(panelId)) {
    // The panel survives class switches; poke it so live-coloured chips (the
    // outfit swatches read the class kit) repaint for the new class.
    existing.set({});
    repaint(cls);
    return;
  }
  if (existing) {
    // The locale resolved differently than when this panel was built: the
    // customizer's labels are baked, so relabelling means a rebuild.
    existing.destroy();
    appearanceUis.delete(panelId);
  }

  const panelClass = () => appearancePanelClass.get(panelId) ?? cls;
  noteAppearancePanelMounted(panelId, () => syncAppearanceUi(panelId, panelClass()));
  appearanceUis.set(
    panelId,
    mountAppearanceCustomizer(host, {
      value: modularAppearance,
      onChange: (next) => {
        modularAppearance = next;
        storeAppearance(next);
        repaint(panelClass(), next);
      },
      helm: creationHelm,
      onHelm: (on) => {
        creationHelm = on;
        repaint(panelClass());
      },
      // The chips must preview against the set the composed body actually
      // wears: the stored override when one exists, not the class default.
      armorSet: () => readStoredArmorSet(panelClass()),
    }),
  );
  // The panel just mounted with the stored look; compose it now so the body
  // matches the controls before the player touches anything.
  repaint(cls);
}

/** Tear a panel's customizer down (panel closed / entry left). */
export function destroyAppearanceUi(panelId: string): void {
  appearanceUis.get(panelId)?.destroy();
  appearanceUis.delete(panelId);
  forgetAppearancePanel(panelId);
  appearancePanelClass.delete(panelId);
}
