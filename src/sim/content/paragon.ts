// Paragon: the endless post-cap progression track.
//
// From ABILITY-independent virtual levels past PARAGON_START_LEVEL the character
// earns Paragon Points (one per level, continuing into the infinite virtual
// levels past the real cap, so it never stops giving). Points are spent into a
// small set of uncapped stat nodes; the allocation resolves ONCE into flat
// StatModEffect deltas that ride the same `talentMods.stats` bundle
// recalcPlayerStats already reads, so the hot path never walks paragon.
//
// Paragon is a pure function of the ALLOCATION, not the current level: spending
// is validated <= available at spend time and characters never de-level, so the
// spent points are always affordable in normal play. Balanced 2v2 Fiesta uses
// `fiestaMods` (talents + augments, paragon-free) so it is unaffected.
//
// Data-as-code plus the pure resolver, mirroring content/talents.ts.

import type { StatModEffect, TalentModifiers } from './talents';

// Paragon points begin at the level AFTER this (so level 21 grants the first).
// Matches the authored-content cap: the journey past 20 is where paragon lives.
export const PARAGON_START_LEVEL = 20;

export type ParagonAllocation = Record<string, number>;

export interface ParagonNodeDef {
  id: string;
  // English display name (localized at the client like other world text).
  name: string;
  // Flat stat contribution PER POINT. Uncapped: points always have a home so the
  // endless grind never dead-ends. Values are deliberately small.
  per: StatModEffect;
}

export const PARAGON_NODES: ParagonNodeDef[] = [
  { id: 'para_might', name: 'Might', per: { str: 3 } },
  { id: 'para_finesse', name: 'Finesse', per: { agi: 3 } },
  { id: 'para_intellect', name: 'Intellect', per: { int: 3 } },
  { id: 'para_fortitude', name: 'Fortitude', per: { sta: 4 } },
  { id: 'para_precision', name: 'Precision', per: { crit: 0.001 } },
  { id: 'para_barrier', name: 'Barrier', per: { armor: 6 } },
];

const PARAGON_NODE_IDS = new Set(PARAGON_NODES.map((n) => n.id));
const PARAGON_NODE_BY_ID: Record<string, ParagonNodeDef> = Object.fromEntries(
  PARAGON_NODES.map((n) => [n.id, n]),
);

// Total Paragon Points a character has earned at a given (virtual) level. Below
// the start level this is 0; above it, one per level, unbounded (virtual levels
// climb forever past the real cap).
export function paragonPointsAvailable(virtualLevel: number): number {
  return Math.max(0, Math.floor(virtualLevel) - PARAGON_START_LEVEL);
}

// Points spent across all nodes in an allocation.
export function paragonPointsSpent(alloc: ParagonAllocation): number {
  let total = 0;
  for (const id in alloc) total += Math.max(0, Math.floor(alloc[id] ?? 0));
  return total;
}

// A well-formed allocation: only known nodes, non-negative integer points, and
// the total within the available budget.
export function isValidParagon(alloc: ParagonAllocation, available: number): boolean {
  let total = 0;
  for (const id in alloc) {
    const pts = alloc[id];
    if (!PARAGON_NODE_IDS.has(id)) return false;
    if (!Number.isFinite(pts) || pts < 0 || !Number.isInteger(pts)) return false;
    total += pts;
  }
  return total <= available;
}

// Coerce any stored allocation into a valid one for the given budget: drop
// unknown nodes, floor to non-negative integers, and trim (in node order) so the
// total never exceeds `available`. Used when loading saves and after a design
// change to the node set.
export function sanitizeParagon(
  alloc: ParagonAllocation | undefined,
  available: number,
): ParagonAllocation {
  const out: ParagonAllocation = {};
  if (!alloc) return out;
  let remaining = Math.max(0, Math.floor(available));
  for (const node of PARAGON_NODES) {
    const want = Math.max(0, Math.floor(alloc[node.id] ?? 0));
    if (want <= 0) continue;
    const give = Math.min(want, remaining);
    if (give > 0) {
      out[node.id] = give;
      remaining -= give;
    }
  }
  return out;
}

// Fold a paragon allocation's flat stat deltas into an existing modifier bundle,
// returning a NEW bundle (the base is never mutated). Only `stats` fields are
// touched; abilities/global/grants pass through unchanged. An empty allocation
// returns the base reference (no allocation, no cost).
export function withParagon(base: TalentModifiers, alloc: ParagonAllocation): TalentModifiers {
  let touched = false;
  const stats = { ...base.stats };
  for (const id in alloc) {
    const pts = Math.max(0, Math.floor(alloc[id] ?? 0));
    const node = PARAGON_NODE_BY_ID[id];
    if (!node || pts <= 0) continue;
    for (const key in node.per) {
      const k = key as keyof StatModEffect;
      stats[k] = (stats[k] ?? 0) + (node.per[k] ?? 0) * pts;
      touched = true;
    }
  }
  return touched ? { ...base, stats } : base;
}
