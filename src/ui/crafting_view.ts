// Pure, host-agnostic view model for the crafting window (Grow Station /
// Upgrade Bench).
//
// The pure-core half of the pure-core + thin-consumer split (root CLAUDE.md
// Conventions; reference vendor_view.ts). It owns the one thing the crafting
// window decides that is worth testing without a DOM: which recipes belong to
// the open station, grouped by category in declaration order, and for each
// recipe whether the player has the reagents, can afford the copper, and meets
// the level gate. The DOM/i18n side lives in crafting_window.ts.
//
// DOM-free and i18n-free so tests/crafting_view.test.ts can drive it directly.
// It mirrors the server-authoritative gate in sim/crafting.ts (materials, copper,
// level); the server always re-validates, so this is purely presentational.

import type { CraftRecipe, CraftStation, ItemDef } from '../sim/types';

export interface CraftInputRow {
  itemId: string;
  item: ItemDef;
  need: number;
  have: number;
  enough: boolean;
}

export interface CraftRow {
  recipeId: string;
  output: ItemDef;
  outputCount: number;
  copperCost: number;
  requiredLevel?: number;
  inputs: CraftInputRow[];
  /** Every reagent is present in sufficient quantity. */
  hasMaterials: boolean;
  /** Player copper covers the recipe cost. */
  canAfford: boolean;
  /** Player level meets the recipe's requiredLevel (true when there is none). */
  meetsLevel: boolean;
  /** All three gates pass: the Craft button is enabled. */
  craftable: boolean;
}

export interface CraftCategory {
  category: string;
  rows: CraftRow[];
}

export interface CraftingView {
  station: CraftStation;
  categories: CraftCategory[];
}

/**
 * Build the structured crafting view for one station.
 *
 * Recipes are filtered to the open station and grouped by `category`, preserving
 * the order each category first appears in the recipe list (so authoring order in
 * content/crafting.ts drives the on-screen section order). A recipe whose output or
 * any input is missing from the item table is skipped defensively (never happens
 * with valid data, but keeps the painter total-key-safe). `countOf` resolves the
 * player's owned quantity of an item id; `playerLevel`/`playerCopper` gate craftability.
 */
export function buildCraftingView(
  station: CraftStation,
  recipes: readonly CraftRecipe[],
  items: Record<string, ItemDef>,
  countOf: (itemId: string) => number,
  playerCopper: number,
  playerLevel: number,
): CraftingView {
  const order: string[] = [];
  const byCategory = new Map<string, CraftRow[]>();

  for (const recipe of recipes) {
    if (recipe.station !== station) continue;
    const output = items[recipe.output.itemId];
    if (!output) continue;

    const inputs: CraftInputRow[] = [];
    let missingInput = false;
    let hasMaterials = true;
    for (const inp of recipe.inputs) {
      const item = items[inp.itemId];
      if (!item) {
        missingInput = true;
        break;
      }
      const have = countOf(inp.itemId);
      const enough = have >= inp.count;
      if (!enough) hasMaterials = false;
      inputs.push({ itemId: inp.itemId, item, need: inp.count, have, enough });
    }
    if (missingInput) continue;

    const canAfford = playerCopper >= recipe.copperCost;
    const meetsLevel = recipe.requiredLevel === undefined || playerLevel >= recipe.requiredLevel;
    const row: CraftRow = {
      recipeId: recipe.id,
      output,
      outputCount: recipe.output.count,
      copperCost: recipe.copperCost,
      requiredLevel: recipe.requiredLevel,
      inputs,
      hasMaterials,
      canAfford,
      meetsLevel,
      craftable: hasMaterials && canAfford && meetsLevel,
    };

    let bucket = byCategory.get(recipe.category);
    if (!bucket) {
      bucket = [];
      byCategory.set(recipe.category, bucket);
      order.push(recipe.category);
    }
    bucket.push(row);
  }

  return {
    station,
    categories: order.map((category) => ({
      category,
      rows: byCategory.get(category) as CraftRow[],
    })),
  };
}
