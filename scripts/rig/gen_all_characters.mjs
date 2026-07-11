// Generate all 5 procedural Tier C characters into public/models/chars/custom/.
//   node scripts/rig/gen_all_characters.mjs

import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RECIPES } from './character_recipes.mjs';
import { generateCharacter } from './gen_character.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DONOR = resolve(ROOT, 'public/models/chars/players/knight.glb');
const OUT_DIR = resolve(ROOT, 'public/models/chars/custom');
mkdirSync(OUT_DIR, { recursive: true });

for (const recipe of RECIPES) {
  const outPath = resolve(OUT_DIR, `${recipe.key}.glb`);
  const info = await generateCharacter(recipe, { donorPath: DONOR, outPath });
  console.log(
    `ok ${recipe.key.padEnd(16)} "${info.name}"  ${info.verts} verts, ${info.primitives} prims`,
  );
}
console.log(`\nwrote ${RECIPES.length} characters to public/models/chars/custom/`);
