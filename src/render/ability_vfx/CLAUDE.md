<!-- src/render/ability_vfx/: the per-ability spell VFX subsystem. Root +
     src/render CLAUDE.md apply; this file is directory-local only. -->

# src/render/ability_vfx/: per-ability spell VFX

Gives every ability the Ability VFX Gallery's authored visual identity. Three
layers behind the `index.ts` barrel:

- Spec data: `../ability_vfx_specs.ts` (compact planning projection) and
  `../ability_vfx_full_specs.ts` (the COMPLETE per-ability spec mirrored from
  the gallery source of truth: archetype, palette, windup style, motifs,
  impact/bolt/strike/nova/beam/dot/cc/shout/burst blocks, buff orbit DNA,
  barrier, linger). Types live in `../ability_vfx_core.ts` (the registered
  RENDER_PURE_CORES core; spam budget + quality/tier math stays THERE).
- `painter.ts` (`AbilityVfx`): the decision half. Claims events by ability id,
  plans color/tier via the core, drives the pooled `Vfx` particles, and starts
  archetype sequences. `handleSpellfx` returning false means the renderer's
  generic school-colored arm runs unchanged. `syncEntity` feeds per-frame state
  (windup ceremonies from live cast state, aura-driven orbit bands and barrier
  shells, matched by aura id == ability id, so buffs work online too).
- `fx.ts` (`AbilityVfxFx`): the Three-side engine. Pooled primitive families,
  each hard-capped, materials cloned at construction only: `ribbons.ts` (one
  dynamic mesh: jagged bolts, comet trails, styled slash arcs, generic paths),
  `rings.ts` (shockwave rings), `decals.ts` (dissolve ember/rime/rune marks),
  `overlay_sprites.ts` (one point cloud: windup orbs, orbit bands, sequencer
  transients), `pillars.ts` (light columns), `shells.ts` (fresnel buff/barrier
  shells). `sequencer.ts` (`ArchetypeSequencer`) plays the gallery phase
  anatomy per cast: release flash, travel, the impact stack honoring every
  spec impact flag, staggered rings, lingers, and the 14 signature motifs;
  instants run it compressed (0.15s release to impact). `fx_textures.ts`
  builds the shared canvas textures once, deterministically.

Renderer contract: construct `AbilityVfxFx` with (scene, camera, anchor,
groundY), hand it to `AbilityVfx` via deps (which also wires the Vfx particle
burst, the pulseAt light delegate, and the probe stat sink), call
`handleSpellfx`/`onDamage` from `handleEvent`, `syncEntity(e)` per synced
entity, and `update(dt)` once per frame. Budget tiers degrade in order:
tier 1 sheds motifs, decals, and lingers; tier 2 keeps color-only minimal
particles (the sequencer never runs).

Verification: `scripts/ability_vfx_probe.mjs` (dev server + headless browser)
asserts every spec'd ability clears its per-archetype primitive bar in the
real client via the dev-only `window.__game.abilityVfxStats` hook. All
materials are additive with depth-write off; no new post-processing: HDR
multipliers ride the existing composer bloom exactly like `../vfx.ts`.

## Growverse divergences from upstream (read before re-syncing)

This subsystem was ported from `levy-street/world-of-claudecraft`. Files are
otherwise straight copies, so a future re-sync is a file copy plus re-applying
these. Every divergence is marked with a `Growverse divergence:` comment at its
site.

- `painter.ts` drops two upstream checks the fork's sim cannot answer: abilities
  here carry no `passive` flag, and `targetType` has no `'any'` member.
- `../characters/weapon_attack_style_core.ts` keeps only `attackAbilityId` and
  `isSpinAttackAbility`. Upstream's `weaponAttackStyle` is omitted: Growverse
  weapons have no `hand` field, so there is no two-hand vs dual-wield to read.
- The spec tables are pruned to this fork's spellbook (157 abilities + 2 pet
  commands, vs upstream's 296 rows). Porting an ability from upstream means
  bringing its spec row back verbatim from upstream's table.
- `commanding_shout` and `rend` are Growverse originals with no upstream spec;
  both are authored locally and marked as such in `../ability_vfx_specs.ts`.
- Deps the fork cannot satisfy yet are simply not passed, and the painter
  no-ops each: `lightPulse` (no `pulseAt` on the renderer), `setAuraGlow`,
  `playShoutAnim`, `isMidOneShot`, `hasGestureClip`, `animHold`, `bodyLean`,
  `screenFlash`, `screenImpact`, `abilityAudio`. Wiring any of them is additive:
  add the capability to `CharacterVisual` / `Renderer`, then pass the dep.
- Upstream's `tests/ability_vfx_selfcast_fallthrough.test.ts` is not ported: it
  covers a `selfCast` spellfx variant this fork's `SimEvent` does not have.
- `scripts/ability_vfx_probe.mjs` is NOT ported yet, so the per-archetype
  primitive bar is currently unverified in a real browser here.
