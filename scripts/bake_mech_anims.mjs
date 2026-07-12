// Bake the KayKit Rig_Medium clip set into the Combat Mech GLB.
//
// The Combat Mech (`CombatMech.glb`) is the first fully-custom body rigged to the exact
// same KayKit `Rig_Medium` skeleton as every player class (23 joints, identical bone
// names) but shipped with ZERO clips, so it rendered as a frozen T-pose. This bakes the
// donor's clips onto its identically-named bones so it becomes self-contained.
//
// This is now a thin, named wrapper around the general Tier C baker
// (scripts/rig/bake_clips.mjs); it is kept because the visual manifest and npm alias
// reference it. For any OTHER custom body use the general tool directly (or `npm run
// rig:bake -- <target.glb>`). See docs/design/custom-character-pipeline.md.
//
//   node scripts/bake_mech_anims.mjs [donor.glb] [target.glb]
//
// Defaults bake knight.glb -> CombatMech.glb in place.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bakeClipsCli } from './rig/bake_clips.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DONOR = process.argv[2] ?? resolve(ROOT, 'public/models/chars/players/knight.glb');
const TARGET =
  process.argv[3] ?? resolve(ROOT, 'public/models/chars/players/Mech/characters/CombatMech.glb');

bakeClipsCli({ target: TARGET, donor: DONOR }).catch((err) => {
  console.error(err);
  process.exit(1);
});
