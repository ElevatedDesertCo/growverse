# Upstream Port Review: World of ClaudeCraft to Growverse

**Date:** 2026-08-01
**Fork base:** `growverse` v0.19.0 (diverged mid-July 2026)
**Upstream:** `levy-street/world-of-claudecraft` v0.33.0, HEAD `94f5ac63d` (2026-08-01)

## 0. Situation

Upstream shipped 14 minor versions since the fork point. The two trees no longer
share git history (the fork's history was rewritten), so there is no merge base
and no `git merge upstream/main` path. Everything below is a **targeted port**,
file by file, not a merge.

Raw shape of the gap, over `src/ public/ scripts/ server/ headless/`:

| | files |
|---|---|
| Upstream-only | 4014 |
| Shared paths | 2442 |
| Growverse-only | 216 |

Divergence on the four coordinators is total, which is what rules a merge out:

| File | Growverse | Upstream | Differing lines |
|---|---|---|---|
| `src/ui/hud.ts` | 12088 | 15845 | 13599 |
| `src/render/renderer.ts` | 5208 | 10360 | 7514 |
| `src/sim/sim.ts` | 6057 | 10472 | 6255 |
| `src/main.ts` | 7491 | 10090 | 4647 |

**The one piece of good news that shapes everything:** upstream added **zero new
runtime dependencies** for any of the work below. No new render packages, no new
shader libraries. Three.js is the same pinned release, `n8ao` and `postprocessing`
are the same. Every upgrade in this document is in-repo TypeScript. That removes
the single biggest risk from a port of this size.

---

## 1. Ability VFX (the highest-value, lowest-risk port)

**Verdict: take this first. It is close to free.**

Upstream built `src/render/ability_vfx/` (16 modules, ~11.6k lines with specs), a
per-ability authored spell VFX system. Growverse still runs the generic
school-colored particle arm in `src/render/vfx.ts` (719 lines).

What it is:

- `ability_vfx_specs.ts` (2190 lines) + `ability_vfx_full_specs.ts` are
  **data-as-code**: one authored visual identity per ability id (archetype,
  palette, windup style, motifs, impact/bolt/strike/nova/beam/dot/cc/shout/burst
  blocks, buff orbit DNA, barrier, linger).
- `ability_vfx_core.ts` is a pure core (spam budget, quality/tier math).
- `painter.ts` is the decision half; `fx.ts` is the Three-side pooled engine
  (ribbons, rings, decals, overlay sprites, pillars, shells, ground auras,
  flipbooks, spirits, spectacle), each family hard-capped.
- `sequencer.ts` plays the per-cast phase anatomy: release flash, travel, impact
  stack, staggered rings, lingers, 14 signature motifs. Instants run compressed.

### Why it ports cleanly

**1. The ability ids already match.** Of Growverse's 157 ability ids in
`src/sim/content/classes.ts`, **155 already have an authored upstream spec**. The
only two without are `commanding_shout` and `rend`, which are Growverse
originals. So the visual upgrade lands on essentially the whole existing
spellbook with no content authoring on your side.

**2. The dependency surface is tiny.** Everything `ability_vfx/` imports outside
itself:

```
three, three/addons/utils/SkeletonUtils.js
../../sim/data
../assets/loader
../audio_sink
../selection_ring
../characters/weapon_attack_style_core
```

Growverse already has `audio_sink.ts`, `selection_ring.ts`, and `assets/loader.ts`.
Only `characters/weapon_attack_style_core.ts` is missing and it is a small pure core.

**3. The renderer seam is an injected-callback interface, and almost all of it is
optional.** `AbilityVfxDeps` needs `vfx`, `fx`, `anchor`, `spawnAoeRing`,
`triggerAttack`; everything else (`lightPulse`, `setAuraGlow`, `playShoutAnim`,
`isMob`, `castingAbilityOf`, `localPlayerId`, ...) is optional. Growverse's
renderer already has `spellfx` / `spellfxAt` cases at `src/render/renderer.ts:2828`,
which is exactly where `handleSpellfx(ev)` slots in. When it returns false, your
existing generic arm runs unchanged, so the port is **incrementally safe**: you
can land it dark and it degrades to today's behavior.

**4. The `Vfx` primitive contract is nearly satisfied already.** `AbilityVfxPrimitives`
wants 8 methods; Growverse's `src/render/vfx.ts` has 6 of them
(`projectile`, `burst`, `nova`, `tick`, `buffSwirl`, `beam`). Missing:
`lightningProjectile` and `shoutwave`. Both are portable from upstream `vfx.ts`.

### Port plan

1. Port `lightningProjectile` + `shoutwave` into `src/render/vfx.ts`.
2. Port `characters/weapon_attack_style_core.ts`.
3. Drop in `ability_vfx_core.ts`, `ability_vfx_specs.ts`, `ability_vfx_full_specs.ts`,
   and the `ability_vfx/` directory verbatim.
4. Wire in `renderer.ts`: construct `AbilityVfxFx` + `AbilityVfx`, call
   `handleSpellfx`/`onDamage` from `handleEvent`, `syncEntity(e)` per synced entity,
   `update(dt)` per frame, `setQuality` from the gfx tier.
5. Register the new `*_core` files in `RENDER_PURE_CORES` (`tests/architecture.test.ts`).
6. Strip the specs for abilities Growverse does not have, and author two new specs
   for `commanding_shout` and `rend` by copying a near neighbor.

Also worth taking alongside it: `src/render/weapon_vfx.ts` (2971 lines, weapon
enchant/proc glows) and `weapon_vfx_tuning.ts`.

**Watch out:** the specs are tuned against upstream's palette and its post chain.
Growverse's `post.ts` bloom is `BLOOM_STRENGTH = 0.32`, so HDR multipliers in the
specs will read differently. Expect a tuning pass, not a rewrite.

---

## 2. World builder / map editor

**Verdict: portable, but it is a project, not an afternoon. Take it second.**

Upstream added `src/editor/` (39 modules, ~14.1k lines) plus `editor.html` as a
fourth Vite entry, served at `/editor`.

Architecture (from `src/editor/CLAUDE.md`):

- `app.ts` is a thin coordinator; every tool is a sibling module (topbar, toolbar,
  inspector, asset browser, map drawer, map IO, net, toasts, 2D canvas/view/model
  trio, 3D viewport).
- **`3d/viewport.ts` composes the real `Sim` + `Renderer`** over the working
  document. It builds one `WorldContent` sharing table references with the
  document and registers it via `setActiveWorldContent` (`sim/data`), so terrain
  samples read live edits. `main.ts` deep-clones builtin content so editing never
  mutates it.
- `playtest.ts` stashes a `WorldContent` in sessionStorage
  (`EDITOR_PLAYTEST_KEY` from `src/game/editor_playtest.ts`) and navigates; the
  game boots offline into it. **Playtest never touches the server**, which means a
  useful subset works with zero backend work.
- Pure decision cores (`undo_core`, `stamp_core`, `placement_transform_core`,
  `span_core`, `blocker_core`, `edit_caps_core`, `save_lifecycle_core`,
  `tutorial_core`, `server_link_core`, `server_errors_core`) are DOM-free and
  Node-tested.

### What the port costs

- **The `setActiveWorldContent` seam in `src/sim/data.ts`.** Check whether the
  fork's `data.ts` already has it; if not, that is the load-bearing change,
  and it has to keep the fork's own tables (`cultivation`, `genetics`,
  `crafting`, `gathering`, `hollowmere`, `zone4`) in the merged content.
- **`src/render/placed_assets.ts` and `src/sim/custom_world_props.ts`** are
  required (the editor's placement path) and are upstream-only.
- **`src/sim/map_doc.ts`** is the document format.
- **Server + Postgres, only if you want cloud save/share.** `server/maps.ts`,
  `maps_db.ts`, `maps_routes.ts`, `user_assets*.ts`, plus two new tables
  (`maps`, `user_assets`). The editor runs fully offline with no bearer token, so
  **phase 1 can skip the server entirely.**
- Build config: a fifth Vite entry, plus editor i18n keys under
  `src/ui/i18n.catalog/editor.ts` (English-only adds, per the repo's i18n rule).

**Recommended sequencing:** offline editor + playtest handoff first (no server, no
DB, no auth). Add `maps_routes` + Postgres only once you know you want shared maps.

**Note:** `src/render/voxel_terrain.ts` is explicitly a verification-only
prototype upstream, not the live path. Do not mistake it for a terrain upgrade.

---

## 3. Character builder

**Verdict: mixed. Your fork is already ahead in one direction and behind in another.**

The core surprise: `src/ui/character_appearance.ts` is **byte-identical** between
the two trees. Upstream did not rebuild character creation around body sliders.
Growverse actually went further here already: `src/render/characters/custom_bodies.generated.ts`
and the `scripts/rig/*` pipeline (9 files) are **fork-only**. Upstream has no
equivalent.

What upstream added instead is a **weapon skin / transmog and rig-quality** stack:

| Upstream module | What it buys you |
|---|---|
| `src/sim/content/weapon_skins.ts` (322) + `weapon_skin_rules.ts` (292) | The skin catalog and equip rules |
| `src/ui/char_skin_window.ts` | The transmog window |
| `characters/weapon_skin_materials.ts` | Material lifecycle for displayed skins |
| `characters/skin_attack.ts` | Skin-driven attack-clip substitution (a bow skin swaps the crossbow shot) |
| `characters/weapon_grip.ts`, `held_item_grips.ts`, `back_grips.ts` | Per-weapon grip nudges, back-carry transforms for sheathed weapons |
| `characters/stow_transition.ts` | Sheathe state machine (defers hands-to-back swap to the gesture midpoint) |
| `characters/preview_appearance.ts`, `preview_framing.ts`, `preview_policy.ts` | Creation-screen turntable resolution and framing |
| `characters/portrait_framing.ts` | Headshot chip vs 3/4 body framing (Inspect window) |
| `characters/halo.ts` | Class halo (priest Light), shared caches |
| `characters/rig_merge.ts`, `skin_gpu_layout.ts`, `skeleton_update_cache.ts` | Merges KayKit body-part SkinnedMeshes to one draw per material; compacts bone textures |
| `characters/visual_pool_policy.ts`, `skinned_sort_spheres.ts`, `dequantize_attribute.ts` | Crowd-scale rig perf |

Scale of the divergence: `characters/visual.ts` went 741 to 2090 lines,
`preview.ts` 363 to 611.

### Recommendation

Split it in two:

- **Take the perf/quality half now** and independently: `rig_merge.ts`,
  `skin_gpu_layout.ts`, `weapon_grip.ts`, `back_grips.ts`, `stow_transition.ts`,
  `portrait_framing.ts`, `halo.ts`. These are pure or near-pure, individually
  tested upstream, and they make your existing characters look and run better
  with no content work. `rig_merge` in particular collapses per-body-part draw
  calls, which is real frame budget back.
- **Treat the weapon-skin/transmog half as a feature decision**, not a port. It
  needs its own item catalog, a UI window, and an unlock economy. It is worth
  it, but scope it as new Growverse content rather than lifting upstream's
  catalog, since your item and rarity tables have diverged.
- **Do not port upstream's `character_appearance.ts`.** It is identical, and your
  `custom_bodies` work sits on top of it. Anything you take from
  `preview_appearance.ts` needs reconciling with your custom body path.

---

## 4. Visual upgrades

**Verdict: this is the biggest bucket and the one to cherry-pick hardest. Do not
try to take it whole.**

205 new files under `src/render/`. They fall into six groups. The shared files
also moved a lot: `terrain.ts` 745 to 1847, `foliage.ts` 1807 to 3207,
`gfx.ts` 771 to 1580, `water.ts` 219 to 731, `sky.ts` 470 to 823, `vfx.ts` 719 to 1779.

### 4a. Post-processing (small, self-contained, high visual return)

Upstream split the monolithic `post.ts` into `post_composer.ts` (85),
`post_bloom.ts` (121), `post_n8ao.ts` (271), `post_output_grade.ts` (201),
`post_plan_core.ts`. The composer is a pinned r165 adapter that resizes pixel
ratio and logical dimensions in one pass and **collapses the spare ping-pong
target when the final pass renders straight to canvas**, which is a straight
memory and bandwidth win.

Plus `dynamic_resolution_core.ts` (101), `gfx_aa_policy_core.ts`,
`gfx_override_core.ts`, `compile_gate.ts`, `shadow_pass_gate_core.ts`.

**Take this. It is ~800 lines, no new deps, and it is the cheapest visible upgrade
after the ability VFX.**

### 4b. Terrain and streaming

`terrain_chunk_build.ts`, `terrain_chunk_pool.ts`, `terrain_chunk_worker.ts`
(off-main-thread chunk meshing), `terrain_mesh_height.ts`,
`terrain_region_core.ts`, `terrain_splat_presence_core.ts`,
`chunk_residency_core.ts`, `zone_streaming.ts` (134),
`resident_scenery_core.ts`, `perceptual_lod_core.ts`.

**Medium risk.** This is coupled to upstream's zone layout, which is exactly where
Growverse diverged (you have `zone4`, `hollowmere`, the cannabis/stoner starter
redesign; upstream added amberfall, drakelands, evergarden, farshore, frostveil,
galecrest, nightbloom, palmreach, wildheart, willowfen, wraithwood, yumi). Port the
**chunk worker and residency cores**, which are zone-agnostic. Leave
`zone_streaming.ts` until your zone table is stable.

### 4c. Water

`water_core.ts`, `water_simulation.ts` (590: sleeping GPU height field,
facing-aligned character volume wakes), `water_flora.ts` +
`water_flora_shader_core.ts`, `sea_mist_core.ts`, `fishing_bobber.ts` +
`fishing_bobber_core.ts`.

**High value for Growverse specifically**, given you have your own fishing system.
`water_simulation.ts` is self-contained and reads sim heights through the same
`terrainHeight` invariant you already honor. The fishing bobber modules may
conflict with your `src/render/fishing.ts`; diff before lifting.

### 4d. Foliage and ground detail

`blade_grass.ts` (376) + `blade_grass_dense_core.ts`, `foliage_lod.ts` (230),
`foliage_collapse.ts`, `foliage_core.ts`, `foliage_shader_core.ts`,
`canopy_detail.ts`, `grass_cap_collapse_core.ts`, `detail_normals.ts` (47),
`cliff_scree.ts`, `worn_stone.ts`, `realm_flora.ts`.

**Take `detail_normals.ts` and `blade_grass.ts` early**: tiny, and they are the
difference between flat ground and ground that reads as a surface. `foliage_lod.ts`
pairs with your existing 1807-line `foliage.ts` and needs a careful diff.

### 4e. Lighting, sky, atmosphere

`day_night_clock.ts` + `day_night_core.ts` (227), `frost_sky.ts`,
`env_prefilter_core.ts`, `environment_transition_core.ts`, `light_pulses.ts`,
`point_light_budget.ts` + `point_light_shader_core.ts`,
`vertex_color_emissive.ts`, `pbr_fragment_shader.ts`.

**A day/night cycle is the single most noticeable visual change on this list**, and
`day_night_core.ts` is a pure 227-line core. Strong candidate. Note it is
gameplay-visible, so check it against your graphics-settings fairness invariant
before shipping it behind a tier knob.

### 4f. Render performance plumbing

`crowd_lod.ts`, `occluder_fade.ts` + `_core`, `instanced_occluder_ghosts.ts`,
`opaque_draw_order_core.ts`, `draw_stats_core.ts`, `scene_census_core.ts`,
`idle_queue.ts`, `prewarm_pass.ts` / `prewarm_policy.ts` / `prewarm_resume.ts`,
`texture_upload.ts`, `geometry_bake_clone.ts`, `exact_index_geometry.ts`,
`shared_resource.ts`, `vfx_pool_core.ts`, `view_candidate_pool_core.ts`,
`renderer_frame_telemetry_core.ts`, `software_renderer.ts`.

Plus asset-side: `assets/ktx2_support.ts` (compressed textures),
`assets/hdr_decode_worker.ts`, `assets/load_retry.ts`, `assets/residency_budget.ts`,
and a shipped `public/basis/` transcoder.

**Take `assets/load_retry.ts` and `assets/residency_budget.ts` now** (cheap,
strictly better boot reliability). **KTX2 is a bigger commitment**: it means the
Basis transcoder, a patched CSP-safe build (`scripts/patch_basis_transcoder.mjs`),
and re-encoding your textures. Worth it eventually for mobile, not first.

### 4g. Asset payload (the hidden cost)

New upstream assets, not counting anything Growverse already has:

| Directory | New bytes |
|---|---|
| `public/audio` | 136 MB |
| `public/env` | 121 MB (HDRIs) |
| `public/models` | 68 MB |
| `public/textures` | 55 MB |
| `public/ui` | 26 MB |

Most of `public/models` and `public/env` is upstream's new zone content, which you
do not want. **Pull assets per-module as each port demands them**, never in bulk.

---

## 5. Spells, talents, and combat systems

Beyond the VFX, upstream substantially expanded the combat sim.

- `src/sim/content/classes.ts`: 3757 to 6636 lines. **270 abilities upstream vs
  166 in Growverse.**
- New talent architecture: `talent_abilities_v2.ts` + `_a` + `_b` (656 lines),
  `talent_rows.ts`, `choice_rows.ts`, `choice_rows_classic.ts`, `warrior_rows.ts`,
  `spec_baselines.ts` (spec power floors).
- 30 new `src/sim/combat/` modules, including: `fire_mage.ts`, `frost_mage.ts`,
  `frozen_orb.ts`, `glacial_front.ts`, `ring_of_frost.ts`, `chronomancy.ts`,
  `temporal_hourglass.ts`, `rewind.ts`, `warrior_stances.ts`,
  `warrior_hit_table.ts`, `heroic_leap.ts`, `hunter_trap.ts`, `ranged_shot.ts`,
  `forms.ts`, `natures_fury.ts`, `mass_resurrection.ts`,
  `greater_invisibility.ts`, `aura_stacking.ts`, `dot_mutation.ts`,
  `equip_procs.ts`, `set_procs.ts`, `talent_procs.ts`, `sure_crit.ts`,
  `tank_crit_immunity.ts`, `area_echo.ts`, `convergence.ts`, `haste_burst.ts`,
  `group_targeting.ts`, `damage_history.ts`, `resurrection_offer.ts`.
- Matching render visuals: `frozen_orb_fx.ts`, `glacial_front_visual.ts`,
  `ring_of_frost_visual.ts`, `frost_nova_root_visual.ts`, `ice_block_visual.ts`,
  `mage_barrier_visual.ts`, `mage_ground_fx.ts`, `fireball_travel_visual.ts`,
  `temporal_hourglass_visual.ts`, `warrior_cast_fx_core.ts` + `_painter.ts`,
  `ground_aim_reticle_core.ts` + `_visual.ts`, `player_aura_rings.ts` + `_core`.

**Verdict: this is the riskiest bucket and the one to be most selective about.**

The `src/sim/combat/*` modules sit behind the `SimContext` seam, which is the good
news. But your `sim.ts` is 6057 lines against upstream's 10472, and the seam has
almost certainly moved. Each module is an individual port with its own balance
implications, and the repo invariant is that gameplay math follows real
classic-era formulas, so you cannot half-port a hit table.

**Recommended order:**

1. **The visual-only ones first**, since they need no sim change if you already
   have the ability: `ground_aim_reticle_*`, `player_aura_rings*`,
   `warrior_cast_fx_*`. These are pure presentation.
2. **`spec_baselines.ts`** next: it is a data table (spec power floors) and it
   fixes the "passives feel meaningless" problem that the Talents 2.0 transition
   created upstream. If your fork inherited that transition, you inherited the bug.
3. **Individual spell mechanics you actually want** (`frozen_orb`, `ring_of_frost`,
   `heroic_leap`, `warrior_stances`), one per PR, each with the sim module, the
   render visual, and its test together.
4. **Do not bulk-port `talent_abilities_v2*` or `choice_rows*`.** That is a whole
   talent-system swap and you have your own `talents.ts`, `talents_classic.ts`,
   `talents_warrior.ts` plus fork-only `augments.ts` and `genetics.ts` to
   reconcile.

---

## 6. Other upstream work worth knowing about

Not asked for, but it exists and may matter:

- **`src/sim/content/mounts.ts` (339) + `src/render/mount_visuals.ts` (99) +
  `mount_beacon.ts`.** A mount system. Self-contained, high player value.
- **Professions 2.0**: `professions.ts`, `profession_items.ts`, `recipes.ts`,
  `gather_nodes.ts`, `enchants.ts`, plus render `stations.ts`, `gather_nodes.ts`,
  `artisan_row_props.ts`. **Direct overlap with your `cultivation.ts` /
  `genetics.ts` / `crafting.ts` / `gathering.ts`.** Read it for design ideas
  rather than porting it; you will likely find your grow loop maps onto its
  station/recipe/tier scaffolding.
- **Delves and Rifts**: `src/sim/delves/`, `src/sim/content/rift/`,
  `dungeon_difficulty.ts`, `dungeon_finder.ts`, `heroic_variants.ts`. A repeatable
  endgame loop.
- **Deeds/titles** (`deeds.ts`, `deeds_completion.ts`, `account_flair.ts`),
  **mail** (`mail/post_office.ts`, `mailboxes.ts`), **bank/bags**
  (`bank.ts`, `bags.ts`), **PvP honor**, **graveyards**, **card minigame**,
  **Vale Cup** (a full sports minigame with its own stadium render stack).
- **Infrastructure you probably want regardless:** `assets/load_retry.ts`,
  `src/game/entry_crash_guard.ts`, `src/game/startup_graphics_safety.ts`,
  `src/game/software_render_notice.ts`, `src/game/offline_mode_gate.ts`,
  `prom-client` server metrics.
- **Things to deliberately skip:** `@reown/appkit` + `tweetnacl` +
  `wallet_handoff*` (Solana wallet), `@aws-sdk/client-sesv2` (transactional
  email), `server/steam/` and `server/epic/`, `@capgo/capacitor-updater` OTA.
  Also note upstream moved to `typescript@6` / `@typescript/native`; do not follow
  that unless you want the toolchain churn.

---

## 7. Recommended order of work

Ranked by value delivered per unit of risk.

| # | Work | Effort | Risk | Why |
|---|---|---|---|---|
| 1 | **Ability VFX system** | ~2 days | Low | 155/157 of your abilities already have authored specs. Degrades safely to today's behavior. Transforms how combat looks. |
| 2 | **Post-processing split + dynamic resolution** | ~1 day | Low | ~800 lines, no deps, immediate visual and memory win. |
| 3 | **`detail_normals` + `blade_grass` + `day_night_core`** | ~2 days | Low | The three cheapest "this looks like a different game" changes. |
| 4 | **Character rig perf half** (`rig_merge`, `skin_gpu_layout`, grips, `stow_transition`, `halo`, `portrait_framing`) | ~2 days | Low | Pure/near-pure, individually tested, real draw-call savings. |
| 5 | **Asset reliability** (`load_retry`, `residency_budget`, `entry_crash_guard`) | ~half day | Low | Fewer blank-screen boots on mobile. |
| 6 | **Water simulation** | ~2 days | Medium | Big payoff given your fishing loop; watch the `fishing.ts` overlap. |
| 7 | **Map editor, offline phase** (no server, playtest handoff only) | ~1 week | Medium | Needs `setActiveWorldContent`, `placed_assets`, `custom_world_props`, `map_doc`, a new Vite entry. |
| 8 | **Visual-only combat FX** (`ground_aim_reticle`, `player_aura_rings`, `warrior_cast_fx`) | ~2 days | Medium | Presentation only, no sim change. |
| 9 | **`spec_baselines.ts`** | ~1 day | Medium | Data table; fixes a real balance gap if you inherited Talents 2.0. |
| 10 | **Terrain chunk worker + residency cores** | ~3 days | Medium | Zone-agnostic parts only. Skip `zone_streaming` until zones settle. |
| 11 | **Mounts** | ~3 days | Medium | Self-contained, high player value. |
| 12 | **Individual spell mechanics**, one per PR | ongoing | Medium | Each needs sim module + visual + test together. |
| 13 | **Map editor server + Postgres** | ~1 week | High | Two new tables, auth, upload handling. Only if you want shared maps. |
| 14 | **Weapon skins / transmog** | ~1 week | High | Treat as new Growverse content, not a port; item tables have diverged. |
| 15 | **Talents v2 / choice rows** | large | High | Whole-system swap against your `augments` + `genetics`. Probably never. |

---

## 8. Standing rules for every port in this document

- **Never bulk-copy into a coordinator.** `hud.ts`, `sim.ts`, `main.ts`, and
  `renderer.ts` are extraction targets. Land each port as its own sibling module
  and leave the coordinator a thin consumer.
- **Register every new `*_core` / `*_view`.** `tests/architecture.test.ts` sweeps
  `RENDER_PURE_CORES` and `UI_PURE_CORES` and fails CI on unregistered files.
- **Sim purity survives the port.** No DOM, no Three, no `Math.random`,
  no `Date.now` in anything landing under `src/sim/`.
- **Take the upstream tests with the code.** Every module cited above has a
  matching `tests/*.test.ts` upstream. Porting the module without its test
  discards most of the value.
- **English-only i18n adds**, into the matching `src/ui/i18n.catalog/<domain>.ts`.
  Never touch `src/ui/i18n.locales/*`.
- **Assets per-module, never in bulk.** 406 MB of new upstream assets exist and
  most of it belongs to zones you do not want.
- **Re-check graphics-settings fairness** on anything tier-gated, especially the
  day/night cycle and the VFX quality tiers. A tier may shed cosmetic richness,
  never actionable information.

## 9. Reproducing this review

```
git clone https://github.com/levy-street/world-of-claudecraft.git /tmp/upstream
git -C /tmp/upstream ls-files src public scripts server headless | sort > up.txt
git ls-files src public scripts server headless | sort > fork.txt
comm -23 up.txt fork.txt   # upstream-only
comm -13 up.txt fork.txt   # growverse-only
```

The upstream directory-local `CLAUDE.md` files are the best entry points:
`src/render/CLAUDE.md`, `src/render/ability_vfx/CLAUDE.md`,
`src/render/characters/CLAUDE.md`, `src/editor/CLAUDE.md`.
