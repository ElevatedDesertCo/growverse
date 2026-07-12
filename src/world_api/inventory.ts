import type { EquipSlot, InvSlot } from '../sim/types';

export interface IWorldInventory {
  inventory: InvSlot[];
  vendorBuyback: InvSlot[];
  // The account bank: items parked at a stash-keeper NPC. Read for the stash
  // window; mutated only through depositToStash/withdrawFromStash.
  stash: InvSlot[];
  equipment: Partial<Record<EquipSlot, string>>;
  copper: number;
  equipItem(itemId: string): void;
  unequipItem(slot: EquipSlot): void;
  useItem(itemId: string): void;
  discardItem(itemId: string, count?: number): void;
  buyItem(npcId: number, itemId: string): void;
  sellItem(itemId: string, count?: number): void;
  // Sell every gray (poor-quality) item in the bags at once while a vendor is open.
  // Quest items and anything flagged noVendorSell are left untouched.
  sellAllJunk(): void;
  buyBackItem(itemId: string): void;
  // Move an item stack from bags into the bank (deposit) or back (withdraw),
  // both gated on standing near a stash-keeper NPC. Server-authoritative.
  depositToStash(itemId: string, count?: number): void;
  withdrawFromStash(itemId: string, count?: number): void;
}
