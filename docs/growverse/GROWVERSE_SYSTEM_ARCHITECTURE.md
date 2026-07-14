# GROWVERSE: System Architecture &amp; Dependency Map (Phase 0)

Date: 2026-07-14. Companion to `GROWVERSE_CURRENT_STATE_AUDIT.md`. This doc answers the master
directive's core architecture question: **can the current architecture support the target
vision, and what must change first?**

---

## 1. The load-bearing architecture (keep this)

Growverse is built on three ideas that are genuinely good and must be preserved:

1. **One sim, three hosts.** The exact `src/sim/` code runs offline (browser), on the
   authoritative server, and headless (RL env). Behavior is identical everywhere.
2. **`IWorld` is the only seam.** `src/world_api.ts` (split into 21 domain facets, 145 members)
   is the contract that `render/` and `ui/` depend on. The offline `Sim` and the online
   `ClientWorld` both implement it. Render/UI never touch a concrete world.
3. **The server is authoritative.** Clients stream movement intent + commands at 20 Hz; the
   server runs the one shared `Sim` and returns interest-scoped delta snapshots. All combat,
   loot, quest credit, and economy resolve server-side.

Internally, `src/sim/` is a **thin coordinator (`sim.ts`) + system modules behind one seam
(`SimContext`, `sim_context.ts`)**. State lives on `Sim`; modules hold functions and talk only
to `SimContext`. This is a mature, well-documented pattern (the "SimContext campaign" has
already lifted ~12k lines of systems out of `sim.ts`). New sim systems land as sibling modules,
not as method clusters on the monolith.

**Determinism is enforced, not aspirational.** `tests/architecture.test.ts` (24/24 passing)
scans every sim file and fails on nondeterminism (`Math.random`/`Date.now`/`performance.now`),
DOM globals, or forbidden imports. Same seed = same world.

---

## 2. System dependency map (as-built)

```
CLIENT (browser / desktop / mobile)
  main.ts  -- the only module that knows BOTH a concrete world AND the renderer/HUD
    |-- Sim (offline)  -+
    |-- ClientWorld ----+ both implement --> IWorld (world_api.ts, 21 facets, 145 members)
    |     (net/online.ts)|
    |-- render/ ---------+--> reads IWorld (+ pure sim terrain math); never mutates
    |-- ui/ (hud.ts) ------> reads IWorld via painter_host + *_view cores
    `-- game/ (input, camera, keybinds, mobile, audio)

SERVER (authoritative, single process, 20 Hz)
  server/main.ts --> GameServer (server/game.ts)
    |-- one Sim (in-memory, one SpatialGrid, all NPCs+mobs resident)
    |-- broadcastSnapshots --> interest-scoped delta snapshots --WS--> ClientWorld
    |-- db.ts (Postgres) --> character.state JSONB blob + world_state JSONB
    `-- auth / moderation / social / market / daily_rewards / wallet

THE SIM CORE (src/sim/, host-agnostic)
  sim.ts (coordinator: clock, tick order, IWorld facade, inventory hub, persistence)
    `-- SimContext seam --> system modules:
         combat/*  quests/*  loot/*  market  pet/*  social/*  instances/*
         delves/*  encounters/nythraxis  mob/*  progression/*  targeting
    content/*  (data-as-code: classes, talents, items, zones, dungeons, crafting, gathering)
      `-- merged by data.ts --> flat tables (ITEMS/MOBS/NPCS/QUESTS/ABILITIES/...)
```

### Vision-oriented dependency map (what the target systems attach to)

```
PLAYER
|-- Combat ........... COMPLETE (combat/*, classes, talents)
|-- Inventory/Equip .. COMPLETE (items.ts, loot/*)
|-- Quests ........... PARTIAL  (quest_credit.ts; needs objective types + branching)
|-- Professions ...... PARTIAL  (crafting stations exist; no skill leveling)
|-- Factions/Rep ..... MISSING  (new SimContext module + IWorld facet)
|-- Character look ... PARTIAL  (skin-only; no gender/hair/face)
|-- Achievements ..... MISSING
`-- Portals/travel ... MISSING

CULTIVATION (the identity pillar; today only theming)
|-- Seeds/Strains .... PLACEHOLDER (junk items, no lifecycle)
|-- Planting/Growth .. MISSING  (new tick-phase + Entity/PlayerMeta state)
|-- Genetics/Breeding  MISSING  (new manageable data model)
|-- Harvest .......... PARTIAL  (node gathering exists; not plant harvest)
|-- Curing/Extraction  PARTIAL  (crafting stations; reskin path exists)
|-- Sessions (buffs) . MISSING  (wire strains -> auras/item-use; low cost)
`-- Cooking/Alchemy .. COMPLETE-ish (stations exist)

WORLD/SOCIAL
|-- Zones/Regions .... COMPLETE engine; content 20-25% re-themed
|-- Dungeons/Delves .. COMPLETE
|-- Guilds ........... PLACEHOLDER (name+rank string; no bank/perms/progression)
|-- Settlement/Camp .. MISSING (large; multiplayer-sensitive)
`-- Economy/Market ... COMPLETE (per-realm; no item-instance ledger)
```

---

## 3. Expandability by dimension (can it hold the vision's scale?)

| Vision requirement | Current support | Verdict |
|---|---|---|
| Large numbers of items | `ItemDef` records + weighted loot tables, data-driven | **Yes** |
| Hundreds/thousands of quests | `QuestDef` records scale in count; framework thin in variety | **Count yes; variety needs work** |
| Many NPCs | `NpcDef` records; but all instantiated into one grid at boot | **Data yes; runtime no (see blockers)** |
| Multiple regions | zone bands as data; but hardcoded terrain seams + hand-spread merge + 1 resident world | **Partial; needs streaming** |
| Professions | crafting is data; no skill-level framework | **Needs new layer** |
| Large crafting recipe DBs | recipes are pure data | **Yes** |
| Genetics | nothing exists | **Net-new (design for a bounded model)** |
| Factions / reputation / persistent decisions | nothing exists; blob persistence not built for it | **Net-new + persistence work** |
| Player economy at scale | auction house works per-realm; no item-instance identity/ledger | **Needs relational economy** |
| Guilds / raids | raids in-memory; guilds are a name string | **Needs real subsystems** |
| Live content expansion | content-as-code => redeploy + restart (disconnects all) | **Needs data-driven content** |

---

## 4. Architecture blockers (must be solved before major expansion)

These are the things that will actively stop the vision if not addressed. Two are hard
(server re-platforming); the rest are framework gaps that can be built incrementally.

### Hard blockers (server / persistence re-platforming)

**B1. Single-process / single-thread / single-world runtime.**
One `Sim`, one `SpatialGrid`, one 20 Hz loop; all snapshot serialization + `JSON.stringify`
run on the same event-loop thread (`server/game.ts:997`). `WORLD_SIZE = 360` is tiny, so
players cluster in hubs and the interest scan degrades toward O(N^2). Realistic ceiling
**~50 to 200 co-located players** per process. "Multiple regions, thousands of players" cannot
live in one in-memory world. "Realms" (`server/realm.ts`) are duplicated *isolated* worlds
(separate-server sharding), not one distributed world.
-> Needs: zone/shard servers with player handoff, a gateway/interest layer, and snapshot
serialization moved off the tick thread. **Large effort; defer until concurrency demands it,
but design new systems so they do not deepen the single-world assumption.**

**B2. JSONB-blob persistence + content-as-code.**
All character gameplay state is ONE `characters.state JSONB` blob rewritten whole every ~30s
(`serializeCharacter` -> `saveCharacterState`, `db.ts:1812`); the World Market is one
`world_state` blob. There is no relational item-instance / quest-progress / reputation /
faction table, so no economy audit, dupe forensics, or partial writes. Quests/NPCs/items are
hardcoded TS merged at boot, so "live content expansion" = code deploy + restart (disconnects
everyone).
-> Needs: normalized tables for the high-growth state (item instances, quest progress,
reputation, faction standing) with incremental writes, a versioned migration framework, and a
path to data-authored content. **The `daily_rewards` relational schema is the template; the
`*_db.ts` SQL-isolation convention lets this be done behind existing seams, not a rewrite.**

### Framework blockers (build incrementally, behind existing seams)

- **B3. Quest framework depth.** Add objective types (escort, deliver, timed, reach-location,
  reputation) and branching/choice/consequence to `QuestObjective` + `quest_credit.ts` + turn-in.
  Needed for the vision's quest philosophy. Additive to a data-driven system.
- **B4. Cultivation as a real system.** New sim module behind `SimContext` (plant entities +
  growth tick phase + a bounded genetics model), a new `IWorld` cultivation facet implemented
  in both worlds, and a garden/genetics UI. The single largest identity build.
- **B5. Reputation/faction system.** New `SimContext` module + `IWorld` facet + persistence
  column + rep-gated vendor/unlock hooks + a faction UI panel.
- **B6. Content id-integrity validation.** There is no compile/CI check that a `loot.itemId` or
  `requiresQuest` id exists; at MMORPG content scale this must be a test/CI gate.
- **B7. Scripted-encounter authoring path.** `encounters/nythraxis.ts` is 1.2k bespoke lines;
  a reusable encounter-scripting framework turns each boss from engineering into content.

### The per-system "seam tax" (not a blocker, but the dominant cost)

Every new *interactive* system pays a fixed tax: define an `IWorld` facet + wire commands,
implement **every member in both `Sim` and `ClientWorld`**, and pass three parity gates (W0a
snapshot round-trip, W0b command-schema lockstep, W0c 145-member parity). This is disciplined
and safe (it is what keeps offline == online), but it front-loads cost onto the seam + sim, not
the HUD. Read-only display panels (reputation bars) are cheap; command-heavy systems
(cultivation) are where the tax is paid. Plan each identity system as a full vertical slice
(sim + seam + both worlds + UI) because the "no dead buttons" rule forbids UI ahead of system.

---

## 5. Architecture decision

**Do NOT rewrite.** The sim core, `IWorld`/`SimContext` seams, client framework, renderer,
auth, moderation, and networking primitives are MMORPG-grade and are exactly what a controlled
migration should build on. The correct strategy is:

1. **Build the identity systems additively** behind the existing seams (cultivation, Sessions,
   factions, then settlements/portals/collections), each as a full vertical slice with tests.
2. **Migrate persistence incrementally** off the JSONB blob for the *new high-growth* state
   only (item instances, reputation, faction, quest progress) using the `daily_rewards`
   relational pattern, while leaving the working blob for legacy fields until proven.
3. **Defer the single-world re-platforming (B1)** until concurrency actually demands it, but
   add a content id-integrity gate (B6) now, and do not deepen the single-world assumption in
   new systems.
4. **Keep every change green** against `tsc`, `tests/architecture.test.ts`, the parity gates,
   and the i18n S3 guard, these are the safety rails that make autonomous, controlled
   migration possible.
</content>
