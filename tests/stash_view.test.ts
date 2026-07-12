import { describe, expect, it } from 'vitest';
import type { InvSlot, ItemDef } from '../src/sim/types';
import { buildStashView } from '../src/ui/stash_view';

// Minimal ItemDef fixtures: buildStashView only reads id (via the table lookup)
// and the slot count; the rest of ItemDef is presentation the view passes through.
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

describe('buildStashView banked (withdrawable) rows', () => {
  it('lists bank stacks that exist and have a positive count, in order', () => {
    const items = table(item('bread'), item('sword'));
    const stash: InvSlot[] = [
      { itemId: 'bread', count: 4 },
      { itemId: 'sword', count: 1 },
    ];
    const view = buildStashView(stash, [], items, 98);
    expect(view.banked.map((b) => b.itemId)).toEqual(['bread', 'sword']);
    expect(view.banked.map((b) => b.count)).toEqual([4, 1]);
    expect(view.banked[0].item).toBe(items.bread);
  });

  it('skips bank slots whose item no longer exists or whose count is not positive', () => {
    const items = table(item('bread'));
    const stash: InvSlot[] = [
      { itemId: 'bread', count: 2 },
      { itemId: 'ghost', count: 5 },
      { itemId: 'bread', count: 0 },
    ];
    const view = buildStashView(stash, [], items, 98);
    expect(view.banked.map((b) => b.itemId)).toEqual(['bread']);
    expect(view.banked[0].count).toBe(2);
  });

  it('reports an empty bank distinctly', () => {
    expect(buildStashView([], [], {}, 98).banked).toEqual([]);
  });
});

describe('buildStashView depositable (bag) rows', () => {
  it('lists bag stacks that exist and have a positive count, in order', () => {
    const items = table(item('bread'), item('water'));
    const bags: InvSlot[] = [
      { itemId: 'water', count: 3 },
      { itemId: 'bread', count: 1 },
    ];
    const view = buildStashView([], bags, items, 98);
    expect(view.depositable.map((d) => d.itemId)).toEqual(['water', 'bread']);
    expect(view.depositable.map((d) => d.count)).toEqual([3, 1]);
  });

  it('skips bag slots whose item no longer exists or whose count is not positive', () => {
    const items = table(item('bread'));
    const bags: InvSlot[] = [
      { itemId: 'bread', count: 2 },
      { itemId: 'ghost', count: 9 },
      { itemId: 'bread', count: -1 },
    ];
    const view = buildStashView([], bags, items, 98);
    expect(view.depositable.map((d) => d.itemId)).toEqual(['bread']);
  });
});

describe('buildStashView full flag', () => {
  it('is false while the distinct-stack count is under the limit', () => {
    const items = table(item('a'), item('b'));
    const stash: InvSlot[] = [
      { itemId: 'a', count: 1 },
      { itemId: 'b', count: 1 },
    ];
    expect(buildStashView(stash, [], items, 3).full).toBe(false);
  });

  it('is true once distinct banked stacks reach the limit (new-item deposits refused)', () => {
    const items = table(item('a'), item('b'));
    const stash: InvSlot[] = [
      { itemId: 'a', count: 1 },
      { itemId: 'b', count: 1 },
    ];
    expect(buildStashView(stash, [], items, 2).full).toBe(true);
  });

  it('counts only listable banked stacks toward full (a missing item does not fill a slot)', () => {
    const items = table(item('a'));
    const stash: InvSlot[] = [
      { itemId: 'a', count: 1 },
      { itemId: 'ghost', count: 1 },
    ];
    // ghost is skipped, so banked.length is 1, under the cap of 2.
    expect(buildStashView(stash, [], items, 2).full).toBe(false);
  });
});

describe('buildStashView is a pure projection', () => {
  it('returns identical structure for identical input (no hidden state)', () => {
    const items = table(item('bread'), item('sword'));
    const stash: InvSlot[] = [{ itemId: 'sword', count: 2 }];
    const bags: InvSlot[] = [{ itemId: 'bread', count: 1 }];
    expect(buildStashView(stash, bags, items, 98)).toEqual(buildStashView(stash, bags, items, 98));
  });
});
