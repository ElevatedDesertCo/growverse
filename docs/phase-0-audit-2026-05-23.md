# Phase 0 Audit — 2026-05-23

> Read-only inspection of `claude/portal-awakening` branch (forked from
> `main` after PR #1 merge). **No destructive changes.** Per latest spec:
> identify what exists, what's missing, and recommend the next step.

## Snapshot

- Branch: `claude/portal-awakening` (forked from `main` @ `f43f434`)
- Phase 1 (v1.1 GDD) is merged to main and live on Vercel.
- Tech stack: Next.js 16 App Router, TypeScript, Tailwind v4, Zustand v5 (with `persist`), Framer Motion v12, Lucide React.
- No new dependencies needed for Phases 1–7 of the v2 roadmap.

---

## 1. What Already Exists

### Code

| Path | Purpose | Status |
|---|---|---|
| `app/layout.tsx` | Root layout, fonts (Cinzel + Inter), metadata, viewport, PWA meta | ✅ |
| `app/page.tsx` | Renders `<GameShell />` | ✅ |
| `app/globals.css` | Color tokens, Tailwind base | ✅ |
| `app/manifest.ts` | PWA manifest (Next.js convention) | ✅ |
| `app/icon.png` / `app/apple-icon.png` | App icons | ✅ |
| `lib/buildings.ts` | `BuildingDef`, `BUILDINGS` record (4 types), `GRID_COLS/ROWS` | ✅ |
| `lib/economy.ts` | Pure functions: grow progress, ready-to-harvest, pending fire, cost/stat at level, canAfford | ✅ |
| `lib/store.ts` | Zustand store + `persist` middleware. All gameplay actions (place/move/upgrade/harvest/collectFire/drag/tick/resetSave). Grid coordinate helpers. | ✅ |
| `components/game/GameShell.tsx` | Top-level layout composition | ✅ |
| `components/game/SplashScreen.tsx` | 3-phase intro splash with bar | ✅ |
| `components/game/ResourceBar.tsx` | 3-pill resource header + SettingsButton mount | ✅ |
| `components/game/BaseGrid.tsx` | 16×16 grid, drag preview, empty-state hint | ✅ |
| `components/game/BuildingTile.tsx` | Building art renderer, progress ring, fire badge | ✅ |
| `components/game/DraggableBuilding.tsx` | Long-press 2.5s, drag-to-move, tap routing (harvest → collect → upgrade) | ✅ |
| `components/game/BuildMenu.tsx` | Bottom drawer, draggable cards, cost display + lock | ✅ |
| `components/game/UpgradeModal.tsx` | 5-tier upgrade panel with stat comparison | ✅ |
| `components/game/BottomNav.tsx` | 5 tabs + Edit/Build action cluster, build-button pulse | ✅ |
| `components/game/SettingsButton.tsx` | Settings sheet with reset-save | ✅ |
| `components/game/TickMount.tsx` | 500ms global tick + persist rehydrate | ✅ |
| `components/game/WelcomeBackToast.tsx` | Offline-progress summary toast | ✅ |
| `components/game/SWRegister.tsx` | Service worker registration (production only) | ✅ |
| `public/sw.js` | Minimal service worker, pre-caches assets | ✅ |

### Docs

| Path | Purpose |
|---|---|
| `docs/growverse-gdd.md` | v1.1 (Phase 1 lock) |
| `docs/growverse-phase-1-build-plan.md` | Original 5-sprint plan |
| `docs/growverse-gdd-v2.md` | **NEW — Phase 0 deliverable** (this audit batch). Full v2 design, characters, resources, buildings, screens, 10-phase roadmap |
| `docs/portal-awakening-cinematic.md` | **NEW — Phase 0 deliverable** (this audit batch). Scene script for Chapter 1 cinematic |
| `docs/phase-0-audit-2026-05-23.md` | **THIS FILE** |

### Asset libraries (already in `public/`)

| Folder | Count | Use |
|---|---|---|
| `public/buildings/` | 4 PNGs | Phase 1 buildings (live) |
| `public/buildings-library/` | 14 PNGs | **Available for v2 buildings** — incl. Training Grounds, Bloom Reservoir, Spirit Shrine, Soul Altar, Myco Reliquary, Seed Reliquary, Amber Vault, Obsidian Antichamber, Farm Plot, etc. |
| `public/defenses-library/` | 19 PNGs | **Available for v2 defense buildings** — incl. Reinforced Wall, Guard Tower, Gate Wall, Root Barrier, Ballista, Outpost Beacon, Snare Totem, Defense Tower, Doobie Cannon, etc. |
| `public/heroes/` | 7 PNGs | Hero/character renders (Bloom Scout, Bloom Collector, Ember Raider, Water Channeler) — **not aligned to canon names** but usable for some Growers (e.g., Water Channeler could be Raiin placeholder) |
| `public/ui/` | 13 PNGs | UI frames, buttons, boards — useful for card UI in Phase 6 |
| `public/effects/` | 5 PNGs | Spell/effect sprites |
| `public/decor/` | 8 PNGs | Environment props for raid maps later |
| `public/terrain/` | 1 sheet | Desert tile / placement grid |
| `public/brand/` | 1 splash | Growverse splash screen |
| `public/icons/` | 8 PNGs | Resource icons (leaf, fire, mushroom) + framed icon set + action icons |

### Tech

- TypeScript strict ✅
- Zustand v5 `persist` middleware **already in use** (saves work)
- Framer Motion v12 (for cinematic scene transitions later)
- PWA installable, service worker pre-caches splash + 4 buildings + 3 resource icons + manifest icons
- 500ms global tick already in place — time-aware systems hook into `_tickAt` for re-renders
- Pure on-read time math (no stored derived state) — offline progress already works

---

## 2. What's Missing (vs v2 canon)

Mapped against the v2 GDD requirements.

### Data modules (Phase 1 of v2 plan)

| File | Status |
|---|---|
| `lib/data/guilds.ts` | ❌ Missing — needs 6 guilds (Bloomveil, Ember, Water, Spores, Roots/Thorn, Dustroot Archive) |
| `lib/data/resources.ts` | ❌ Missing — needs 8 resources with use-cases (Bloom Essence, Amber Shards, Myco Dust, Relic Fragments, Spirit Seeds, Portal Energy, Guild XP, Card Shards) |
| `lib/data/characters.ts` | ❌ Missing — needs 13 named characters (Anderz, Solace, Raiin, Vyrra, Davis, Fumez, Art, Wingus, Brazzle, Berle, Nicole, Armando, Carlito) + antagonists (Eris, Athir as Dustwarden) |
| `lib/data/spiritPets.ts` | ❌ Missing — needs pet defs (Solace, Vyrra, Fumez, Wingus, Berle, Ashira's fire-fox, plus Armando's wolf) |
| `lib/data/units.ts` | ❌ Missing — no unit system yet |
| `lib/data/cards.ts` | ❌ Missing — categories: Growers, Spirit Pets, Abilities, Relics, Terrain, Guild Blessings, Strains, Pure Art Collector Cards |
| `lib/data/quests.ts` | ❌ Missing |
| `lib/data/chapters.ts` | ❌ Missing — at least Chapter 1 (Portal Awakening) + Chapter 2 (Reality Has Trust Issues) |
| `lib/data/raids.ts` | ❌ Missing |
| `lib/data/rewards.ts` | ❌ Missing |
| `lib/buildings.ts` | ⚠ **Exists but incomplete** — currently 4 of 15 canon buildings (Grow Tent, Bloom Extractor, Amber Forge, Thorn Trap). Missing: Guild Core, Myco Extractor, Storage Vault, Training Grounds, Spirit Nursery, Portal Gate, Relic Workshop, Defense Totem, Vine Wall, Spore Trap, Flame Totem, Water Channel, Root Wall. |

### Systems modules (Phase 2+ of v2 plan)

| File | Status |
|---|---|
| `lib/systems/resourceSystem.ts` | ❌ Missing — economy logic currently inside `store.ts` actions; needs extraction |
| `lib/systems/buildingSystem.ts` | ❌ Missing — building placement + footprint logic in `store.ts` |
| `lib/systems/upgradeSystem.ts` | ❌ Missing — upgrade action in `store.ts` |
| `lib/systems/raidSystem.ts` | ❌ Missing |
| `lib/systems/rewardSystem.ts` | ❌ Missing |
| `lib/systems/questSystem.ts` | ❌ Missing |
| `lib/systems/cardSystem.ts` | ❌ Missing |
| `lib/systems/spiritPetSystem.ts` | ❌ Missing |
| `lib/systems/progressionSystem.ts` | ❌ Missing |

### Component folders

| Folder | Status |
|---|---|
| `components/base/` | ❌ — base-view-specific extracts not done. Currently lives in `components/game/`. Refactor target for Phase 2. |
| `components/characters/` | ❌ |
| `components/pets/` | ❌ |
| `components/raids/` | ❌ |
| `components/cards/` | ❌ |
| `components/story/` | ❌ — needs `OpeningCinematic` for Chapter 1 + `DialogueBox` + `ChapterDetail` |
| `components/quests/` | ❌ |

### Screens

5 of 14 live (Guild Base, Build Menu, Upgrade Panel, Resource Bar, Settings). **9 screens to build**: Main Menu, Character Roster, Spirit Pet Roster, Raid Map, Raid Battle, Story Chapter View, Card Collection, Booster Opening, Quest Log.

### Resources

3 of 8 live and connected to gameplay (Leaf, Fire, Mushroom). Mushroom is **placeholder** — currently has no generation source. The other 5 (Bloom Essence as 4th now, then Amber Shards, Myco Dust, Relic Fragments, Spirit Seeds, Portal Energy, Guild XP, Card Shards) ship as their systems land.

### Story / cinematic

- Chapter 1 (Portal Awakening): **script drafted** in `docs/portal-awakening-cinematic.md`. **Implementation pending.**
- Chapter 2 (Reality Has Trust Issues): not yet drafted. Title comes from a Solace canon line.

### TCG

- Zero card infrastructure. Comes in Phase 6 of v2 plan.

### Raids / units / pets

- Zero infrastructure. Phases 4–5 of v2 plan.

---

## 3. Compatibility / Naming Conflicts (must resolve before code changes)

| Conflict | Recommendation |
|---|---|
| **Phase 1 building names vs v2 canon.** `growTent` and `thornTrap` aren't in the v2 canon 15-building list. | **Don't rename type ids** (would break saves). Update only the `name` / `description` fields in `BUILDINGS`: `growTent` → display "Bloom Garden" (or fold into Bloomveil), `thornTrap` → display "Root Wall". Type id `growTent` keeps producing what it currently produces (now labeled "Bloom Essence" instead of "Leaf"). |
| **Phase 1 resource names vs v2 canon.** Store fields are `leaf` / `fire` / `mushroom`. | **Don't rename fields** (would break saves). Add a label-mapping helper that displays "Bloom Essence" / "Amber Shards" / "Myco Dust" while the underlying fields stay v1.1 names. Migration to canonical field names = a separate Phase 3+ chore with a save-migration step. |
| **Recommended structure says `src/data/*.ts` and `src/systems/*.ts`.** Current codebase has no `src/` folder — TS modules live at project root in `lib/`. | **Stay with `lib/`** and create `lib/data/` + `lib/systems/`. Moving to `src/` requires updating tsconfig paths, all imports, and a re-test of every page. High risk for zero functional gain. |
| **Phase 6 in user's plan = TCG; Phase 6 of original Phase 1 plan = the just-merged PWA chunk.** Confusing overlap. | The v2 GDD's numbering replaces the old plan. The v1.1 plan is **complete and frozen**; all future planning references the v2 phase numbers. |
| **The `mushroom` resource has no generation source today** and is showing `0` on the live game. | Either (a) hide the pill until a Myco Extractor exists, or (b) ship Bloom Essence as the new 4th pill alongside and accept that mushroom = 0 until Phase 4. Recommend (b) for forward consistency. |

---

## 4. Recommended Next Step: v2 Phase 1 (Data Foundation)

Why first:
- Pure additive — touches no live game code, breaks nothing.
- All later phases depend on it (Phase 2 ResourceBar refactor needs `data/resources.ts`; raids need `data/raids.ts`; etc).
- Lets us capture and lock the canon in code, not just docs — single source of truth.
- Cheap to verify: it's all TypeScript records with strict types; no runtime behavior change.

**Suggested commit pattern** for v2 Phase 1:
1. `lib/data/types.ts` — shared base types
2. `lib/data/guilds.ts` — 6 guilds with elements + leaders + spirit pets
3. `lib/data/resources.ts` — 8 resources with use-case descriptions
4. `lib/data/characters.ts` — 13+ named characters with portraits/dialogue tone tags
5. `lib/data/spiritPets.ts` — pets with bond-level/ability slots (no logic yet — just shape)
6. `lib/data/units.ts` — empty record + types
7. `lib/data/cards.ts` — card type taxonomy
8. `lib/data/quests.ts`, `lib/data/chapters.ts`, `lib/data/raids.ts`, `lib/data/rewards.ts` — record shapes
9. `lib/buildings.ts` extension — add the 11 missing canon buildings as new types (no UI yet — they exist in data but won't appear in BuildMenu until P2 wires them up gated by Guild Core level)

**Estimated scope**: ~10 new TypeScript files, ~1000 lines of typed data, zero
component changes, zero behavior change. Safe to ship in one commit.

After Phase 1 (data foundation) lands, the obvious Phase 2 work is the
ResourceBar 4th pill + Bloom Essence wiring + Guild Core building with the
damaged-→-repair flow, since (a) it's small, (b) it visibly delivers the new
v2 economy, and (c) it preps the chapter system for Chapter 1.

---

## 5. Files Created in This Audit Batch

- `docs/growverse-gdd-v2.md` (v2 GDD — supersedes v1.1)
- `docs/portal-awakening-cinematic.md` (Chapter 1 script)
- `docs/phase-0-audit-2026-05-23.md` (this file)

## Files Modified in This Audit Batch

- None. Phase 0 is read-only.

## Known Limitations

- The cinematic script in `portal-awakening-cinematic.md` references 7 scene
  backdrops and 5+ character/narrator beats. Phase 3 will need at least
  silhouette placeholders for Anderz + Solace + Eris. The script is written
  to work with text-only narration + the existing splash bg until portraits
  are commissioned.
- The recommended `lib/systems/` extraction (Phase 2+ of v2 plan) means
  moving code out of `store.ts`. The current store has all economy logic
  baked in; the extraction is mechanical but must be done carefully to
  preserve persist middleware behavior + Zustand selector hooks.
- Mushroom is still 0 with no source. Acceptable for now.

## Recommended Next Phase

**v2 Phase 1 — Data Foundation.**
~10 new `lib/data/*.ts` files, all typed records, zero behavior change.
Locks the canon in code.

Reply with the green light and I execute Phase 1 as a single commit (or
split per-file if you'd rather review incrementally).

---

End of audit.
