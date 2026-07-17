import { describe, expect, it } from 'vitest';
import type { InvSlot, ItemDef } from '../src/sim/types';
import { buildVendorView } from '../src/ui/vendor_view';

// Minimal ItemDef fixtures: buildVendorView only reads id / buyValue /
// growPrice / sellValue.
function item(
  id: string,
  opts: { buyValue?: number; growPrice?: number; sellValue?: number; kind?: ItemDef['kind'] } = {},
): ItemDef {
  return {
    id,
    name: id,
    quality: 'common',
    kind: opts.kind ?? 'junk',
    slot: 'trinket',
    sellValue: opts.sellValue ?? 0,
    buyValue: opts.buyValue,
    growPrice: opts.growPrice,
  } as unknown as ItemDef;
}

function table(...items: ItemDef[]): Record<string, ItemDef> {
  return Object.fromEntries(items.map((i) => [i.id, i]));
}

describe('buildVendorView goods', () => {
  it('lists vendor items that exist and have a buyValue, in order', () => {
    const items = table(item('bread', { buyValue: 5 }), item('water', { buyValue: 2 }));
    const view = buildVendorView(['bread', 'water'], [], items);
    expect(view.goods.map((g) => g.itemId)).toEqual(['bread', 'water']);
    expect(view.goods.map((g) => g.price)).toEqual([5, 2]);
  });

  it('tags food/drink goods with a stack quantity of 5, other goods with 1', () => {
    const items = table(
      item('bread', { buyValue: 5, kind: 'food' }),
      item('water', { buyValue: 2, kind: 'drink' }),
      item('potion', { buyValue: 9, kind: 'potion' }),
    );
    const view = buildVendorView(['bread', 'water', 'potion'], [], items);
    expect(view.goods.map((g) => g.quantity)).toEqual([5, 5, 1]);
    // Price is the total for the purchase: per-unit buyValue times the stack quantity.
    expect(view.goods.map((g) => g.price)).toEqual([25, 10, 9]);
  });

  it('skips items missing from the table', () => {
    const items = table(item('bread', { buyValue: 5 }));
    const view = buildVendorView(['bread', 'ghost'], [], items);
    expect(view.goods.map((g) => g.itemId)).toEqual(['bread']);
  });

  it('skips items with no or zero buyValue (priceless items are never sold)', () => {
    const items = table(
      item('bread', { buyValue: 5 }),
      item('quest_token'),
      item('free', { buyValue: 0 }),
    );
    const view = buildVendorView(['bread', 'quest_token', 'free'], [], items);
    expect(view.goods.map((g) => g.itemId)).toEqual(['bread']);
  });

  it('returns empty goods for an empty vendor', () => {
    expect(buildVendorView([], [], {}).goods).toEqual([]);
  });

  it('tags copper goods with priceKind copper', () => {
    const items = table(item('bread', { buyValue: 5 }));
    const view = buildVendorView(['bread'], [], items);
    expect(view.goods[0].priceKind).toBe('copper');
  });
});

describe('buildVendorView $GROW goods', () => {
  it('lists a grow-priced item as a first-class row (single unit, grow amount)', () => {
    const items = table(
      item('bread', { buyValue: 5 }),
      item('reins', { growPrice: 100, kind: 'mount' }),
    );
    const view = buildVendorView(['bread', 'reins'], [], items);
    expect(view.goods.map((g) => g.itemId)).toEqual(['bread', 'reins']);
    expect(view.goods[1]).toEqual({
      itemId: 'reins',
      item: items.reins,
      priceKind: 'grow',
      price: 100,
      quantity: 1,
    });
  });

  it('grow pricing wins over a copper buyValue (mirrors the sim buy path)', () => {
    const items = table(item('reins', { buyValue: 40000, growPrice: 100, kind: 'mount' }));
    const view = buildVendorView(['reins'], [], items);
    expect(view.goods[0].priceKind).toBe('grow');
    expect(view.goods[0].price).toBe(100);
    expect(view.goods[0].quantity).toBe(1);
  });

  it('never stacks a grow-priced staple (a single unit even for food/drink kinds)', () => {
    const items = table(item('glowbread', { growPrice: 3, kind: 'food' }));
    const view = buildVendorView(['glowbread'], [], items);
    expect(view.goods[0].quantity).toBe(1);
    expect(view.goods[0].price).toBe(3);
  });

  it('sets hasGrowGoods only when a grow-priced good is stocked', () => {
    const items = table(
      item('bread', { buyValue: 5 }),
      item('reins', { growPrice: 100, kind: 'mount' }),
    );
    expect(buildVendorView(['bread'], [], items).hasGrowGoods).toBe(false);
    expect(buildVendorView(['bread', 'reins'], [], items).hasGrowGoods).toBe(true);
    expect(buildVendorView([], [], {}).hasGrowGoods).toBe(false);
  });

  it('still skips an item with neither buyValue nor growPrice', () => {
    const items = table(item('quest_token'), item('reins', { growPrice: 100, kind: 'mount' }));
    const view = buildVendorView(['quest_token', 'reins'], [], items);
    expect(view.goods.map((g) => g.itemId)).toEqual(['reins']);
  });
});

describe('buildVendorView buyback', () => {
  it('lists redeemable buyback slots with sell-value price and count', () => {
    const items = table(item('sword', { sellValue: 12 }));
    const buyback: InvSlot[] = [{ itemId: 'sword', count: 3 }];
    const view = buildVendorView([], buyback, items);
    expect(view.buyback).toEqual([{ itemId: 'sword', item: items.sword, count: 3, price: 12 }]);
  });

  it('skips slots whose item no longer exists or whose count is not positive', () => {
    const items = table(item('sword', { sellValue: 12 }));
    const buyback: InvSlot[] = [
      { itemId: 'sword', count: 1 },
      { itemId: 'ghost', count: 4 },
      { itemId: 'sword', count: 0 },
    ];
    const view = buildVendorView([], buyback, items);
    expect(view.buyback.map((b) => b.itemId)).toEqual(['sword']);
    expect(view.buyback[0].count).toBe(1);
  });

  it('reports an empty buyback list distinctly from goods', () => {
    const view = buildVendorView([], [], {});
    expect(view.buyback).toEqual([]);
  });
});

describe('buildVendorView is a pure projection', () => {
  it('returns identical structure for identical input (no hidden state)', () => {
    const items = table(item('bread', { buyValue: 5 }), item('sword', { sellValue: 12 }));
    const goodsIds = ['bread'];
    const buyback: InvSlot[] = [{ itemId: 'sword', count: 2 }];
    expect(buildVendorView(goodsIds, buyback, items)).toEqual(
      buildVendorView(goodsIds, buyback, items),
    );
  });

  // The recipe's host-parity check: the same logical vendor state produces the
  // same view whether the inputs come Sim-shaped (the live, mutable arrays the
  // offline world exposes) or ClientWorld-shaped (a frozen mirrored snapshot
  // rebuilt from the wire). buildVendorView must treat both as plain readonly
  // data, so the two builds are deep-equal.
  it('is host-agnostic: Sim-shaped and ClientWorld-shaped inputs build the same view', () => {
    const items = table(
      item('bread', { buyValue: 5, kind: 'food' }),
      item('reins', { growPrice: 100, kind: 'mount' }),
      item('sword', { sellValue: 12 }),
    );
    // Sim-shaped: live mutable arrays (the offline Sim's own state).
    const simVendorItems = ['bread', 'reins'];
    const simBuyback: InvSlot[] = [{ itemId: 'sword', count: 2 }];
    // ClientWorld-shaped: a mirrored, frozen snapshot of the same state.
    const cwVendorItems = Object.freeze([...simVendorItems]) as readonly string[];
    const cwBuyback = Object.freeze(
      simBuyback.map((s) => Object.freeze({ ...s })),
    ) as readonly InvSlot[];
    expect(buildVendorView(cwVendorItems, cwBuyback, items)).toEqual(
      buildVendorView(simVendorItems, simBuyback, items),
    );
  });
});
