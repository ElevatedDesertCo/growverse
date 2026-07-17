import { describe, expect, it } from 'vitest';
import type { MountDef } from '../src/sim/types';
import { buildMountsView } from '../src/ui/mounts_view';

// Minimal MountDef fixtures: buildMountsView reads id (via the table lookup),
// name, requiredLevel, and the exclusive flag; the rest is engine data the
// view never touches. The table is a parameter, so the test drives fixtures,
// not the shipped MOUNTS registry.
function mount(id: string, opts: { requiredLevel?: number; exclusive?: boolean } = {}): MountDef {
  return {
    id,
    itemId: `reins_${id}`,
    name: `Name of ${id}`,
    speedBonus: 0.6,
    requiredLevel: opts.requiredLevel ?? 20,
    visual: 'alpaca',
    exclusive: opts.exclusive,
  };
}

function table(...mounts: MountDef[]): Record<string, MountDef> {
  return Object.fromEntries(mounts.map((m) => [m.id, m]));
}

describe('buildMountsView rows', () => {
  it('lists owned mounts that exist in the table, in ledger order, with names', () => {
    const mounts = table(mount('alpaca'), mount('bull'));
    const view = buildMountsView(['bull', 'alpaca'], null, mounts, 20);
    expect(view.rows.map((r) => r.mountId)).toEqual(['bull', 'alpaca']);
    expect(view.rows.map((r) => r.name)).toEqual(['Name of bull', 'Name of alpaca']);
    expect(view.empty).toBe(false);
  });

  it('skips a stale ledger id missing from the table', () => {
    const mounts = table(mount('alpaca'));
    const view = buildMountsView(['alpaca', 'ghost'], null, mounts, 20);
    expect(view.rows.map((r) => r.mountId)).toEqual(['alpaca']);
  });

  it('marks only the active ride active', () => {
    const mounts = table(mount('alpaca'), mount('bull'));
    const view = buildMountsView(['alpaca', 'bull'], 'bull', mounts, 20);
    expect(view.rows.map((r) => r.active)).toEqual([false, true]);
  });

  it('gates canSummon on the mount required level', () => {
    const mounts = table(mount('alpaca', { requiredLevel: 20 }));
    expect(buildMountsView(['alpaca'], null, mounts, 19).rows[0].canSummon).toBe(false);
    expect(buildMountsView(['alpaca'], null, mounts, 20).rows[0].canSummon).toBe(true);
    expect(buildMountsView(['alpaca'], null, mounts, 21).rows[0].canSummon).toBe(true);
  });

  it('carries the exclusive flag (cosmetic prestige marker)', () => {
    const mounts = table(mount('alpaca'), mount('bloomstrider', { exclusive: true }));
    const view = buildMountsView(['alpaca', 'bloomstrider'], null, mounts, 20);
    expect(view.rows.map((r) => r.exclusive)).toEqual([false, true]);
  });
});

describe('buildMountsView empty state', () => {
  it('is empty with no learned mounts', () => {
    const view = buildMountsView([], null, table(mount('alpaca')), 20);
    expect(view.rows).toEqual([]);
    expect(view.empty).toBe(true);
  });

  it('is empty when every ledger id is stale (nothing listable)', () => {
    const view = buildMountsView(['ghost'], null, {}, 20);
    expect(view.rows).toEqual([]);
    expect(view.empty).toBe(true);
  });
});

describe('buildMountsView is a pure projection', () => {
  it('returns identical structure for identical input (no hidden state)', () => {
    const mounts = table(mount('alpaca'), mount('bull'));
    expect(buildMountsView(['alpaca', 'bull'], 'alpaca', mounts, 20)).toEqual(
      buildMountsView(['alpaca', 'bull'], 'alpaca', mounts, 20),
    );
  });

  // The recipe's host-parity check: the same logical mount state produces the
  // same view whether the inputs come Sim-shaped (the live mutable ledger the
  // offline Sim exposes) or ClientWorld-shaped (the frozen mirrored snapshot
  // arrays the online client rebuilds from the wire). buildMountsView must
  // treat both as plain readonly data, so the two builds are deep-equal.
  it('is host-agnostic: Sim-shaped and ClientWorld-shaped inputs build the same view', () => {
    const mounts = table(mount('alpaca'), mount('bloomstrider', { exclusive: true }));
    const simOwned = ['alpaca', 'bloomstrider'];
    const cwOwned = Object.freeze([...simOwned]) as readonly string[];
    expect(buildMountsView(cwOwned, 'bloomstrider', mounts, 20)).toEqual(
      buildMountsView(simOwned, 'bloomstrider', mounts, 20),
    );
  });
});
