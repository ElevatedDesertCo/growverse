// Mounts and Stables v1 (docs/prd/mounts-and-stables.md). Data-as-code only:
// the mount registry plus the vendor items that teach each mount. Engine logic
// lives in src/sim/mounts.ts; data.ts merges these tables into MOUNTS / ITEMS.
//
// Roster note: the world has no horse model, so the stable rides the creatures
// the realm already raises (alpaca, bull, boar) plus the $GROW-exclusive
// Verdant Bloomstrider on the stag. The exclusive is cosmetic prestige only:
// same speed, same rules, never a gameplay advantage.

import type { ItemDef, MountDef } from '../types';

// Every v1 mount shares the classic ground-mount profile.
export const MOUNT_SPEED_BONUS = 0.6; // +60% ground speed
export const RIDING_LEVEL = 20;

export const MOUNT_DEFS: Record<string, MountDef> = {
  mount_alpaca: {
    id: 'mount_alpaca',
    itemId: 'reins_highfield_alpaca',
    name: 'Highfield Alpaca',
    speedBonus: MOUNT_SPEED_BONUS,
    requiredLevel: RIDING_LEVEL,
    visual: 'alpaca',
  },
  mount_bull: {
    id: 'mount_bull',
    itemId: 'reins_ironhide_bull',
    name: 'Ironhide Bull',
    speedBonus: MOUNT_SPEED_BONUS,
    requiredLevel: RIDING_LEVEL,
    visual: 'bull',
  },
  mount_boar: {
    id: 'mount_boar',
    itemId: 'reins_thornback_boar',
    name: 'Thornback Boar',
    speedBonus: MOUNT_SPEED_BONUS,
    requiredLevel: RIDING_LEVEL,
    visual: 'wild_boar',
  },
  mount_bloomstrider: {
    id: 'mount_bloomstrider',
    itemId: 'reins_verdant_bloomstrider',
    name: 'Verdant Bloomstrider',
    speedBonus: MOUNT_SPEED_BONUS,
    requiredLevel: RIDING_LEVEL,
    visual: 'stag_verdant',
    exclusive: true,
  },
};

// The stable stock: each reins item teaches its mount on use (consumed). The
// copper mounts are priced as a real classic-style sink against the zone quest
// economy (top quests pay 25s to 2g50s); the Bloomstrider is priced in $GROW
// and settled against the account ledger, never copper.
export const MOUNT_ITEMS: Record<string, ItemDef> = {
  reins_highfield_alpaca: {
    id: 'reins_highfield_alpaca',
    name: 'Reins of the Highfield Alpaca',
    kind: 'mount',
    use: { type: 'learnMount', mountId: 'mount_alpaca' },
    sellValue: 0,
    buyValue: 40000,
    quality: 'uncommon',
    requiredLevel: RIDING_LEVEL,
    noVendorSell: true,
    noMarketList: true,
  },
  reins_ironhide_bull: {
    id: 'reins_ironhide_bull',
    name: 'Reins of the Ironhide Bull',
    kind: 'mount',
    use: { type: 'learnMount', mountId: 'mount_bull' },
    sellValue: 0,
    buyValue: 40000,
    quality: 'uncommon',
    requiredLevel: RIDING_LEVEL,
    noVendorSell: true,
    noMarketList: true,
  },
  reins_thornback_boar: {
    id: 'reins_thornback_boar',
    name: 'Reins of the Thornback Boar',
    kind: 'mount',
    use: { type: 'learnMount', mountId: 'mount_boar' },
    sellValue: 0,
    buyValue: 40000,
    quality: 'uncommon',
    requiredLevel: RIDING_LEVEL,
    noVendorSell: true,
    noMarketList: true,
  },
  reins_verdant_bloomstrider: {
    id: 'reins_verdant_bloomstrider',
    name: 'Reins of the Verdant Bloomstrider',
    kind: 'mount',
    use: { type: 'learnMount', mountId: 'mount_bloomstrider' },
    sellValue: 0,
    growPrice: 100,
    quality: 'epic',
    requiredLevel: RIDING_LEVEL,
    noVendorSell: true,
    noMarketList: true,
  },
};

/** The stable's vendor stock, in display order (copper mounts, then the exclusive). */
export const STABLE_VENDOR_ITEMS: string[] = [
  'reins_highfield_alpaca',
  'reins_ironhide_bull',
  'reins_thornback_boar',
  'reins_verdant_bloomstrider',
];
