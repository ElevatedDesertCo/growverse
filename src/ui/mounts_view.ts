// Pure, host-agnostic view model for the Mounts window.
//
// The pure-core half of the pure-core + thin-consumer split (root CLAUDE.md
// Conventions; reference vendor_view.ts / vendor_window.ts). It owns the one
// thing the Mounts window decides that is worth testing without a DOM: which
// learned mounts are listed, which one is active, and whether each can be
// summoned at the player's level. The DOM/i18n side lives in mounts_window.ts;
// rendering is driven entirely off the structure returned here. The MOUNTS
// table is a parameter so the core stays table-agnostic (and trivially
// testable with fixture defs).
//
// DOM-free and i18n-free so tests/mounts_view.test.ts can drive it directly.
// Not per-frame: the window repaints on open/refresh, so allocation per build
// is fine.

import type { MountDef } from '../sim/types';

export interface MountsRow {
  mountId: string;
  /** Player-visible English mount name from the MountDef (content data). */
  name: string;
  /** True when this mount is the current ride. */
  active: boolean;
  /** True when the player meets the mount's required level to summon it. */
  canSummon: boolean;
  /** The $GROW exclusive marker (cosmetic prestige only, never extra speed). */
  exclusive: boolean;
}

export interface MountsView {
  rows: MountsRow[];
  /** True when the player has learned no listable mount (the empty state). */
  empty: boolean;
}

/**
 * Build the structured mounts view from raw inputs. A learned mount id is
 * listed only if it still exists in the mount table (a stale ledger entry is
 * skipped, mirroring how the vendor view skips a missing item).
 */
export function buildMountsView(
  ownedMounts: readonly string[],
  activeMountId: string | null,
  mounts: Record<string, MountDef>,
  playerLevel: number,
): MountsView {
  const rows: MountsRow[] = [];
  for (const mountId of ownedMounts) {
    const def = mounts[mountId];
    if (!def) continue;
    rows.push({
      mountId,
      name: def.name,
      active: mountId === activeMountId,
      canSummon: playerLevel >= def.requiredLevel,
      exclusive: def.exclusive === true,
    });
  }
  return { rows, empty: rows.length === 0 };
}
