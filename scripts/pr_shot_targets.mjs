// Change-aware screenshot targets. Each target knows (a) which changed paths imply it
// (`when`, matched as path substrings) and (b) how to bring that screen up in the running
// offline client and which region to clip (`capture`). pr_screenshots.mjs maps a diff to
// the set of targets it implies and shoots exactly those, instead of a fixed tour.
//
// Adding coverage is one entry here, not a new script. Keep recipes offline-only (they
// drive window.__game directly: sim.addItem, hud.toggleBags/toggleMap, sim.player.pos).

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export const TARGETS = [
  {
    key: 'inventory',
    label: 'Inventory / bags',
    when: ['ui/bags', 'ui/inventory', 'ui/item', 'ui/vendor', 'ui/loot', 'sim/content/items'],
    // Fill the bags with a spread so the window has content, then open it and clip to #bags.
    async capture(page) {
      await page.evaluate(() => {
        const sim = window.__game?.sim;
        const ids = [
          'eastbrook_arming_sword',
          'apprentice_staff',
          'cryptbone_helm',
          'baked_bread',
          'minor_healing_potion',
          'minor_mana_potion',
          'boar_hide',
          'glade_pelt',
        ];
        for (const id of ids) {
          try {
            sim?.addItem(id, 1);
          } catch {}
        }
        // Force-hide then toggle so the open is deterministic regardless of prior state
        // (the same trick the bag_filter screenshot harness uses).
        const el = document.querySelector('#bags');
        if (el) el.style.display = 'none';
        window.__game?.hud?.toggleBags?.();
      });
      await wait(700);
      return { clip: '#bags' };
    },
  },
  {
    key: 'world-map',
    label: 'World map / zone',
    when: [
      'ui/map',
      'map_window',
      'minimap',
      // Zone content lives in per-zone files (content/zone1..zone4.ts), so match the
      // singular stem. The old 'sim/content/zones' / 'sim/zone' entries matched no path
      // in the repo, which meant a zone-content diff never triggered this target.
      'sim/content/zone',
      'render/terrain',
      'render/world',
    ],
    // Teleport to a known landmark (offline, no dev command), open the world-map window,
    // and clip to it; fall back to the full frame if the window did not open.
    async capture(page) {
      await page.evaluate(() => {
        const p = window.__game?.sim?.player;
        if (p?.pos) {
          p.pos.x = 65; // Boar Meadow, Eastbrook Vale
          p.pos.z = 0;
        }
      });
      await wait(400);
      await page.evaluate(() => window.__game?.hud?.toggleMap?.());
      await wait(600);
      const open = await page.evaluate(() => {
        const w = document.querySelector('#map-window');
        return !!w && getComputedStyle(w).display !== 'none';
      });
      return open ? { clip: '#map-window' } : {};
    },
  },
  // ---- the cultivation arc: one entry per window, since each target is one frame -------
  // These three windows are the grow loop's whole UI, so a diff that touches cultivation
  // should show them rather than falling through to the world map. Seeding is best-effort
  // and wrapped like the inventory recipe above: if a seed step fails the window still
  // opens on its empty state, which is a truthful screenshot rather than a missing one.
  {
    key: 'garden',
    label: 'Garden (plots / planting / tending)',
    when: ['ui/garden', 'sim/cultivation'],
    async capture(page) {
      await page.evaluate(() => {
        // The change-aware tour reuses ONE page across targets and opening a window does
        // not close its siblings, so without this the previous target's window is still up
        // and can sit over this one's clip region.
        for (let i = 0; i < 12 && window.__game?.hud?.closeAll?.(); i++);
        const sim = window.__game?.sim;
        try {
          sim?.addItem('common_seed', 6);
          // Two planted plots so the window shows a growing crop with its Tend control,
          // not just a grid of empty beds.
          sim?.plantSeed(0, 'common_seed');
          sim?.plantSeed(1, 'common_seed');
        } catch {}
        window.__game?.hud?.openGarden?.();
      });
      await wait(700);
      return { clip: '#garden-window' };
    },
  },
  {
    key: 'breeding',
    label: 'Strain genetics (library / crossing)',
    when: ['ui/breeding', 'sim/genetics', 'sim/strain_library'],
    async capture(page) {
      await page.evaluate(async () => {
        // The change-aware tour reuses ONE page across targets and opening a window does
        // not close its siblings, so without this the previous target's window is still up
        // and can sit over this one's clip region.
        for (let i = 0; i < 12 && window.__game?.hud?.closeAll?.(); i++);
        const sim = window.__game?.sim;
        try {
          // A small library with a bred entry, so the rows show traits, a mastery bar,
          // and the lineage plus breeder credit this arc added.
          const { BASE_STRAINS } = await import('/src/sim/data');
          const { baseStrain } = await import('/src/sim/genetics.ts');
          const meta = sim?.players?.get(sim.primaryId);
          if (meta) {
            meta.strains.length = 0;
            ['Fen Haze', 'Copper Diesel', 'Vale Kush'].forEach((name, i) => {
              const s = baseStrain(
                i % 2 ? BASE_STRAINS.enriched_bloom : BASE_STRAINS.common_bloom,
                `pr${i}`,
              );
              s.name = name;
              s.mastery = [0, 40, 100][i];
              if (i === 2) {
                s.lineage = ['Fen Haze', 'Copper Diesel'];
                s.breeder = sim.player?.name;
              }
              meta.strains.push(s);
            });
          }
          sim?.addItem('epic_bud', 4);
        } catch {}
        window.__game?.hud?.openBreeding?.();
      });
      await wait(700);
      return { clip: '#breeding-window' };
    },
  },
  {
    key: 'cup',
    label: 'The Vale Cup (season standings)',
    when: ['ui/cup', 'sim/cup'],
    async capture(page) {
      await page.evaluate(async () => {
        // The change-aware tour reuses ONE page across targets and opening a window does
        // not close its siblings, so without this the previous target's window is still up
        // and can sit over this one's clip region.
        for (let i = 0; i < 12 && window.__game?.hud?.closeAll?.(); i++);
        const sim = window.__game?.sim;
        try {
          const { cupSeasonAt } = await import('/src/sim/cup.ts');
          const season = cupSeasonAt(sim.time);
          sim.cupEntries.length = 0;
          sim.cupEntries.push(
            {
              season,
              pid: 901,
              growerName: 'Thistledown',
              strainName: 'Ridge Amber',
              budItemId: 'bud_prime',
              score: 412,
            },
            {
              season,
              pid: sim.player.id,
              growerName: sim.player.name,
              strainName: 'Vale Kush',
              budItemId: 'bud_fine',
              score: 268,
            },
            {
              season,
              pid: 902,
              growerName: 'Bram',
              strainName: 'Fen Diesel',
              budItemId: 'bud_common',
              score: 155,
            },
          );
        } catch {}
        window.__game?.hud?.openCup?.();
      });
      await wait(700);
      return { clip: '#cup-window' };
    },
  },
];

// Map a list of changed file paths to the targets they imply (deduped, registry order).
export function resolveTargets(changedFiles) {
  return TARGETS.filter((t) => changedFiles.some((f) => t.when.some((w) => f.includes(w))));
}
