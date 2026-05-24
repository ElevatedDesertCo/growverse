/**
 * Resource system — pure helpers for the 8-currency v2 economy.
 * No React, no Zustand imports. All functions take their inputs and
 * return new values; no side effects.
 *
 * Storage cap rules:
 * - Base cap is BASE_STORAGE_PER_RESOURCE for every resource.
 * - Each placed Storage Vault adds STORAGE_BONUS_PER_VAULT_LEVEL × level
 *   to every resource cap. (Storage Vault stat scaling is configured on
 *   the BuildingDef; this module just consumes a precomputed total.)
 * - Some resources are uncapped (Guild XP, Card Shards) — they pass
 *   through unchanged.
 */

import type { ResourceId } from "@/lib/data/types";

export interface Resources {
  bloomEssence: number;
  amberShards: number;
  mycoDust: number;
  relicFragments: number;
  spiritSeeds: number;
  portalEnergy: number;
  guildXp: number;
  cardShards: number;
}

export const RESOURCE_FIELDS: (keyof Resources)[] = [
  "bloomEssence",
  "amberShards",
  "mycoDust",
  "relicFragments",
  "spiritSeeds",
  "portalEnergy",
  "guildXp",
  "cardShards",
];

/** Phase 2 default starting bag. */
export const INITIAL_RESOURCES: Resources = {
  bloomEssence: 500,
  amberShards: 100,
  mycoDust: 50,
  relicFragments: 25,
  spiritSeeds: 10,
  portalEnergy: 0,
  guildXp: 0,
  cardShards: 0,
};

export const BASE_STORAGE_PER_RESOURCE = 1000;

/**
 * Resources that ignore storage caps. Guild XP is a progression number,
 * not a hoarded currency; Card Shards stack indefinitely as crafting matter.
 */
const UNCAPPED: ReadonlySet<keyof Resources> = new Set([
  "guildXp",
  "cardShards",
]);

/** True if the given resource respects a storage cap. */
export function isCapped(id: keyof Resources): boolean {
  return !UNCAPPED.has(id);
}

/**
 * Effective cap for a resource given the player's combined storage bonus.
 * `extraStorageBonus` is the precomputed sum of all Storage Vaults'
 * contributions (passed in by the caller; this module doesn't read state).
 */
export function maxFor(
  id: keyof Resources,
  extraStorageBonus: number,
): number {
  if (!isCapped(id)) return Number.POSITIVE_INFINITY;
  return BASE_STORAGE_PER_RESOURCE + extraStorageBonus;
}

/** Clamp a value into [0, max]. */
export function clamp(value: number, max: number): number {
  if (value < 0) return 0;
  if (value > max) return max;
  return value;
}

/**
 * Add `amount` to `resources[id]` honoring the cap.
 * Returns BOTH the new resources object AND the amount actually added
 * (so UI can show "+N" floaters that match real gain when capped).
 */
export function addResource(
  resources: Resources,
  id: keyof Resources,
  amount: number,
  extraStorageBonus: number,
): { next: Resources; gained: number } {
  if (amount <= 0) return { next: resources, gained: 0 };
  const cap = maxFor(id, extraStorageBonus);
  const before = resources[id];
  const after = clamp(before + amount, cap);
  const gained = after - before;
  if (gained === 0) return { next: resources, gained: 0 };
  return { next: { ...resources, [id]: after }, gained };
}

/** Subtract a cost bag from resources. Caller must verify affordability first. */
export function spendResources(
  resources: Resources,
  cost: Partial<Resources>,
): Resources {
  const next: Resources = { ...resources };
  (Object.keys(cost) as (keyof Resources)[]).forEach((id) => {
    const amount = cost[id] ?? 0;
    next[id] = Math.max(0, next[id] - amount);
  });
  return next;
}

/** True if `resources` covers every line of `cost`. */
export function canAffordCost(
  resources: Resources,
  cost: Partial<Resources>,
): boolean {
  return (Object.keys(cost) as (keyof Resources)[]).every(
    (id) => resources[id] >= (cost[id] ?? 0),
  );
}

/** Return the missing amounts for an unaffordable cost. */
export function missingFor(
  resources: Resources,
  cost: Partial<Resources>,
): Partial<Resources> {
  const missing: Partial<Resources> = {};
  (Object.keys(cost) as (keyof Resources)[]).forEach((id) => {
    const need = cost[id] ?? 0;
    const have = resources[id];
    if (have < need) missing[id] = need - have;
  });
  return missing;
}

/** Map data-module ResourceId → store field name. */
export function fieldForResourceId(id: ResourceId): keyof Resources {
  // The current canonical names are already the field names, so 1:1.
  return id as keyof Resources;
}

// ─── Save migration v1 → v2 ─────────────────────────────────────────
// v1 (Phase 1) stored only { leaf, fire, mushroom }.
// v2 stores the full 8-field bag with canonical names.

interface V1Resources {
  leaf?: number;
  fire?: number;
  mushroom?: number;
}

/** Translate a v1 resource record into a v2 one, preserving balances. */
export function migrateResourcesV1toV2(v1: V1Resources | undefined): Resources {
  return {
    bloomEssence: v1?.leaf ?? INITIAL_RESOURCES.bloomEssence,
    amberShards: v1?.fire ?? INITIAL_RESOURCES.amberShards,
    mycoDust: v1?.mushroom ?? INITIAL_RESOURCES.mycoDust,
    relicFragments: INITIAL_RESOURCES.relicFragments,
    spiritSeeds: INITIAL_RESOURCES.spiritSeeds,
    portalEnergy: INITIAL_RESOURCES.portalEnergy,
    guildXp: INITIAL_RESOURCES.guildXp,
    cardShards: INITIAL_RESOURCES.cardShards,
  };
}
