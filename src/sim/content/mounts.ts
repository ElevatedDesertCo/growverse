// Mounts and Stables v1 (docs/prd/mounts-and-stables.md). Data-as-code only:
// the mount registry plus the vendor items that teach each mount. Engine logic
// lives in src/sim/mounts.ts; data.ts merges these tables into MOUNTS / ITEMS.
//
// Roster note: the world has no horse model, so the stable rides the creatures
// the realm already raises (alpaca, bull, boar) plus the $GROW-exclusive
// Bloomstriders on the stag. Exclusives are cosmetic prestige only: within a
// tier every mount shares the same speed and rules, never an advantage.
//
// Two classic tiers: riding at 20 (+60%) and swift riding at 40 (+100%).

import type { ItemDef, MountDef } from '../types';

export const MOUNT_SPEED_BONUS = 0.6; // +60% ground speed (riding tier)
export const RIDING_LEVEL = 20;
export const SWIFT_SPEED_BONUS = 1.0; // +100% ground speed (swift tier)
// The level cap is 20 (MAX_LEVEL; post-cap progression is virtual), so the
// swift tier shares the level gate and is differentiated by PRICE alone: a
// 10x copper sink and the premium $GROW exclusive.
export const SWIFT_RIDING_LEVEL = RIDING_LEVEL;

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
  // Swift tier (level 40, +100%): the same stable raised faster stock. The
  // Elder Bloomstrider is the swift-tier $GROW exclusive, speed-equal to the
  // swift copper mounts (fairness invariant).
  mount_swift_alpaca: {
    id: 'mount_swift_alpaca',
    itemId: 'reins_swift_highfield_alpaca',
    name: 'Swift Highfield Alpaca',
    speedBonus: SWIFT_SPEED_BONUS,
    requiredLevel: SWIFT_RIDING_LEVEL,
    visual: 'alpaca',
  },
  mount_swift_bull: {
    id: 'mount_swift_bull',
    itemId: 'reins_swift_ironhide_bull',
    name: 'Swift Ironhide Bull',
    speedBonus: SWIFT_SPEED_BONUS,
    requiredLevel: SWIFT_RIDING_LEVEL,
    visual: 'bull',
  },
  mount_swift_boar: {
    id: 'mount_swift_boar',
    itemId: 'reins_swift_thornback_boar',
    name: 'Swift Thornback Boar',
    speedBonus: SWIFT_SPEED_BONUS,
    requiredLevel: SWIFT_RIDING_LEVEL,
    visual: 'wild_boar',
  },
  mount_elder_bloomstrider: {
    id: 'mount_elder_bloomstrider',
    itemId: 'reins_elder_bloomstrider',
    name: 'Elder Bloomstrider',
    speedBonus: SWIFT_SPEED_BONUS,
    requiredLevel: SWIFT_RIDING_LEVEL,
    visual: 'stag_verdant',
    exclusive: true,
  },
};

// Shared item shape for every reins: a one-time personal unlock. Never
// vendor-sellable, never market-listed, never tradable (soulbound-style).
function reins(
  id: string,
  name: string,
  mountId: string,
  price: { buyValue?: number; growPrice?: number },
  quality: 'uncommon' | 'epic',
  requiredLevel: number,
): ItemDef {
  return {
    id,
    name,
    kind: 'mount',
    use: { type: 'learnMount', mountId },
    sellValue: 0,
    ...price,
    quality,
    requiredLevel,
    noVendorSell: true,
    noMarketList: true,
    noTrade: true,
  };
}

// The stable stock. Copper mounts are priced as a real classic-style sink
// against the zone quest economy (top quests pay 25s to 2g50s); the swift tier
// is the level-40 aspiration; the Bloomstriders are priced in $GROW and settled
// against the account ledger, never copper.
export const MOUNT_ITEMS: Record<string, ItemDef> = {
  reins_highfield_alpaca: reins(
    'reins_highfield_alpaca',
    'Reins of the Highfield Alpaca',
    'mount_alpaca',
    { buyValue: 40000 },
    'uncommon',
    RIDING_LEVEL,
  ),
  reins_ironhide_bull: reins(
    'reins_ironhide_bull',
    'Reins of the Ironhide Bull',
    'mount_bull',
    { buyValue: 40000 },
    'uncommon',
    RIDING_LEVEL,
  ),
  reins_thornback_boar: reins(
    'reins_thornback_boar',
    'Reins of the Thornback Boar',
    'mount_boar',
    { buyValue: 40000 },
    'uncommon',
    RIDING_LEVEL,
  ),
  reins_verdant_bloomstrider: reins(
    'reins_verdant_bloomstrider',
    'Reins of the Verdant Bloomstrider',
    'mount_bloomstrider',
    { growPrice: 100 },
    'epic',
    RIDING_LEVEL,
  ),
  reins_swift_highfield_alpaca: reins(
    'reins_swift_highfield_alpaca',
    'Reins of the Swift Highfield Alpaca',
    'mount_swift_alpaca',
    { buyValue: 400000 },
    'epic',
    SWIFT_RIDING_LEVEL,
  ),
  reins_swift_ironhide_bull: reins(
    'reins_swift_ironhide_bull',
    'Reins of the Swift Ironhide Bull',
    'mount_swift_bull',
    { buyValue: 400000 },
    'epic',
    SWIFT_RIDING_LEVEL,
  ),
  reins_swift_thornback_boar: reins(
    'reins_swift_thornback_boar',
    'Reins of the Swift Thornback Boar',
    'mount_swift_boar',
    { buyValue: 400000 },
    'epic',
    SWIFT_RIDING_LEVEL,
  ),
  reins_elder_bloomstrider: reins(
    'reins_elder_bloomstrider',
    'Reins of the Elder Bloomstrider',
    'mount_elder_bloomstrider',
    { growPrice: 250 },
    'epic',
    SWIFT_RIDING_LEVEL,
  ),
  // A second $GROW sink at the stable: a cosmetic wardrobe cache that rolls a
  // skin rank and opens the skin-select overlay (the event_skin_token flow).
  verdant_wardrobe_crate: {
    id: 'verdant_wardrobe_crate',
    name: 'Verdant Wardrobe Crate',
    kind: 'tool',
    quality: 'rare',
    use: { type: 'skinSelect', catalog: 'class' },
    sellValue: 0,
    growPrice: 25,
    noVendorSell: true,
    noMarketList: true,
    noTrade: true,
  },
};

/** The stable's vendor stock, in display order: riding tier, swift tier, then
 *  the cosmetic crate. */
export const STABLE_VENDOR_ITEMS: string[] = [
  'reins_highfield_alpaca',
  'reins_ironhide_bull',
  'reins_thornback_boar',
  'reins_verdant_bloomstrider',
  'reins_swift_highfield_alpaca',
  'reins_swift_ironhide_bull',
  'reins_swift_thornback_boar',
  'reins_elder_bloomstrider',
  'verdant_wardrobe_crate',
];
