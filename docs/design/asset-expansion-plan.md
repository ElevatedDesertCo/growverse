# Asset expansion plan: turning the KayKit packs into a new region + gameplay loop

This maps every uploaded KayKit pack onto concrete additions to Growverse, grounded in the
existing content architecture (`src/sim/content/*` data-as-code, merged in `data.ts`; see
`src/sim/content/CLAUDE.md`). It is phased quick-win to big-lift so we can ship value early
and stop at any phase.

## The world we're extending

The world is a north-running z-strip of four zones plus one side-wing:

| Zone | Levels | Biome | Hub |
|---|---|---|---|
| The Dam | 1-4 | marsh | The Dam |
| Bloomhaven Vale | 1-7 | vale | Bloomhaven |
| The Sunken Wastes | 6-13 | marsh | Fenbridge |
| Thornreach Heights | 13-20 | peaks | Highwatch |
| Drowned Temple (side-wing via moongate) | 15-18 | temple | - |

The game already has an **undead / graveyard / crypt** thread (the Gravecaller cult, the
Hollow Crypt, KayKit skeletons). The Halloween/Spooktober assets extend that thread
perfectly, so the centerpiece is a **haunted-graveyard region** that reads as canon, not
bolted on. Crafting exists (Grow Station + Upgrade Bench) but there is **no gathering /
resource-node system**, which is where the Resource Bits + RPG Tools packs unlock a genuine
new gameplay loop.

## Asset to destination map

| Pack | Contents | Used for |
|---|---|---|
| **Spooktober** | Witch + Jack-o-lantern characters, graveyard tiles, candy | New enemies/boss + haunted region dressing |
| **Skeletons 1.0** | 4 "broken" skeleton variants + archer | New undead enemy variants (risen/shattered dead) |
| **Halloween Bits** | graves, coffins, dead trees, fences, pumpkins, candles, lanterns | Haunted-region props (the graveyard itself) |
| **Forest Nature** | 20 trees, 43 rocks, 22 bushes, 20 grass | Densify Bloomhaven/Thornreach foliage + a wooded grove |
| **Dungeon Remastered** | 211: walls, floors, stairs, furniture, banners, torches | New dungeon interior: the Mausoleum / Sunken Crypt |
| **Dungeon Pack 1.0** | 202: bookcases, scaffolds, potions, books | New dungeon interior: the Witch's Arcanum (library) |
| **Resource Bits** | copper/iron/silver/gold ore, wood, stone, fuel | **Gathering nodes** (the new loop) |
| **RPG Tools** | anvil, grindstone, pickaxe, blueprints, maps, journals | Crafting stations + quest props |
| **Fantasy Weapons** | 31 swords/bows/axes/hammers/staves/daggers | New weapon loot models + item variety |
| **Adventurers 2.0 / Skeletons 1.1** | the 6 adventurers + 4 skeletons you already ship | (no new content; already in game) |

## The centerpiece: "Hollowmere", a haunted-graveyard side-wing

Modeled on the existing **Drowned Temple** pattern (a self-contained themed wing reached by a
portal, its own mobs/npcs/quests/dungeon merged like a zone). This avoids re-banding the
world strip and avoids a new biome. Suggested level band **~9-13**, bridging the Sunken
Wastes into Thornreach, reached by a **grave-gate** placed in the Sunken Wastes.

- **Hub hamlet: "Wispford"** - a handful of survivors at the graveyard's edge. NPCs:
  - **Morvenna the Hedgewitch** (the Witch model) - quest giver + apothecary vendor; later
    the gathering/herbalism trainer.
  - **The Gravewarden** (a redressed existing body) - crypt-chain quest giver.
- **Enemies** (new mob templates, `undead`/`humanoid` families):
  - **Shambling Dead** - the 4 broken-skeleton variants (minion/warrior/mage/archer_broken).
  - **Grinning Jack** - the Jack-o-lantern as a pumpkin sentinel (elite), with a **Pumpkin
    King** boss elite in the dungeon.
- **Props**: Halloween + Spooktober packs (graves, coffins, dead trees, iron fences,
  jack-o-lanterns, candle-lit shrines).
- **Dungeon: "The Sunken Mausoleum"** - Phase 1 reuses the existing `crypt` interior (zero
  render work); Phase 2 upgrades it to a bespoke interior from Dungeon Remastered.

Reuses: Spooktober (Witch, Jack), Skeletons 1.0 (broken variants), Halloween (all props),
Dungeon Remastered (later interior).

## The new gameplay loop: gathering feeds crafting ("fluency")

The single biggest "make gameplay more fluent" lever. Today crafting reagents only come from
mob loot; adding **harvest nodes** gives players a reason to engage the world while
traveling and a steady feed into the existing stations.

- **Resource nodes** (new world-object type): ore veins (copper/iron/silver/gold), timber,
  stone, fuel from Resource Bits, scattered across all zones by tier (copper near
  Bloomhaven, iron/silver in the Wastes, gold in Thornreach).
- **Harvest interaction**: walk up, channel a short cast (gated by a tool - pickaxe/axe from
  RPG Tools), receive resource items, node respawns on a timer. Mirrors the existing
  fishing/collect interaction so it fits the input model.
- **Feeds crafting**: ore -> bars at a new **Forge** station (RPG Tools anvil + grindstone),
  bars -> gear upgrades at Draxa's existing Upgrade Bench. Wood/stone -> Grow Station
  accessories. No new balance math invented; slot into the existing `CraftRecipe` system.

This is the one genuinely NEW SIM SYSTEM in the plan (a harvest mechanic + node entities +
respawn), so it is phased last and scoped carefully.

## Phased roadmap

### Phase 0 - Quick wins (data + props only, ~low risk)
No new zone or system; enrich what exists.
1. **Wire the 3 new enemy bodies** (Witch, Jack, broken skeletons) via the character pipeline
   (`autorig` for the unrigged Spooktober pair; `rig:ingest` for any rigged ones), register
   in the manifest, and add them as **new mob variants in the existing Sunken Wastes / Hollow
   Crypt** (undead camps + the crypt). Immediate new enemies, no new place needed.
2. **Fantasy Weapons as loot models**: map new weapon GLBs through `ITEM_WEAPON_VARIANTS` so
   existing/new weapon items show fresh models.
3. **Foliage pass**: add Forest Nature trees/rocks/bushes to Bloomhaven + Thornreach `_PROPS`
   for a denser, richer look (pure prop reuse).
- Touches: `src/render/characters/manifest.ts`, `content/zone2.ts`/`zone3.ts` (mobs/camps/
  props), `src/ui/weapon_variants.ts`, `render/props.ts`. No new systems.

### Phase 1 - The Hollowmere region (like the Temple wing)
The new place: hub hamlet (Wispford), Morvenna + Gravewarden NPCs, the haunted graveyard
props, the new undead/pumpkin enemies, a 4-6 quest chain (clear the risen dead -> gather
grave-moss for Morvenna -> light the lanterns -> defeat the Pumpkin King), and the Sunken
Mausoleum dungeon **reusing the `crypt` interior**.
- Touches: new `content/hollowmere.ts` (mirrors `temple.ts`) merged in `data.ts`; a grave-gate
  prop + portal in `zone2.ts`; `world_entity_i18n.ts` for names; `npm run wiki:content`.

### Phase 2 - Bespoke dungeon interiors
Upgrade the Mausoleum to a **new `mausoleum` interior** from Dungeon Remastered, and add a
second dungeon, **the Witch's Arcanum** (library) from Dungeon Pack 1.0.
- Touches: `sim/dungeon_layout.ts` (new layouts), `sim/colliders.ts` (`INTERIOR_COLLIDERS`),
  `render/dungeon.ts` (builder + torch palettes), `content/dungeons.ts` (`DUNGEON_DEFS`).
  This is the render-heavier phase.

### Phase 3 - Gathering + crafting loop
The new system: resource-node world objects, a harvest interaction, resource + bar items, a
Forge station, and recipes wiring ore/wood/stone into the existing stations. Nodes seeded
across every zone by tier.
- Touches: a new `sim/gathering.ts` behind the `SimContext` seam (node state + harvest +
  respawn), a `resourceNodes` field on `ZonePropsDef` + render prop, `content/crafting.ts`
  (Forge recipes), new resource items in `content/items.ts`, HUD harvest affordance.

## Notes, risks, and honesty

- **Character quality**: the Witch and Jack are **auto-rigged** (they were unrigged in the
  pack). They came out clean because KayKit's chunky style rigs well, but auto-rig is
  best-effort; always eyeball the render before shipping each one.
- **Effort gradient**: Phase 0-1 are mostly data + prop reuse (fast, low risk). Phase 2 needs
  new render interiors. Phase 3 is a real new sim system (biggest lift).
- **A new biome is optional**: Hollowmere as a side-wing avoids extending `BiomeId`. If we
  ever want it as a full strip zone with its own terrain palette, that's a separate,
  larger change (extend `BiomeId` + the renderer biome palette).
- **Determinism**: new camps must be appended LAST in the merge arrays (`data.ts`), per the
  world-gen RNG order rule.
- **Every player string** (zone/npc/quest/mob names) must be registered in
  `src/ui/world_entity_i18n.ts`, and content changes must re-run `npm run wiki:content`.

## Recommended start

**Phase 0**, it turns the assets you already have into visible in-game additions (new
enemies + weapons + denser world) within the existing zones, with no new systems and minimal
risk, and it proves the character wiring end-to-end in the live game before we build the
whole Hollowmere region on top of it.
