// The seam between the renderer (which knows entity movement, surface, and the
// camera) and the spatial sound engine (src/game/sfx.ts). The renderer depends
// only on this interface; main.ts injects the real `sfx` singleton. This keeps
// src/render/ free of any src/game/ import (see src/CLAUDE.md dependency rules).

export type Surface = 'grass' | 'dirt' | 'stone' | 'wood' | 'snow' | 'water';

// The per-ability VFX system (src/render/ability_vfx/) reports its authored
// moments through an optional callback shaped like this, so a sound engine can
// score a spell phase by phase. Nothing implements it yet: the types exist so
// the VFX modules stay a straight copy of upstream.
export type AbilityAudioKind =
  | 'windup'
  | 'release'
  | 'impact'
  | 'pulse'
  | 'crit'
  | 'spirit'
  | 'motif';

export interface AbilityAudioOpts {
  /** Quieter, sub-less version (spec liteAudio or a degraded visual tier). */
  lite?: boolean;
  finisher?: boolean;
  /** Spec archetype: heal/buff/cc chime gently instead of booming. */
  archetype?: string;
  /** Authored buff apply style ('raise' | 'morph' | 'veil'). */
  buffStyle?: string;
  /** Spec-authored bespoke sample id (impact.sample). */
  sample?: string;
  /** The spirit creature model ('spirit') or motif name ('motif'). */
  name?: string;
  /** The casting ability id, so a sound engine can resolve the ability's
   *  school and projectile flag. */
  abilityId?: string;
}

export interface SpatialAudioSink {
  /** Listener pose each frame: position + forward unit vector (camera). */
  setListener(x: number, y: number, z: number, fx: number, fy: number, fz: number): void;
  /** One footfall for an entity (self or other) at a world position. */
  footstep(
    x: number,
    y: number,
    z: number,
    surface: Surface,
    running: boolean,
    self: boolean,
  ): void;
  /** A discrete movement event (jump / land / water entry / swim stroke). */
  movement(
    kind: 'jump' | 'land' | 'splash' | 'swim',
    x: number,
    y: number,
    z: number,
    self: boolean,
  ): void;
  /** Per-frame ambience state around the player; the engine cross-fades loops. */
  ambience(
    biome: 'vale' | 'marsh' | 'peaks',
    inDungeon: boolean,
    precip: 'snow' | 'rain' | null,
    nearWater: boolean,
  ): void;
}
