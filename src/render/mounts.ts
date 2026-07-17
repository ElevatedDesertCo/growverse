// Rider-on-mount rendering (Mounts and Stables v1, docs/prd/mounts-and-stables.md).
//
// Owns every per-entity mount visual, keyed by entity id + mountId. While an
// entity carries a mountId the layer lazily builds the mount's CharacterVisual
// under the entity's group (so it inherits the interpolated position/facing and
// live scale the renderer already applies to the group), drives the mount's
// locomotion clips from the rider's movement state, and SEATS the rider:
// the active rider visual is lifted to a per-mount saddle height and the
// rider's own AnimState is quieted to a seated pose so the mount carries the
// motion. When the mountId clears, the mount changes, or the entity despawns,
// the lift is restored and the mount visual is disposed (mount visuals are
// never pooled, matching the druid form visuals; CharacterVisual.dispose only
// releases this clone's mixer + skeletons, shared geometry/materials survive).
//
// The $GROW-exclusive Verdant Bloomstrider additionally sheds a leaf/petal
// trail while moving (Vfx.petalTrail), gated on prefers-reduced-motion the
// same way the travel-form speed cue gates (renderer.updateTravelSpeedFx).
//
// Presentation only: reads entities, never mutates sim state. MOUNTS is one of
// the sanctioned pure sim data tables render may import (src/CLAUDE.md).

import type * as THREE from 'three';
import { MOUNTS } from '../sim/data';
import type { Entity } from '../sim/types';
import { type AnimState, CharacterVisual } from './characters';
import type { Vfx } from './vfx';

// MountDef.visual -> character-visual manifest key. wild_boar reuses the boar
// mob body; alpaca/bull/stag_verdant have dedicated mount defs (form_sheep is
// the deliberately sheep-scaled polymorph alpaca, too small to ride).
const MOUNT_VISUAL_KEYS: Record<string, string> = {
  alpaca: 'mount_alpaca',
  bull: 'mount_bull',
  wild_boar: 'mob_boar',
  stag_verdant: 'mount_stag_verdant',
};

// Saddle height per visual key: how far the rider's visual root is lifted so
// the rider sits on the mount's back rather than standing inside it. Rough
// back-line heights for each body; cosmetic only.
const SADDLE_HEIGHT: Record<string, number> = {
  mount_alpaca: 1.05,
  mount_bull: 1.25,
  mob_boar: 0.9,
  mount_stag_verdant: 1.2,
};

const BLOOMSTRIDER_KEY = 'mount_stag_verdant';

interface MountView {
  mountId: string;
  key: string;
  visual: CharacterVisual;
  /** The rider visual root currently lifted to saddle height (reset on release
   *  or when the active rider visual changes, e.g. a live body swap). */
  riderRoot: THREE.Object3D | null;
}

export class MountLayer {
  private views = new Map<number, MountView>();
  // Scratch AnimState for the mount body, refilled per call (no per-frame alloc).
  private mountSt: AnimState = {
    speed: 0,
    moving: false,
    airborne: false,
    backwards: false,
    reverseBackpedal: false,
    dead: false,
    casting: false,
    swimming: false,
    sitting: false,
  };

  constructor(
    private vfx: Vfx,
    private reducedMotion: () => boolean,
  ) {}

  /**
   * Per-frame driver, called from the renderer's entity sync loop for every
   * character view, right before the rider's own `active.update(dt, st, ...)`.
   * When the entity is mounted this MUTATES `st` into a seated pose (no
   * locomotion) after driving the mount's clips from the pre-seating movement.
   */
  sync(
    e: Entity,
    parent: THREE.Group,
    riderVisual: CharacterVisual,
    st: AnimState,
    dt: number,
    animate: boolean,
  ): void {
    const mountId = e.dead ? null : e.mountId;
    if (mountId === null) {
      if (this.views.size !== 0) this.release(e.id);
      return;
    }
    let mv = this.views.get(e.id);
    if (mv && mv.mountId !== mountId) {
      this.release(e.id);
      mv = undefined;
    }
    if (!mv) {
      const key = MOUNT_VISUAL_KEYS[MOUNTS[mountId]?.visual ?? ''];
      if (!key) return; // unknown mount: render the rider unmounted
      const visual = new CharacterVisual(key, e.color);
      parent.add(visual.root); // parent group carries position/facing/scale
      mv = { mountId, key, visual, riderRoot: null };
      this.views.set(e.id, mv);
    }

    // Drive the mount's clip state from the rider's PRE-seating movement:
    // gallop/walk while moving, idle at rest (the animal ClipMaps pick
    // run-vs-walk from speed exactly like mob visuals do).
    const ms = this.mountSt;
    ms.speed = st.speed;
    ms.moving = st.moving;
    ms.airborne = st.airborne;
    ms.backwards = st.backwards;
    ms.swimming = st.swimming;
    mv.visual.update(dt, ms, animate);

    // Verdant Bloomstrider: leaf/petal speed trail while moving, suppressed
    // under prefers-reduced-motion like the travel-form speed cue.
    if (mv.key === BLOOMSTRIDER_KEY && st.moving && !this.reducedMotion()) {
      this.vfx.petalTrail(e.id, dt);
    }

    // Seat the rider: lift the ACTIVE rider visual (base body or form) to the
    // saddle and quiet its locomotion so the mount carries the motion. If the
    // active visual changed since last frame (live body swap / form), restore
    // the old root first.
    const root = riderVisual.root;
    if (mv.riderRoot && mv.riderRoot !== root) mv.riderRoot.position.y = 0;
    mv.riderRoot = root;
    root.position.y = SADDLE_HEIGHT[mv.key] ?? 1;
    st.moving = false;
    st.speed = 0;
    st.airborne = false;
    st.backwards = false;
    st.sitting = true;
  }

  /** Follow the renderer's form-shadow tiering (the wantFormShadow band). */
  setShadow(entityId: number, on: boolean): void {
    this.views.get(entityId)?.visual.setShadow(on);
  }

  /** Drop this entity's mount visual and restore the rider offset. Called on
   *  despawn (removeView) and internally on dismount / mount change. */
  remove(entityId: number): void {
    this.release(entityId);
  }

  private release(entityId: number): void {
    const mv = this.views.get(entityId);
    if (!mv) return;
    if (mv.riderRoot) mv.riderRoot.position.y = 0;
    // dispose() detaches the root and releases this clone's mixer/skeletons;
    // geometry and materials are shared per-asset caches and survive.
    mv.visual.dispose();
    this.views.delete(entityId);
  }
}
