// Pure, host-agnostic view model for the account bank (stash) window.
//
// The pure-core half of the pure-core + thin-consumer split (root CLAUDE.md
// Conventions; reference vendor_view.ts). It owns the one thing the bank window
// decides that is worth testing without a DOM: which rows are already banked
// (withdrawable) and which bag items can still be deposited. The DOM/i18n side
// lives in stash_window.ts; rendering is driven entirely off the structure
// returned here.
//
// DOM-free and i18n-free so tests/stash_view.test.ts can drive it directly.

import type { InvSlot, ItemDef } from '../sim/types';

export interface StashRow {
  itemId: string;
  item: ItemDef;
  count: number;
}

export interface StashView {
  /** Stacks currently in the bank, redeemable by withdraw. */
  banked: StashRow[];
  /** Bag stacks the player can move into the bank. */
  depositable: StashRow[];
  /** The bank is at its distinct-stack cap: new-item deposits are refused. */
  full: boolean;
}

/**
 * Build the structured bank view from raw inputs.
 *
 * A row (banked or depositable) is listed only when the item still exists in
 * the table and the stack count is positive. `full` mirrors the sim's
 * STASH_LIMIT so the window can hint before a rejected new-item deposit; the
 * server stays authoritative on the actual move.
 */
export function buildStashView(
  stashSlots: readonly InvSlot[],
  inventorySlots: readonly InvSlot[],
  items: Record<string, ItemDef>,
  stashLimit: number,
): StashView {
  const banked: StashRow[] = [];
  for (const slot of stashSlots) {
    const item = items[slot.itemId];
    if (!item || slot.count <= 0) continue;
    banked.push({ itemId: slot.itemId, item, count: slot.count });
  }
  const depositable: StashRow[] = [];
  for (const slot of inventorySlots) {
    const item = items[slot.itemId];
    if (!item || slot.count <= 0) continue;
    depositable.push({ itemId: slot.itemId, item, count: slot.count });
  }
  return { banked, depositable, full: banked.length >= stashLimit };
}
