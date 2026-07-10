<!-- scripts/rig/: the Tier C custom-character rigging pipeline.
     Parent scripts/CLAUDE.md covers the .mjs conventions; don't repeat them. -->

# scripts/rig/: custom-character (Tier C) pipeline

Tooling to put a fully-custom body on the shared KayKit `Rig_Medium` skeleton so it
inherits the default clean animation clips. The full workflow (Blender rigging, manifest
registration, gotchas) lives in `docs/design/custom-character-pipeline.md`; this is the
code map.

## Files
- `skeleton_diff.mjs`: PURE bone-set comparison (`compareSkeletons`, `formatSkeletonDiff`).
  No file IO, so `tests/rig_skeleton_diff.test.ts` imports it directly. Its `.d.mts`
  companion exists only so the tsc-checked test can import a plain-ESM script; keep the
  two in sync.
- `validate_skeleton.mjs` (`npm run rig:validate`): reads a candidate + donor GLB, and
  reports whether the candidate carries every bone the donor animates. **Exit 1 on a
  mismatch** (this is the loud gate). Exports `makeIO` / `animatedBoneNames` /
  `allNodeNames` for reuse; importing it has NO side effects (the CLI `main` runs only
  when invoked as the entry script).
- `bake_clips.mjs` (`npm run rig:bake`): the general donor to target clip baker. Validates
  first (refuses below `--min-coverage`, default 1, unless `--force`), then copies every
  clip onto identically-named bones and rewrites the target in place. Idempotent.

## Conventions
- The donor defaults to `public/models/chars/players/knight.glb` (the `Rig_Medium` clip
  reference). Any player-body GLB carries the same clip set.
- Bones are matched by NAME. The set that matters is the donor's ANIMATED bones (nodes
  targeted by animation channels), not every node, so `bake`/`validate` compare against
  `animatedBoneNames(donorDoc)`, not the full node list.
- GLB IO goes through `makeIO()` (gltf-transform `NodeIO` + the meshopt codec, since donor
  GLBs are meshopt-compressed). Reuse it; do not re-register the codec ad hoc.

## Never
- Don't rename or renumber the `Rig_Medium` bones; the clips bind to those exact names.
- Don't let an auto-rigger own the skeleton (that is the mushy-animation trap the retired
  Meshy bodies fell into). Rig the mesh TO `Rig_Medium`.
- Keep new logic in the pure `skeleton_diff.mjs` where it can be unit-tested; the other
  two files stay thin IO + CLI consumers.
