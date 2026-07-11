# Custom character pipeline (Tier C): a fully-unique body on the default rig

You can ship a character that looks nothing like the default classes yet animates
exactly as cleanly, by reusing the one thing that actually carries the motion: the
**KayKit `Rig_Medium` skeleton**. Skin any humanoid mesh to that skeleton and it
inherits the full hand-authored clip set (walk, run, attacks, cast, sit, emotes) for
free. The Combat Mech (`CombatMech.glb`) is the proof: a robot, geometrically unlike the
KayKit humans, rigged to the identical 23-joint skeleton, so it plays every KayKit clip.

This is "Tier C" in the redress ladder:

- **Tier A, reskin:** same mesh, new texture atlas (`SKINS` in `manifest.ts`). New look,
  same silhouette. No new geometry.
- **Tier B, redress:** same mesh plus bolt-on accessory GLBs (`show` / `attach`). New
  silhouette, still the default body underneath.
- **Tier C, new body:** a brand-new mesh skinned to the same skeleton. Fully unique, and
  the subject of this doc.

## The easy path: bring an UNRIGGED mesh (auto-rig)

You do not have to rig the mesh yourself. `scripts/rig/autorig_mesh.mjs`
(`npm run rig:auto -- <input.glb> <out.glb>`) takes a plain static humanoid mesh with NO
bones and NO animation, weights every vertex onto the `Rig_Medium` skeleton by proximity
to the bone segments (a smooth inverse-distance blend, so joints bend instead of crack),
preserves the mesh's UVs + base-color texture, and keeps the donor's clips. Out comes a
character that plays the full clean clip set. Proven on a Meshy "Azure Wizard" export: idle
/ walk / run / melee / cast all deform cleanly.

**Input requirements (auto-rig quality tracks how well the input matches these):**

- A single humanoid mesh, GLB, Y-up, facing +Z, standing.
- A T-pose or light A-pose (arms out to the sides, not glued down). Meshy's default T-pose
  export is ideal. The further the arms are from horizontal, the rougher the arm weights.
- Roughly humanoid proportions (the script feet-aligns + height-scales to the skeleton, but
  does not re-pose limbs).
- Textures embedded in the GLB (Meshy "with texture" export).

Then: `npm run rig:auto -- in.glb public/models/chars/custom/name.glb`, preview it with
`render_preview.mjs`, and register a `VisualDef`. Auto-rig is best-effort: a clean
single-mesh export rigs well; an unusual pose or a multi-part mesh may need the manual
Blender path below instead. Always eyeball the preview before shipping.

## The rule that makes it work

Animation clips target bones by NAME. If your mesh is weighted to a skeleton whose bones
carry the exact same names as the donor's, the donor's clips retarget onto it with no
per-character animation work. Reuse the skeleton; change everything else (mesh,
proportions within reason, materials, textures, accessories).

## The canonical `Rig_Medium` skeleton (23 joints)

Your custom mesh must be weighted to bones with these exact names (this is the set the
clips drive; it is what `rig:validate` checks). Regenerate this list any time from a
donor with `node scripts/rig/validate_skeleton.mjs <any-mesh.glb>` (the FAIL report lists
every bone the candidate is missing):

```
root, hips, spine, chest, head,
upperarm.l, upperarm.r, lowerarm.l, lowerarm.r, wrist.l, wrist.r, hand.l, hand.r,
handslot.l, handslot.r,
upperleg.l, upperleg.r, lowerleg.l, lowerleg.r, foot.l, foot.r, toes.l, toes.r
```

`handslot.l` / `handslot.r` are the weapon grips: `VisualDef.attach` bolts a weapon or
prop onto them. Note GLTF sanitizes the dot form, `handslot.r` becomes `handslotr` at
load, and the renderer's `attach` resolver tries both, so author whichever your tool
emits.

## The workflow

### 1. Get your mesh into a GLB

Model it however you like (Blender, a marketplace asset, or a Meshy/AI mesh). The only
requirement is a roughly humanoid shape so a humanoid walk cycle fits.

If you have FBX, `scripts/combine_fbx_to_glb.mjs` converts (and can graft clips); see
`scripts/CLAUDE.md`.

### 2. Rig it to the KayKit skeleton (the one step that matters)

In Blender:

1. Import a donor GLB (`public/models/chars/players/knight.glb`) to get the `Rig_Medium`
   armature.
2. Delete the donor's mesh, keep its armature.
3. Weight-paint your mesh to that armature (or parent with automatic weights, then clean
   up). Do NOT rename the bones.
4. Export your mesh + the armature as `public/models/chars/players/<name>.glb`.

Do NOT let an auto-rigger (Meshy and friends) generate its OWN skeleton, that is exactly
what produced the mushy walk on the retired `wizard.glb` / `ashen_raider.glb`. The mesh
was fine; the foreign rig was not. Let `Rig_Medium` own the rig.

### 3. Validate skeleton compatibility (fails loudly)

```
npm run rig:validate -- public/models/chars/players/<name>.glb
```

Exit 0 means every animated bone is present and the clips will retarget cleanly. Exit 1
prints exactly which bones are missing, re-rig those and re-export. (A different donor:
`npm run rig:validate -- <mesh.glb> <donor.glb>`.)

### 4. Give it the clip set

If you exported your mesh with the donor's actions already attached, it carries its own
clips and you can skip this. Otherwise bake them on:

```
npm run rig:bake -- public/models/chars/players/<name>.glb
```

This validates first (refuses below 100% coverage unless `--force`), then copies every
donor clip onto your identically-named bones and rewrites the GLB in place. It is
idempotent, re-running never duplicates clips. Mesh, materials, skin, and node graph are
untouched; only animation data changes.

### 5. Register it in the manifest

Add a `VisualDef` to `VISUALS` in `src/render/characters/manifest.ts`. A minimal player
body:

```ts
player_myclass: {
  url: `${PLAYERS}/myname.glb`,
  height: HUMANOID_H,
  clips: kaykit(['1H_Melee_Attack_Chop']), // the KayKit clip names now resolve
  // optional redress on top of the new body:
  show: ['Some_Accessory_Node'],           // KEEP-list for non-skinned accessory meshes
  attach: [{ url: `${WEAPONS}/staff.glb`, bone: 'handslot.r' }],
  weaponSlots: [0],                         // swap the mainhand to the equipped weapon
  tint: 0x3b6fd6,
  tintStrength: 0.4,
},
```

Then wire dispatch so entities resolve to it (`visualKeyFor`): a player class key is
`player_<class>`; a mob routes via `MOB_KEYS` / `FAMILY_KEYS`; an NPC via `NPC_KEYS`.
`manifestUrls()` auto-preloads the `url` and every `attach[].url`, so no preload wiring is
needed.

### 6. Regenerate the guide and run the gates

```
npm run wiki:content     # if the body is player-facing content
npm run wiki:stills      # render its /wiki still (needs a browser; BROWSER_PATH=...)
npx vitest run tests/held_weapon_models.test.ts tests/render_asset_preload.test.ts tests/guide.test.ts
```

## Boundaries (what you do NOT get for free)

- **A different skeleton loses the default clips.** The clips are bound to
  `Rig_Medium`'s bone names. Keep the skeleton; swap the mesh.
- **Radically non-humanoid shapes** (quadruped, no legs, floating blob) will not fit a
  humanoid walk cycle, they need their own rig and clips (this is why creatures use the
  Quaternius / spider / floating rigs). Roughly humanoid proportions are the sweet spot.
- **A new bone that animates on its own** (a tail that wags with its own motion) needs a
  new clip authored, the baked donor clips do not drive bones the donor lacks. A tail as
  a rigid `attach` mesh, or weighted to an existing spine bone, is fine.

## Previewing a candidate mesh

`node scripts/rig/render_preview.mjs <out-dir> <public-relative-url...>` renders a posed
still of any character GLB through the real Guide viewer. Because it advances the idle
clip, it doubles as a skinning correctness check: a correctly rigged body poses naturally,
a mis-rigged one renders blank or collapsed. Use it to sanity-check a mesh before wiring it
into the manifest.

## Files

- `scripts/rig/skeleton_diff.mjs`, pure bone-set comparison (`compareSkeletons`), unit
  tested in `tests/rig_skeleton_diff.test.ts`.
- `scripts/rig/render_preview.mjs`, posed-still preview of arbitrary character GLBs.
- `scripts/rig/validate_skeleton.mjs` (`npm run rig:validate`), reads GLBs and reports
  compatibility; exit 1 on a mismatch.
- `scripts/rig/bake_clips.mjs` (`npm run rig:bake`), the general donor to target clip
  baker with the validation gate.
- `scripts/bake_mech_anims.mjs`, the original mech-specific entry, now a thin wrapper
  over `bake_clips.mjs`.
