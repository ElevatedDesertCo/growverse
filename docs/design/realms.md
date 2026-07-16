# Realms: portal-reached dimensions

Status: DRAFT / living spec. Owner: elevateddesertco. Last updated by the realms
planning pass.

## Vision

Players take portals from a central hub (Bloomhaven) into separate dimensions
("realms"). Each realm is a full sub-world the size of the current overworld:
multiple sub-zones to explore, its own towns, creatures, weapons/armor, a
signature rare seed, dungeons, and a multi-step quest arc. Realms are isolated:
you cannot walk between them, only portal in and out.

Reference: a hub-and-spokes region map with color-coded realms (desert, savanna,
snow, corrupted, forest, swamp, a maze region) linked by portal nodes.

## Progression model: stacked ladder (DECIDED)

Realms form a level ladder, not parallel playgrounds. The overworld is levels
1 to ~7; each realm covers a higher band and its portal unlocks after an intro
quest and/or a level gate.

| Order | Realm | Level band (proposed) |
|---|---|---|
| Hub | Bloomhaven overworld (existing) | 1 to 7 |
| 1 | The Emberwastes (desert) | 8 to 18 |
| 2 | The Gilded Veldt (savanna) | 18 to 28 |
| 3 | Frostmere Hollow (snow) | 28 to 38 |
| 4 | The Violet Rot (corrupted) | 38 to 48 |
| 5 | The Sunken Labyrinth (stone maze) | 48 to 58 |
| 6 | Mirebog Fen (swamp) | 58 to 68 |

Level bands past 20 imply raising the current level cap (currently 1 to 20). That
is a separate progression/XP-curve decision to make before realm 2. Realm 1
(Emberwastes, 8 to 18) fits inside the current cap.

## Architecture

Growverse already has most of the machinery. The transition, isolation, content,
biome rendering, and offline execution are all solved patterns; the one genuinely
new engine seam is making terrain/zone lookups realm-aware.

### What already exists (reuse)

- Portals are content: a `dungeon_door` ground object carrying a target id
  (`door.dungeonId`), spawned from a `DungeonDef.doorPos` in the `Sim` ctor.
  Walk within 2yd or click to transition (`interaction.ts`, `updateDoorTriggers`).
  Temple's moongate and Hollowmere's grave-gate are pure content proving this.
  Precedent for a portal INSIDE one area leading to ANOTHER: the Nythraxis crypt
  contains a `dungeon_door` to `nythraxis_boss_arena` (`overworldDoor:false`).
- Isolation: instances live in far coordinate bands (`instanceOrigin(index, slot)`,
  past `DUNGEON_X_THRESHOLD = 600`), isolated by band + slot + `partyKey`, sharing
  one entity roster and one RNG stream.
- Content is data-as-code: one module per area (`content/temple.ts`,
  `content/hollowmere.ts`) merged by `data.ts`. Mobs, camps, NPCs, items, quests,
  harvest nodes, crafting recipes are typed records.
- Biome rendering switches on `BiomeId` (`'vale'|'marsh'|'peaks'`,
  `sim/types.ts`), consumed via `zoneBiomeAt(z)` (`sim/world.ts`) by
  `render/{terrain,foliage,water,sky}.ts`. Adding a biome is a compiler-guided
  `Record<BiomeId,...>` table fill plus art.
- Offline confirmed: offline mode runs the entire sim client-side
  (`main.ts` `startOffline` builds `new Sim(...)`), so any realm built as sim
  content is automatically present on the static Vercel deploy with no server.

### The one new seam: realm-scoped world lookups

Each realm is its own full overworld, so each needs its own ordered zone strip
and its own map. Concretely:

- `RealmDef` (new, `src/sim/content/`): `{ id, band:{xMin,xMax,zMin,zMax},
  zones: ZoneDef[], terrainSeed, hubPos, returnPortalPos, unlock:{minLevel,
  requiresQuest?} }`. The overworld is the implicit realm `'overworld'`.
- Make `terrainHeight(x,z,seed)`, `zoneBiomeAt(z)`, and `zoneAt(z)` in
  `sim/world.ts` + `sim/data.ts` realm-aware: if `(x,z)` falls in a realm band,
  resolve against that realm's `zones` + `terrainSeed`; else the overworld strip.
  Because render and sim share these one functions, the renderer draws the realm's
  biome terrain automatically once this is in.
- Realm discriminator on `IWorld` (`world_api.ts`, implemented in both `Sim` and
  `net/online.ts`) so the map/minimap know the active realm and project its zone
  strip. `map_window_view.ts` already projects one zone at a time; extend the
  terrain-bg cache key from `zoneId` to `realmId:zoneId`.
- Portal transition: a new `realm_portal` ground object carrying `targetRealmId`
  (mirror `door.dungeonId`), handled in `interaction.ts` + a proximity trigger,
  plus `enterRealm`/`leaveRealm` on the `SimContext` seam analogous to
  `enterDungeon`/`leaveDungeon` (coordinate teleport to the realm `hubPos`).
- Portal visual: reuse the delve-entrance (`props.ts` `delvePortalMaterial()` +
  the Meshy portal-door GLB), recolored per realm. No new shader work.
- Map pin: extend `overworldDungeonPortals` (or a sibling `realmPortals`) plus a
  `--color-*-portal` token in the map/minimap color tables.

### Isolation and determinism

- Realms sit in their own coordinate bands with no roads connecting them, reached
  only by portal, so isolation is free (same mechanism as instances).
- One shared `mulberry32` RNG stream feeds all world-gen. CAMPS and object/harvest
  spawns draw RNG in array order; APPEND new realm camps/objects LAST in `data.ts`
  or the parity draw-order fingerprint forks. Re-mint deliberately with
  `UPDATE_PARITY=1 npx vitest run tests/parity` in a separate reviewed commit.
- No wall-clock in sim; realm transitions and any timers use the sim clock.

### Reconciliation: gathering professions (Mining / Herbalism / Logging)

Main now has a gathering-professions system (`src/sim/professions.ts`,
`PlayerMeta.professions`, exposed on the reputation IWorld facet + net snapshot).
Each `HarvestNodeDef` carries an optional `profession: 'mining'|'herbalism'|
'logging'` tag; working a tagged node trains that skill +1 (0 to 100),
deterministically (no rng, no emit, no parity impact). Existing tags:
blooms/flowers -> herbalism, ember/corrupt vents -> mining. Logging has NO nodes
yet.

Realm implications (fold into every realm):
- Every realm harvest node MUST carry a `profession` tag, or gathering it trains
  nothing. Blooms/oasis growth -> herbalism; mineral/crystal/obsidian veins ->
  mining; timber -> logging.
- Realms are how the professions grow. Assign nodes so realms advance the skills
  thematically: Emberwastes (herbalism oasis + mining obsidian/ember), Frostmere
  (mining ice-crystal + herbalism frostflora), a savanna/forest realm is where
  Logging finally gets its timber nodes.
- Cross-realm meta hook: professions are already per-character progression synced
  everywhere, so realm gathering feeds a global skill for free. OPTIONAL small
  engine addition to give it teeth: a `minSkill?: number` gate on `HarvestNodeDef`
  + a check in `harvest.ts`, so higher-realm rare nodes (e.g. the Sunflare Bulb's
  premium variant) require a profession floor. Not built yet; flagged as the
  natural way to tie the rare-seed hybrid meta to profession progression. Do NOT
  add the gate speculatively; only if we decide professions should gate realms.
- The rare-seed legendary-hybrid meta (M3) can require high Herbalism to grow,
  linking the two progression tracks.

### Gates each realm must clear

- Parity goldens (`tests/parity`): append camps last; re-mint on purpose.
- Wiki bestiary: add the realm's `*_MOBS` to the explicit import + spread in
  `scripts/wiki/build_content.mjs`; run `npm run wiki:content`; `wiki:stills` for
  any new model. `tests/guide.test.ts` git-diff-gates the generated file.
- i18n: add every new mob/npc/quest/zone/dungeon id to the id-lists in
  `src/ui/world_entity_i18n.ts` (it throws at load if an id is missing its source
  entry). English only; never edit the `i18n.locales/*` overlays. Run
  `npm run i18n:gen`. New sim-emit string literals need a matcher in
  `sim_i18n.ts` (S3 guard `tests/localization_fixes.test.ts`).
- Purity (`tests/architecture.test.ts`): only relevant when adding engine logic;
  pure content data does not trip it.
- New biome: extend `BiomeId`; TypeScript forces the `Record<BiomeId,...>` table
  entries in `render/{terrain,foliage,sky}.ts`. Art is the real cost: sky needs a
  2K+1K HDRI and 8K+4K webp backdrop per biome (hook the existing lite-tier switch
  in `sky.ts`, do not add unconditional 8K loads). Terrain splats are largely
  shared (sand exists; snow reuses `snowC`). Regenerate the media manifest
  (`scripts/build_media_manifest.mjs`); never hand-edit `manifest.generated.ts`.

### Key file anchors

- `src/sim/instances/dungeons.ts` (enter/leave/slots), `src/sim/data.ts`
  (world-layout consts, band math, merges), `src/sim/sim.ts` (door + slot spawn
  at init), `src/sim/interaction.ts` (portal dispatch), `src/sim/world.ts`
  (`terrainHeight`/`zoneBiomeAt`), `src/sim/types.ts` (`DungeonDef`/`ZoneDef`/
  `BiomeId`/`MobTemplate`/`NpcDef`/`ItemDef`/`QuestDef`).
- `src/render/{terrain,foliage,water,sky}.ts` (biome tables),
  `src/render/renderer.ts` + `props.ts` (`buildDoorBody`, `delvePortalMaterial`).
- `src/ui/map_window_{view,painter}.ts`, `minimap_{markers,painter}.ts`,
  `map_dungeon_portals.ts` (map + portal pins), `world_entity_i18n.ts` (names).

## Milestone roadmap

- M1 - Engine + thin slice (DONE): realm-scoping seam (`terrainHeight`/`zoneAt`/
  `zoneBiomeAt` realm-aware) + `realm_portal` transition + realm-scoped map,
  proven with ONE sub-zone of the Emberwastes (portal in, one biome, the entry
  town, a few mobs, one quest, walk around, portal out). Shipped in four commits:
  M1.1 `RealmDef` type, M1.2 realm-scoped terrain, M1.3 portal transition, M1.4a
  portal spawn + render + i18n, M1.4b the Sunmourn Dunes content (3 dune mobs +
  camps, the Caravanserai's 3 NPCs, `q_ember_ward1`, the bloomspring node, and the
  `grow_sunflare_bulb` seed loop). Every seam validated; parity + i18n gates green.
  The map is still overworld-only (realm-scoped minimap deferred to M3).
- M2 - Emberwastes full build-out: all sub-zones, the dungeon, full quest arc,
  the rare-seed loop, the gear set. This is roughly the content volume of the
  current game and is the long pole.
- M3 - Generalize + Nexus: promote the hardcoding to a `RealmDef` registry, build
  the Bloomhaven Portal Nexus (a ring of realm portals), realm-scoped minimap,
  and the cross-realm rare-seed meta. Then stamp realm 2.

Note: a level cap raise (needed for realm 2 and beyond) is a separate XP/progression
task to schedule before M3.

## Realm 1: The Emberwastes (full draft)

A sun-scorched dimension where the sun never sets, reached through a heat-shimmer
portal on Bloomhaven's south edge. Level band 8 to 18. Desert biome (cheapest
new-biome art lift, and it holds internal variety across sub-zones).

Portal unlock: an intro quest from a Bloomhaven NPC plus a level 8 gate. A return
gate stands in the Caravanserai.

### Sub-zones (the Emberwastes zone strip)

1. Sunmourn Dunes (entry, 8 to 11)
   - Open rolling dunes, heavy heat shimmer. Portal arrival point.
   - Hub town: the Caravanserai (walled trade-post around an oasis well).
   - Creatures: Dust Scarab (beast, swarms), Sand Stalker (raptor-kin, packs),
     Sun-bleached Husk (undead, slow).
   - POI/landmark: the Broken Sun-Ward (first quest objective).
   - Oasis harvest: Bloomspring nodes yield the Sunflare Bulb (rare seed).

2. The Glass Canyons (11 to 14)
   - Wind-carved sandstone slots, obsidian veins, narrow walkable canyon floors.
   - Outpost: the Glassmaker's Reach (a lone artisan camp).
   - Creatures: Glassback Basilisk (beast, elite roamer), Canyon Shrike (flyer),
     Mirage Djinn (rare elemental, cloaks/blinks).
   - POI/landmark: the Second Sun-Ward, half-buried in a collapsed slot canyon.

3. Cinderreach (14 to 18)
   - Cracked volcanic scorchland, ash drifts, ember vents. Highest sub-zone.
   - Ruins: the Ember-cult amphitheater.
   - Creatures: Emberling (elemental swarm), Cinder Golem (elite), Ashen Zealot
     (humanoid caster, the cult).
   - POI/landmark: the Third Sun-Ward at the cult altar; entrance to the dungeon.

4. Dungeon: The Buried Dynasty (instanced, ~16 to 18, group)
   - A tomb-city under the dunes. Reached by a `dungeon_door` in Cinderreach
     (standard instance, reuses an existing interior look or a new `desert-tomb`
     interior if art allows).
   - Creatures: Mummified Guard (undead), Tombscarab Cluster, boss: the Scarab
     Broodmother.

### Town roster (the Caravanserai)

- Trade-Master (vendor): waterskins, desert travel gear, basic Sunforged pieces.
- The Wayfinder (quest-giver): owns the realm arc.
- Sun-Cultivator (Grow-Station attendant, `crafting:'grow'`): grows the Sunflare
  Bulb; sells the raw oasis reagent to close the loop.
- (Optional M2) a return-portal keeper for flavor.

### Weapons and armor: the Sunforged set

Obsidian-edged blades, glass-scale mail, sun-bleached leathers. Class-locked per
ARCHETYPE (warrior/rogue/mage groups, never a single class). Distributed as quest
rewards and dungeon/boss drops across the sub-zones so each has a reason to clear.
Item quality scales 8 to 18 across the realm.

### Rare seed loop: the Sunflare Bulb

- Harvest: Bloomspring nodes at the Sunmourn oasis (a `HarvestNodeDef` in
  `gathering.ts` yielding the raw bulb + a desert essence).
- Grow: the Sun-Cultivator turns the raw bulb into a `quality:'rare'` Sunflare
  Bulb via a `station:'grow'` recipe.
- Payoff (M3 meta): the Sunflare Bulb is one of N signature seeds, one per realm,
  that combine into a cross-realm legendary hybrid. This is the reason to farm a
  signature seed from every realm.

### Quest arc: "Why the Sun Won't Set"

- Intro (Bloomhaven, level 8): a stranded desert traveler / scholar asks you to
  step through the newly-opened heat-shimmer gate. Unlocks the portal.
- Q1 (Sunmourn Dunes): reach the Caravanserai; the Wayfinder explains the three
  sun-wards holding the realm ablaze. Reignite the Broken Sun-Ward (kill/collect
  in the Dunes).
- Q2 (Glass Canyons): recover the Second Sun-Ward's focus from a Mirage Djinn /
  the collapsed canyon.
- Q3 (Cinderreach): confront the Ember-cult at the amphitheater; learn the ritual
  keeping the sun up is anchored below.
- Finale (The Buried Dynasty dungeon): break the ritual at the Scarab
  Broodmother's tomb; the sun finally sets over the Emberwastes (a visible world
  state / lighting beat if feasible, otherwise a narrative payoff + gear reward).

### Portal

- Location: Bloomhaven south edge (near the existing starter area, past the level
  gate). A heat-shimmer gate reusing the delve-entrance visual, recolored amber,
  flanking braziers, a carved lintel reading "Emberwastes."
- Return: a matching gate in the Caravanserai.
- Implementation: `realm_portal` object with `targetRealmId:'emberwastes'`;
  `enterRealm` teleports to the Emberwastes `hubPos` (Caravanserai); the return
  gate carries `targetRealmId:'overworld'`.

## Emberwastes: implementation checklist

Content module: `src/sim/content/emberwastes.ts`, exporting `EMBERWASTES_REALM`
(RealmDef), `EMBERWASTES_ZONES`, `EMBERWASTES_MOBS`, `EMBERWASTES_NPCS`,
`EMBERWASTES_QUESTS`, `EMBERWASTES_QUEST_ORDER`, `EMBERWASTES_ITEMS`,
`EMBERWASTES_CAMPS`, `EMBERWASTES_OBJECTS`, `EMBERWASTES_DUNGEON_DEFS`,
`EMBERWASTES_DUNGEON_MOBS`. Wire each into `data.ts` at its merge point; APPEND
camps/objects LAST for parity.

### Mob roster

Families map to the existing `MobFamily` union (extend it only if a needed family
is missing).

| id | sub-zone | family | level | role |
|---|---|---|---|---|
| `dust_scarab` | Sunmourn Dunes | beast | 8-9 | swarm/trash |
| `sand_stalker` | Sunmourn Dunes | beast | 9-11 | pack |
| `sunbleached_husk` | Sunmourn Dunes | undead | 8-10 | slow bruiser |
| `glassback_basilisk` | Glass Canyons | beast | 12-13 | elite roamer |
| `canyon_shrike` | Glass Canyons | beast | 11-13 | flyer/harasser |
| `mirage_djinn` | Glass Canyons | elemental | 13 | rare, blink/cloak |
| `emberling` | Cinderreach | elemental | 14-15 | swarm |
| `cinder_golem` | Cinderreach | elemental | 16 | elite |
| `ashen_zealot` | Cinderreach | humanoid | 15-17 | caster (the cult) |
| `mummified_guard` | Buried Dynasty | undead | 16-17 | dungeon trash |
| `tombscarab_cluster` | Buried Dynasty | beast | 16 | dungeon swarm |
| `scarab_broodmother` | Buried Dynasty | beast | 18 | boss |

### Town NPCs (the Caravanserai)

| id | role | key fields |
|---|---|---|
| `ember_trademaster` | vendor | `vendorItems: [waterskin, sunforged basics]` |
| `ember_wayfinder` | quest-giver | `questIds: [q_ember_ward1, q_ember_ward2, q_ember_ward3, q_ember_finale]` |
| `ember_cultivator` | Grow attendant | `crafting: 'grow'`, sells the raw oasis reagent |

### Items: the Sunforged set + seed loop

- Weapons (archetype-locked): `sunforged_blade` (warrior), `sunforged_dagger`
  (rogue), `sunforged_scepter` (mage).
- Armor: `glassscale_mail` (mail), `sunbleached_leathers` (leather),
  `sunspun_robes` (cloth). Quality scales 8 to 18 across the realm; distribute as
  quest rewards + dungeon/boss drops.
- Rare-seed loop: `sunflare_bulb_raw` (junk reagent from the oasis) +
  `ember_essence` (REUSE the existing essence from `ember_vent` nodes) ->
  `sunflare_bulb` (`quality:'rare'`) via the Grow Station.

### Harvest + grow (in `gathering.ts` / `crafting.ts`)

Every realm node carries a `profession` tag (see the professions reconciliation
in Architecture): working it trains that skill +1. The Emberwastes seed loop
touches BOTH professions, which is intentional (Herbalism grows it, Mining
supplies the essence).

- `HarvestNodeDef` `bloomspring` (Herbalism): `profession: 'herbalism'`, yields
  `{sunflare_bulb_raw: 3, common_seed: 1}`; `HARVEST_NODE_SPAWNS` at the Sunmourn
  oasis positions.
- `HarvestNodeDef` `obsidian_vein` (Mining): `profession: 'mining'`, in the Glass
  Canyons, yields a desert mineral + the existing `ember_essence` (so the realm
  has its own Mining nodes, not just reused ember vents).
- `CraftRecipe` `grow_sunflare_bulb`: `station:'grow'`, inputs
  `sunflare_bulb_raw x2 + ember_essence x1`, output `sunflare_bulb x1`,
  `requiredLevel: 10`.

### Quest chain

| id | giver | objectives | gate | reward |
|---|---|---|---|---|
| `q_ember_intro` | a Bloomhaven NPC | interact: step through the new gate | `minLevel: 8` | unlocks the portal |
| `q_ember_ward1` | `ember_wayfinder` | reignite the Broken Sun-Ward (kill `sand_stalker` x, collect ward-shard) | after intro | XP + a Sunforged piece |
| `q_ember_ward2` | `ember_wayfinder` | recover the focus from `mirage_djinn` / the collapsed canyon | `requiresQuest: q_ember_ward1` | XP + gear |
| `q_ember_ward3` | `ember_wayfinder` | confront the cult at the amphitheater (kill `ashen_zealot` x) | `requiresQuest: q_ember_ward2` | XP + gear |
| `q_ember_finale` | `ember_wayfinder` | break the ritual: kill `scarab_broodmother` in the Buried Dynasty | `requiresQuest: q_ember_ward3`, `suggestedPlayers: 3` | set piece + sunset payoff |

### Portal objects

- Overworld gate: `realm_portal` at Bloomhaven south edge, `targetRealmId:
  'emberwastes'`, gated on `minLevel 8` + `q_ember_intro`. Visual: delve-entrance
  recolored amber.
- Return gate: `realm_portal` in the Caravanserai, `targetRealmId: 'overworld'`.

### M1 slice (build + verify this first, ships nothing to players)

Sunmourn Dunes ONLY, end to end: the desert biome + realm-scoping seam + both
portals + the Caravanserai (3 NPCs) + the 3 dune mobs + camps + the `bloomspring`
node + `grow_sunflare_bulb` + `q_ember_intro` + `q_ember_ward1`. Success = portal
in, walk the dunes, take/turn-in the quest, harvest+grow the seed, portal out,
with determinism intact.

M1 engine tasks (the code, in dependency order):
1. DONE (M1.1): the `RealmDef` type is in `types.ts`. Biome: the existing `'vale'`
   biome is already coded as "a sun-baked desert" (warm ochre palette, sand splat,
   arid HDRI), so the Emberwastes prototype REUSES `biome:'vale'` on its zones and
   already reads as desert with zero biome-table churn. A distinct `'desert'` /
   `'scorchland'` biome (redder dunes, harsher sky, Cinderreach ash) is deferred to
   a later visual-polish pass; adding a `BiomeId` literal then forces ~21
   `Record<BiomeId,...>` entries across `render/{terrain,foliage,sky,motes,renderer}`
   + `world.ts` (compiler-guided) plus art.
2. Add the `RealmDef` type (`types.ts`) + `EMBERWASTES_REALM` with an unused far
   coordinate band and its own `terrainSeed`.
3. Make `terrainHeight` / `zoneAt` / `zoneBiomeAt` (`world.ts` + `data.ts`)
   realm-aware (resolve against the band's realm; overworld unchanged). Guard with
   a new `tests/parity` scenario and a `world.ts` unit test.
4. Add the `realm_portal` templateId + `enterRealm`/`leaveRealm` on `SimContext`
   + dispatch in `interaction.ts` + a proximity trigger (mirror `dungeon_door`).
5. Add the realm discriminator to `IWorld` (`world_api.ts` + `Sim` + `ClientWorld`)
   and make the map/minimap realm-scoped (`map_window_view.ts` bg-cache key ->
   `realmId:zoneId`).
6. Render the portal body (`renderer.ts` branch reusing `buildDoorBody` /
   `delvePortalMaterial`) + a map/minimap portal pin + `--color-*-portal` token.
7. Author the M1-slice content module + wire into `data.ts` (append last).
8. Gates: id-lists in `world_entity_i18n.ts`; `build_content.mjs` mob import;
   `npm run i18n:gen`; `UPDATE_PARITY=1` re-mint; `wiki:content`; run
   `architecture`, `guide`, `localization_fixes`, `parity`.

## Open questions / TODO

- Level cap: raise past 20 before realm 2 (XP curve + itemization). Realm 1 fits
  under the current cap.
- Desert dungeon interior: reuse an existing interior (zero render work) or author
  a `desert-tomb` interior (new render + collider builder)?
- Sunset finale: is a per-realm dynamic sky/lighting state in scope, or narrative
  payoff only for M2?
- Party vs solo realms: are realms shared open-world (one band, no `partyKey`) or
  per-party instanced? Recommendation: shared open-world per realm (like the
  overworld), with dungeons inside them instanced per party.
