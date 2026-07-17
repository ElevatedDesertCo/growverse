import { describe, expect, it } from 'vitest';
import type { CraftRecipe, ItemDef } from '../src/sim/types';
import { buildCraftingView } from '../src/ui/crafting_view';

// Minimal ItemDef fixture: buildCraftingView only carries the ItemDef through to
// the output/input slots, it reads no field of its own.
function item(id: string): ItemDef {
  return {
    id,
    name: id,
    quality: 'common',
    kind: 'junk',
    slot: 'trinket',
    sellValue: 0,
  } as unknown as ItemDef;
}

function table(...items: ItemDef[]): Record<string, ItemDef> {
  return Object.fromEntries(items.map((i) => [i.id, i]));
}

function recipe(partial: Partial<CraftRecipe> & Pick<CraftRecipe, 'id'>): CraftRecipe {
  return {
    station: 'grow',
    category: 'nutrient',
    inputs: [],
    copperCost: 0,
    output: { itemId: partial.id, count: 1 },
    ...partial,
  } as CraftRecipe;
}

const ITEMS = table(item('bloom_dust'), item('spore'), item('nutrient'), item('gear'));

describe('buildCraftingView station filtering + grouping', () => {
  it('keeps only recipes for the open station', () => {
    const recipes = [
      recipe({ id: 'nutrient', station: 'grow' }),
      recipe({ id: 'gear', station: 'upgrade', category: 'gear' }),
    ];
    const view = buildCraftingView(
      'grow',
      recipes,
      ITEMS,
      () => 0,
      0,
      1,
      () => 0,
    );
    const ids = view.categories.flatMap((c) => c.rows.map((r) => r.recipeId));
    expect(ids).toEqual(['nutrient']);
    expect(view.station).toBe('grow');
  });

  it('groups rows by category in first-seen declaration order', () => {
    const recipes = [
      recipe({ id: 'a', category: 'nutrient', output: { itemId: 'nutrient', count: 1 } }),
      recipe({ id: 'b', category: 'seed', output: { itemId: 'spore', count: 1 } }),
      recipe({ id: 'c', category: 'nutrient', output: { itemId: 'bloom_dust', count: 1 } }),
    ];
    const view = buildCraftingView(
      'grow',
      recipes,
      ITEMS,
      () => 0,
      0,
      1,
      () => 0,
    );
    expect(view.categories.map((c) => c.category)).toEqual(['nutrient', 'seed']);
    expect(view.categories[0].rows.map((r) => r.recipeId)).toEqual(['a', 'c']);
  });

  it('skips a recipe whose output or any input is missing from the item table', () => {
    const recipes = [
      recipe({ id: 'ghostOut', output: { itemId: 'missing', count: 1 } }),
      recipe({
        id: 'ghostIn',
        output: { itemId: 'nutrient', count: 1 },
        inputs: [{ itemId: 'missing', count: 1 }],
      }),
      recipe({ id: 'ok', output: { itemId: 'nutrient', count: 1 } }),
    ];
    const view = buildCraftingView(
      'grow',
      recipes,
      ITEMS,
      () => 0,
      0,
      1,
      () => 0,
    );
    const ids = view.categories.flatMap((c) => c.rows.map((r) => r.recipeId));
    expect(ids).toEqual(['ok']);
  });
});

describe('buildCraftingView per-recipe gates', () => {
  const recipes = [
    recipe({
      id: 'nutrient',
      output: { itemId: 'nutrient', count: 2 },
      copperCost: 50,
      requiredLevel: 5,
      inputs: [
        { itemId: 'bloom_dust', count: 3 },
        { itemId: 'spore', count: 1 },
      ],
    }),
  ];

  it('computes have/need + enough per input', () => {
    const counts = new Map([
      ['bloom_dust', 2],
      ['spore', 4],
    ]);
    const view = buildCraftingView(
      'grow',
      recipes,
      ITEMS,
      (id) => counts.get(id) ?? 0,
      999,
      20,
      () => 0,
    );
    const row = view.categories[0].rows[0];
    expect(row.inputs.map((i) => [i.itemId, i.have, i.need, i.enough])).toEqual([
      ['bloom_dust', 2, 3, false],
      ['spore', 4, 1, true],
    ]);
    expect(row.hasMaterials).toBe(false);
  });

  it('craftable only when materials + copper + level all pass', () => {
    const counts = new Map([
      ['bloom_dust', 3],
      ['spore', 1],
    ]);
    const countOf = (id: string) => counts.get(id) ?? 0;
    // All three gates pass.
    const ok = buildCraftingView('grow', recipes, ITEMS, countOf, 50, 5, () => 0).categories[0]
      .rows[0];
    expect(ok.craftable).toBe(true);
    expect(ok.outputCount).toBe(2);
    // Copper short.
    const poor = buildCraftingView('grow', recipes, ITEMS, countOf, 49, 5, () => 0).categories[0]
      .rows[0];
    expect(poor.canAfford).toBe(false);
    expect(poor.craftable).toBe(false);
    // Level short.
    const low = buildCraftingView('grow', recipes, ITEMS, countOf, 50, 4, () => 0).categories[0]
      .rows[0];
    expect(low.meetsLevel).toBe(false);
    expect(low.craftable).toBe(false);
  });

  it('treats a recipe with no requiredLevel as always meeting the level gate', () => {
    const noLevel = [recipe({ id: 'nutrient', output: { itemId: 'nutrient', count: 1 } })];
    const row = buildCraftingView(
      'grow',
      noLevel,
      ITEMS,
      () => 0,
      0,
      1,
      () => 0,
    ).categories[0].rows[0];
    expect(row.requiredLevel).toBeUndefined();
    expect(row.meetsLevel).toBe(true);
    expect(row.craftable).toBe(true);
  });
});

describe('buildCraftingView profession gate', () => {
  const gated = [
    recipe({
      id: 'nutrient',
      output: { itemId: 'nutrient', count: 1 },
      requiredProfession: { id: 'logging', skill: 10 },
    }),
  ];

  it('locks the recipe until the profession skill meets the gate', () => {
    const below = buildCraftingView(
      'grow',
      gated,
      ITEMS,
      () => 0,
      0,
      1,
      () => 9,
    ).categories[0].rows[0];
    expect(below.requiredProfession).toEqual({ id: 'logging', skill: 10 });
    expect(below.meetsProfession).toBe(false);
    expect(below.craftable).toBe(false);

    const atGate = buildCraftingView(
      'grow',
      gated,
      ITEMS,
      () => 0,
      0,
      1,
      () => 10,
    ).categories[0].rows[0];
    expect(atGate.meetsProfession).toBe(true);
    expect(atGate.craftable).toBe(true);
  });

  it('reads the skill for the recipe profession, not another', () => {
    // Mining is maxed but Logging (the gate) is 0: still locked.
    const skill = (id: string) => (id === 'mining' ? 100 : 0);
    const row = buildCraftingView('grow', gated, ITEMS, () => 0, 0, 1, skill).categories[0].rows[0];
    expect(row.meetsProfession).toBe(false);
  });

  it('treats a recipe with no requiredProfession as always meeting the gate', () => {
    const none = [recipe({ id: 'nutrient', output: { itemId: 'nutrient', count: 1 } })];
    const row = buildCraftingView(
      'grow',
      none,
      ITEMS,
      () => 0,
      0,
      1,
      () => 0,
    ).categories[0].rows[0];
    expect(row.requiredProfession).toBeUndefined();
    expect(row.meetsProfession).toBe(true);
  });
});
