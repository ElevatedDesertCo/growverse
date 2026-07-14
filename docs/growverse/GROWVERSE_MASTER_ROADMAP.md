# GROWVERSE: Master Roadmap (Phase 0 output)

Date: 2026-07-14. Built from `GROWVERSE_CURRENT_STATE_AUDIT.md` and
`GROWVERSE_SYSTEM_ARCHITECTURE.md`. This is a prioritized, evidence-based sequence for turning
the current classic-MMO base into the Growverse vision **without a rewrite**. Priorities use
the master directive's P0 to P4 scheme.

Guiding principle: **finish the divergence identity from the inside out** (make the first hour
unmistakably Growverse and build the one signature system) before scaling breadth. Do not build
P4 polish while P0 items are red. Each identity system ships as a full vertical slice (sim +
`IWorld` seam + both worlds + UI + tests), because the "no dead buttons" rule forbids UI ahead
of a real system.

---

## 0. Priority classification of the known work

- **P0 (critical / blockers):** fix the red `sim.test.ts` fishing regression; add content
  id-integrity CI gate; decide the canon open questions that gate all content work.
- **P1 (core experience):** cultivation-to-Sessions vertical slice; quest-framework depth;
  starter-zone divergence (ids/text/mobs/POIs).
- **P2 (major Growverse identity):** genetics/breeding; factions/commune reputation; finish
  zone-by-zone divergence; incremental persistence migration for new state.
- **P3 (content expansion):** more zones/quests/NPCs/creatures/bosses; settlements; portals;
  professions with skill levels; collections/achievements.
- **P4 (polish):** Growverse HUD identity re-skin; character creator; audio identity; VFX.
- **Deferred hard blocker:** single-world server re-platforming (only when concurrency demands).

---

## 1. Quick wins (dramatic improvement, low destabilization risk)

These are high-value, mostly data-only or self-contained, and safe to do first.

| # | Quick win | Why it matters | Files | Risk |
|---|---|---|---|---|
| QW1 | Fix the Mirror Lake fishing-cast regression (DONE) | `npm test` was RED and blocked CI; a by-design `q_murlocs` Siltling reached the reseated dock's computed fishing spot. Fixed test-first (clear mobs, matching sibling fishing tests) | `tests/sim.test.ts` | Low |
| QW2 | Add content id-integrity test/CI gate | No check that `loot.itemId`/`requiresQuest`/spawn ids exist; a typo ships silently and this is a landmine at content scale | new `tests/content_integrity.test.ts`, `src/sim/data.ts` | Low |
| QW3 | Wire Sessions (strain buffs) onto existing items (DONE) | Turns the "grow" theme into real power via Bloom tonics (elixir extension): spark (instant) vs edible (delayed onset), Restful/Lively/Balanced profiles, restful couch-lock tradeoff. Brewed at the Alchemy Lab from Bloom Extract. Reuses the auras + "You quaff" path; no seam changes | `sim/sessions.ts` (new), `types.ts`, `entity.ts`, `items.ts`, `sim.ts`, `net/online.ts`, `content/crafting.ts`, `tests/sessions.test.ts` | Low-Med |
| QW4 | Execute the starter-zone divergence (data-only) | Breaks the WoW "kill wolves/boars/spiders" fingerprint in the first hour; ids/text/mob-names/POIs per `starter-zone-redesign.md` | `content/zone1.ts`, `src/ui/world_entity_i18n.ts` | GATED (see below) |

**QW4 is gated (not a clean autonomous change):**
1. **Owner canon.** The names are exactly what `docs/design/starter-zone-redesign.md`
   section 7 lists as open: real Baked Beaver NPC names, the antagonist ("the Dry" vs the
   comedic "Narcs"), and per-quest tone. Authoring names without canon risks rework and
   violates the "use real IP, do not invent" rule.
2. **Localization scale.** Renaming any mob/NPC/quest/POI or rewriting a quest narrative
   creates a new wordy English value in the resolved catalog (`entities.*`), and
   `tests/i18n_completeness.test.ts` (M16) reds at PR tier on any such value left
   byte-identical in the five non-Latin locales (zh_CN/zh_TW/ja_JP/ko_KR/ru_RU). A full
   starter rewrite is ~15 to 20 names + narratives x 5 locales, a maintainer-coordinated
   i18n pass, not a solo English-only edit. (This same gate applies to Phase D's
   zone-by-zone divergence.) Proper-noun brand terms (e.g. "Baked Beaver", "The Sluice")
   can go on the M16 `BRAND_ALLOW` list; common names and prose cannot.

Recommended handling: land the divergence in small batches where the five non-Latin fills
are supplied in the same change (owner/maintainer), starting once the canon in
`starter-zone-redesign.md` section 7 is decided.
| QW5 | Extract fishing channel out of `sim.ts` into `fishing.ts` | Removes a documented duplication (mirrors `harvest.ts`), shrinks the monolith, adds testability | `src/sim/sim.ts` -> new `src/sim/fishing.ts` | Low |
| QW6 | Branding convergence sweep (domain/token/package audit doc) | The rebrand is half-done (old brand in 220 files: canonical URL, mobile package ids, $WOC token); catalog what must change and stage it | `index.html`, `sitemap`, android/ios ids, `woc_balance.ts` | Med (identity-level; do as a tracked sweep, not ad hoc) |

QW1 to QW3 are the recommended immediate batch (see Recommended First Phase).

---

## 2. Architecture blockers to resolve (ordered)

From `GROWVERSE_SYSTEM_ARCHITECTURE.md` section 4:

1. **B6 content id-integrity gate**, do now (QW2). Cheap, prevents a class of content bugs.
2. **B2 incremental persistence migration**, begin when the first new persistent state lands
   (genetics, reputation). Use the `daily_rewards` relational pattern; do NOT migrate the whole
   blob at once.
3. **B3/B4/B5/B7 framework gaps**, build as each identity system needs them (quest depth with
   the quest pass; encounter framework when the second scripted boss appears).
4. **B1 single-world re-platforming**, deferred. Design new systems to not deepen the
   single-world assumption; revisit when sustained concurrency approaches the ceiling.

---

## 3. Phased roadmap

Each phase follows the master directive's required template.

### Phase A (P0/P1): Stabilize + make the first hour Growverse

- **Objective:** Green CI, an id-integrity safety net, real strain buffs, and a starter zone
  that teaches Grow/Fish/Fight/Faction instead of the WoW opener.
- **Why it matters:** The first hour is the fingerprint. This is the single highest-impact
  divergence and it is mostly data + one self-contained system slice.
- **Existing systems affected:** zone1 content, quests, items, crafting, auras/item-use, tests.
- **Files likely affected:** `src/sim/content/zone1.ts`, `content/items.ts`, `content/crafting.ts`,
  `src/sim/combat/auras.ts`, item-use path in `sim.ts`, `src/ui/world_entity_i18n.ts`,
  `src/ui/sim_i18n.ts`, `tests/sim.test.ts`, new `tests/content_integrity.test.ts`, wiki regen.
- **New systems required:** Sessions buff link (small); content id-integrity gate.
- **Data models required:** strain -> buff-profile mapping (Indica/Sativa/Hybrid); no schema change.
- **UI required:** reuse auras frames + item tooltips; a small "Session active" affordance.
- **Assets required:** none new (reuse existing icons); optional strain icons later.
- **Risks:** determinism draw-order if mob placement/RNG shifts (QW1); i18n S3 guard on new
  strings; wiki freshness gate.
- **Dependencies:** canon answers (section 5) for names/tone; otherwise none.
- **Testing:** `npx vitest run tests/sim.test.ts tests/architecture.test.ts`; new integrity test;
  parity gate if any `IWorld` touch; `npm run wiki:content`.
- **Definition of done:** `npm test` green; starter chain renames + teaches the pillars; strain
  buffs apply through auras; id-integrity gate passes and catches a seeded bad id.

### Phase B (P1/P2): Cultivation as a real system

STATUS: B-1 (sim core + persistence) and B-2 (IWorld seam: `world.garden` +
plantSeed/harvestPlot in both worlds + server dispatch + snapshot, all three seam gates
green) are DONE and shipped. B-3 (the Garden UI window) is handed off: the IWorld
surface is ready to consume, but the repo's UI contract requires visual + mobile
portrait/landscape + a11y verification in a running client, which a headless env cannot
do. UI-label i18n also hits the M16 gate (wordy `hudChrome.*` labels need five non-Latin
fills), so build the UI where a browser and the localization batch are available.


- **Objective:** Turn "growing" from theming into the signature mechanic: plant a seed at a
  plot, it grows over time, harvest yields strain material that feeds Sessions/crafting.
- **Why it matters:** It is the vision's headline pillar and the thing that makes Growverse
  not-a-clone. Sessions (Phase A) gives it a power payoff so growing wires to combat.
- **Existing systems affected:** new sim tick phase; `Entity`/`PlayerMeta` state; `IWorld` new
  facet in both worlds; new UI window; persistence for plots/plants.
- **Files likely affected:** new `src/sim/cultivation/*`, `sim_context.ts` (append callbacks),
  `types.ts` (plant/plot state), `entity.ts`, `world_api/` new facet, `net/online.ts`,
  `src/ui/cultivation_*`, `server/db.ts` (new table).
- **New systems required:** planting/growth-timer sim; garden plots; harvest-of-plant.
- **Data models required:** `PlantDef`/`Plot` state; genetics deferred to Phase C (keep v1
  single-strain, no breeding) to bound scope.
- **UI required:** garden-plot grid + growth-timer view + plant/water/harvest actions
  (bespoke panel via painter_host + a `cultivation_view` pure core).
- **Assets required:** plant growth-stage visuals (start with procedural/simple; KayKit-style).
- **Risks:** the seam tax (dual-world impl + parity); determinism of growth ticks (must use
  sim clock, not wall-clock); persistence write pattern (use relational, not the blob).
- **Dependencies:** Phase A (Sessions consumes the output); B2 persistence pattern.
- **Testing:** determinism/replay test for growth; parity gates; a `cultivation` unit suite.
- **Definition of done:** a player plants, waits (sim-timed), harvests, and the yield powers a
  Session, offline and online identically; state persists across relog.

### Phase C (P2): Genetics/breeding + factions/commune reputation

STATUS: SHIPPED (built as a strain-library model, not per-item genetics, so the id+count
inventory is untouched). Delivered in five slices, all green:
- C-1a (`src/sim/genetics.ts` + `strain_library.ts` + `content/genetics.ts`): the bounded
  diploid engine (3 traits, alleles 0..3, dominant/recessive expression, Mendelian breeding
  with an 8% per-allele mutation, a max-tier landrace), the per-player library on
  PlayerMeta (discover-on-harvest, breed, release), and persistence. Deterministic via the
  sim Rng.
- C-1b: planting a library strain (vigor shortens grow time; yield/potency scale the
  harvest, potency>=2 also drops Bloom Essence).
- C-1c (`src/sim/reputation.ts` + `content/reputation.ts`): the Baked Beaver commune, five
  standing tiers, gains from cultivating (+15) and breeding (+30, +150 landrace), and a
  rep-gated recipe (Prime Strain Seed at Honored).
- C-2: the IWorld seam (IWorldCultivation `strains` + plant/breed/release commands; a new
  read-only IWorldReputation), both worlds + server dispatch/snapshot, all three seam gates.
- C-3: the Breeding window UI (`breeding_view.ts` + `breeding_window.ts`), opened from the
  Grow Station, with the commune-standing header.
Not done (deferred, out of the original scope): a phenotype-preview before a cross;
cosmetic rep rewards; a relational genetics/rep DB table (state rides the existing
`characters.state` JSONB blob). The Breeding window still needs a running-client visual +
mobile + a11y pass (headless cannot verify), and the five non-Latin UI + item-name fills
want a native-speaker review.

- **Objective:** Cross-breed strains for traits (bounded model: a few dominant/recessive
  traits, mutation chance, rare phenotypes); add Baked Beaver commune reputation that gates
  strains/recipes/cosmetics.
- **Why it matters:** Depth + a home for the grind; both are named vision pillars and reinforce
  cultivation and the faction fantasy.
- **Existing systems affected:** cultivation module; new reputation module + facet; vendors.
- **Files likely affected:** `src/sim/cultivation/genetics.ts`, new `src/sim/reputation/*`,
  `sim_context.ts`, `world_api/` facets, both worlds, `server/db.ts` (rep + genetics tables),
  `content/*` (rep-gated vendor stock), new UI panels.
- **New systems required:** genetics inheritance; reputation standing/gains/gates.
- **Data models required:** a **bounded** trait model (avoid infinite useless records: cap
  traits, quantize expression); `reputation` table keyed by (character, faction).
- **UI required:** breeding UI (parent x parent -> outcome preview); faction/rep panel.
- **Assets required:** phenotype variance visuals (tints/props reuse).
- **Risks:** combinatorial explosion (mitigate with a capped trait set); persistence growth.
- **Dependencies:** Phase B; B2 persistence.
- **Testing:** deterministic breeding-outcome tests; rep-gain/gate tests; parity.
- **Definition of done:** two strains breed to a bounded, seed-deterministic offspring; rep
  gains from commune activities unlock at least one gated strain/recipe.

### Phase D (P2/P3): Zone-by-zone divergence + quest depth

- **Objective:** Re-theme zones 2 to 4 + Hollowmere from generic fantasy to Growverse (the
  "Dry" antagonist arc), and extend the quest framework (new objective types + branching/choice).
- **Why it matters:** Removes the bulk of inherited WoW identity; delivers the vision's quest
  philosophy (investigation, choices, consequences).
- **Existing systems affected:** `content/zone2-4.ts`, `hollowmere.ts`, quest framework,
  world_entity i18n, wiki.
- **Files likely affected:** `content/zone2.ts`, `zone3.ts`, `zone4.ts`, `hollowmere.ts`,
  `quests/quest_credit.ts`, `types.ts` (QuestObjective), `src/ui/world_entity_i18n.ts`.
- **New systems required:** quest objective types (escort/deliver/timed/reach/reputation);
  choice/branch tracking (world flags on the character).
- **Data models required:** extended `QuestObjective` union; quest-flag/choice storage.
- **UI required:** dialogue/choice UI (extends dialogue), quest tracker updates.
- **Assets required:** reskinned mob/POI visuals per divergence tables.
- **Risks:** determinism draw-order on content moves; i18n S3 guard volume; wiki freshness.
- **Dependencies:** Phase C rep (for reputation objectives/consequences).
- **Testing:** quest-progression suites; branching-outcome tests; i18n S3; wiki.
- **Definition of done:** zones 2 to 4 read as Growverse (no blight-wolf/gravewyrm strings);
  at least one branching quest with a persistent consequence works end to end.

### Phase E (P3): Settlements, portals, professions, collections

- **Objective:** Camp -> settlement progression, a portal/fast-travel network, profession skill
  leveling, and a collection/achievement log.
- **Why it matters:** Long-horizon progression + the portal identity + endgame variety.
- **Existing systems affected:** new subsystems + facets; persistence; UI panels.
- **Files likely affected:** new `src/sim/settlement/*`, `src/sim/portals/*`,
  `src/sim/professions/*`, `src/sim/collections/*`, world_api facets, both worlds, `server/db.ts`,
  new UI windows.
- **New systems required:** all four (each a vertical slice).
- **Data models required:** settlement/plot ownership (multiplayer-sensitive: decide
  instanced vs shared vs guild per the master directive Phase 11), portal graph, profession
  skill xp, collection registry.
- **UI required:** settlement builder, portal map, profession panel, collection log.
- **Assets required:** buildable structures, portal VFX/audio identity.
- **Risks:** settlement ownership model interacts with B1 (single-world), design carefully;
  largest scope in the plan.
- **Dependencies:** Phases B to D; persistence pattern; possibly B1 decision.
- **Testing:** per-subsystem suites; parity; multiplayer ownership tests.
- **Definition of done:** each of the four ships as a real, tested, non-placeholder system.

### Phase F (P4): Growverse identity polish

- **Objective:** HUD re-skin to a Growverse palette, a real character creator, audio/music/VFX
  identity, portal audio signature.
- **Why it matters:** Final "this is the Growverse, not a clone" layer; the token-driven theme
  system makes the re-skin tractable.
- **Existing systems affected:** `src/styles/*`, `theme.ts`, `character_appearance.ts`,
  renderer VFX, `music.ts`/`audio.ts`.
- **Risks:** gameplay-neutrality invariant (graphics/FX must not confer advantage); i18n.
- **Dependencies:** identity systems in place first (skin the real thing, not a placeholder).
- **Definition of done:** HUD reads Growverse; character creator supports meaningful choices;
  portals have a signature look/sound.

### Deferred: Server scale-out (P0 only if/when concurrency demands)

Zone/shard servers + off-thread snapshotting + world streaming (B1). Not started until
sustained concurrency approaches the ~50 to 200 co-located ceiling. Until then, keep new
systems shard-friendly.

---

## 4. Recommended first implementation phase

**Phase A, starting with the QW1 + QW2 + QW3 batch, then QW4.** Rationale:

- **QW1 (fix the fishing regression)** is P0: CI is red and a shipped mechanic is broken. It is
  a small content/test fix and the natural first commit. It also proves the determinism/test
  loop works before larger changes.
- **QW2 (content id-integrity gate)** is a cheap safety net that pays off across every
  subsequent content phase.
- **QW3 (Sessions)** delivers the first *unique* Growverse power hook using systems that already
  exist (auras + item-use), so it is high-identity for low risk and low new-UI cost.
- **QW4 (starter-zone divergence)** then makes the first hour unmistakably Growverse (data-only).

This sequence is controlled, keeps the build green at each step, avoids the hard server
blockers, and front-loads identity. It stops short of the large net-new systems (cultivation
lifecycle, genetics) until the owner signs off on the canon (section 5) and the phase plan.

---

## 5. Canon decisions needed from the owner (gate content work)

These come straight from `docs/design/starter-zone-redesign.md` and are required before
authoring names/tone at scale:

1. **Baked Beaver lore + real NPC names** (elder, key NPCs). Placeholder used: "Elder Dampaw."
2. **The sacred cannabis name**, is "the Bloom" right, or a community/brand term?
3. **Primary antagonist**, "the Dry" (drought anti-Bloom), the comedic "Narcs," or Baked
   Beaver canon?
4. **NFT/Baked Beaver integration**, companion pet, mount, cosmetic badge, or all three?
   (Decides the starter capstone.)
5. **Tone**, full stoner comedy vs sincere fantasy that runs on the Bloom? (Sets writing voice.)
6. **The named IP cast (Anderz, Solace, Raiin/Vyrra, etc.)**, where do they slot (faction
   leaders? trainers? bosses?), since none exist in code yet?
7. **Explicit cannabis vs euphemism**, how literal should the theme be? (Currently fully
   euphemistic; affects store/rating posture too.)
</content>
