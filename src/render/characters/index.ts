// Character visual system — rigged glTF replacements for the old procedural
// rigs. Asset fetches start at module import (see assets.ts) and register
// with the preload gate, so createCharacterVisual is synchronous by the time
// the Renderer constructs views.
import type { Entity, PlayerClass } from '../../sim/types';
import { mechHeldWeaponOverride, modularVisualKey, VISUALS, visualKeyFor } from './manifest';
import { MODULAR_WARRIOR_KEY, type ModularLook } from './modular';
import { CharacterVisual } from './visual';

export { CharacterPreview } from './preview';
export type { AnimState } from './visual';
export { CharacterVisual } from './visual';

/** Build the visual for an entity (or an explicit shapeshift/polymorph form key). */
// A composed body is opt-in per entity: the app installs a provider that says
// which entities carry an authored look, so this factory stays free of any
// storage or session knowledge. No provider installed = every entity keeps its
// fixed class rig, which is exactly the pre-creator behaviour.
let modularLookProvider: ((e: Entity) => ModularLook | null) | null = null;

export function setModularLookProvider(fn: ((e: Entity) => ModularLook | null) | null): void {
  modularLookProvider = fn;
}

/** The look an entity composes with, or null if it keeps its fixed class rig. */
export function modularLookFor(e: Entity): ModularLook | null {
  return modularLookProvider?.(e) ?? null;
}

/** The composed-body visual key for an entity the provider claimed: the class's
 *  own modular def, with the warrior's as the fallback for a templateId that
 *  has none. */
export function modularKeyFor(e: Entity): string {
  if (e.kind !== 'player') return MODULAR_WARRIOR_KEY;
  const key = modularVisualKey(e.templateId as PlayerClass);
  return VISUALS[key] ? key : MODULAR_WARRIOR_KEY;
}

export function createCharacterVisual(
  e: Entity,
  formKey?: 'form_sheep' | 'form_bear' | 'form_cat' | 'form_travel',
): CharacterVisual {
  // forms (sheep/bear/cat/travel) are their own models — skins and held weapons
  // only apply to the base body
  // A form (sheep/bear/cat/travel) replaces the body outright, so it outranks a
  // composed look; otherwise a claimed entity composes.
  const look = formKey ? null : modularLookFor(e);
  const key = formKey ?? (look ? modularKeyFor(e) : visualKeyFor(e));
  // The class-agnostic Combat Mech adopts the wearer class's hand layout, so a
  // rogue-skinned mech dual-wields the equipped weapon in both hands. e.templateId
  // is the player's class on every host, so this matches offline and online.
  const weaponOverride =
    !formKey && key === 'player_mech' && e.kind === 'player'
      ? mechHeldWeaponOverride(e.templateId as PlayerClass)
      : null;
  return new CharacterVisual(
    key,
    e.color,
    formKey ? 0 : (e.skin ?? 0),
    formKey ? null : e.mainhandItemId,
    weaponOverride,
    look,
  );
}
