# GROWVERSE: Current State Audit (Phase 0)

Date: 2026-07-14. Method: evidence-based audit of the actual codebase (five parallel
subsystem passes over `src/sim/`, `src/render/` + `src/ui/` + `src/game/`, `server/` +
`src/net/`, content/divergence, and build/test health). This document is the
source-of-truth inventory the roadmap builds on. Companion docs:
`GROWVERSE_SYSTEM_ARCHITECTURE.md`, `GROWVERSE_MASTER_ROADMAP.md`,
`GROWVERSE_TECHNICAL_DEBT.md`.

---

## 0. What Growverse actually is today

Growverse (`package.json` name `growverse`, v0.19.0) is a **fork of World of ClaudeCraft**
(README line 55): a classic-style, WoW-vanilla-fidelity browser MMO built on one
deterministic TypeScript sim core that runs in three hosts (offline browser, authoritative
server, headless RL env). It is **mature and largely complete as a classic MMO**:

- 9 classes with full talent trees, vanilla-fidelity combat (hit tables, threat, auras/CC).
- 4 overworld zone bands (levels ~1 to 20), ~10 dungeons + a scripted raid (Nythraxis), a
  modular "delve" instance system, ranked PvP arena, a 2v2 "Fiesta" mode.
- ~131+ base items (hundreds more across zones), a player auction house, vendors, crafting
  stations (grow/upgrade/cook/alchemy), fishing, resource-node gathering.
- Real multiplayer (Postgres-backed accounts, interest-scoped 20 Hz snapshots), production
  auth (scrypt, TOTP, OAuth, native attestation), moderation, chat filter, daily rewards.
- A production-grade client: ~58k lines of UI (25 pure view-cores, 17 windows, 13 painters),
  a chunked-LOD Three.js renderer, full mobile/gamepad support, procedural audio/music, a
  public `/wiki` guide SPA, and a Svelte admin dashboard.
- A cosmetic, read-only Solana wallet + $WOC token holder-tier badge system.

**The Growverse re-theme (cannabis / stoner / fantasy / portal IP) is ~20 to 25% done**, and
is concentrated entirely in the **level 1 to 7 on-ramp**: an original "The Dam" newcomer zone
(the Baked Beavers), "The Sluice" outpost grafted into the starter zone, a real fishing
mechanic, and a "grow"-flavored (but shallow) crafting loop. Everything from mid-game onward
(zones 2 to 4, all dungeons, the raid, ~90% of 124 mobs / 87 quests / 38 NPCs) is still
verbatim inherited generic fantasy (blight wolves, drowned husks, necromancers, a gravewyrm,
a Pumpkin King). The vision's signature systems (real cultivation, genetics/breeding,
factions/reputation, settlements, portals, collections) do **not exist yet**.

Bottom line: **the engine and classic-MMO scaffolding are a strong, keepable foundation. The
Growverse identity is early theming, not yet systems.** The work ahead is additive
(build the identity systems + finish the divergence), not a rewrite, with two server-side
re-platforming items required before mass scale.

---

## 1. Systems inventory (by state)

Legend: COMPLETE = functional and worth preserving | PARTIAL = exists, needs work |
PLACEHOLDER = visible but no real gameplay | BROKEN = malfunctions | MISSING = required
by the vision, absent | DUPLICATED = overlapping solutions.

### COMPLETE (preserve)

| System | Where | Notes |
|---|---|---|
| Combat (abilities, hit tables, threat, CC, auras) | `src/sim/combat/*`, `threat.ts`, `targeting.ts` | Vanilla-fidelity, ~40-variant `AbilityEffect` union + `runEffects` switch. Highly data-driven. |
| 9 classes + talents | `content/classes.ts` (3.7k), `content/talents*.ts` (5k+) | All 9 trees registered; flat-precompute; server-authoritative allocation. |
| Items / equipment / loot | `items.ts`, `content/items.ts`, `loot/*`, `item_sets.ts` | 9 item kinds, sets, weighted loot tables. Scales to thousands. |
| Economy / auction house / vendors | `market.ts` (auction), `market_query.ts`, vendors on NPCs | Escrow, 5% gold-sink cut, dupe-safe single-transaction save. |
| Zones / world / terrain | `world.ts`, `colliders.ts`, `content/zone*.ts` | Pure deterministic heightfield shared with renderer. |
| Dungeons / delves / instances | `instances/dungeons.ts`, `delves/runs.ts`, `content/dungeons.ts` | Data-driven dungeons; modular delve framework (affixes, companions, lockpick minigame). |
| Fishing | `fishing_water.ts` + channel in `sim.ts`, `FISHING_TABLES` | The most fully realized *new* mechanic: cast, catch, cook. |
| Resource gathering | `harvest.ts`, `content/gathering.ts` | Node channel feeding crafting reagents. |
| Pets / companions | `pet/pet_ai.ts`, `pet/pet_commands.ts`, delve companions | Tame + summon, modes/roles, level sync, serialize. |
| Party / raid groups / duels / arena / Fiesta | `social/party.ts`, `arena.ts`, `duel.ts`, `fiesta.ts` | Full party/raid machine, ranked Elo arena. In-memory (not persisted). |
| Chat / trade / social graph | `social/chat.ts`, `social/trade.ts`, `server/social*.ts` | Rich chat + slash commands; friends/blocks persisted. |
| Client HUD (frames, bars, bags, map, minimap, tooltips, FCT, options) | `src/ui/*` (25 cores, 17 windows) | No dead/placeholder buttons found. Token-driven, test-guarded. |
| Renderer (terrain LOD, props, foliage, water, weather, VFX, characters) | `src/render/*` | Chunked LOD, crowd-adaptive, adaptive frame budget. |
| Input / camera / keybinds / mobile / gamepad | `src/game/*` | Remappable, mobile touch joysticks, controller support. |
| Auth / accounts / 2FA / OAuth | `server/auth.ts`, `account.ts`, `oauth.ts`, `totp.ts` | scrypt, scoped revocable tokens, TOTP, native attestation. Production-grade. |
| Moderation / chat filter / rate limit | `server/moderation_*`, `chat_filter*`, `ratelimit.ts` | Audit trails, escalation ladder, Turnstile. |
| Daily rewards / retention | `server/daily_rewards*.ts` | The one gameplay-persistence subsystem built relationally (template for the rest). |
| Networking (interest-scoped delta snapshots) | `server/game.ts broadcastSnapshots`, `src/net/online.ts` | Correct MMO model: spatial-hash interest, lite/full/keep deltas, hysteresis. |
| Public guide `/wiki` SPA + admin dashboard | `src/guide/`, `src/admin/` | Spoiler-safe generated wiki; isolated Svelte ops dashboard. |

### PARTIAL (exists, needs work)

| System | Where | Gap |
|---|---|---|
| **Quest framework** | `quests/quest_credit.ts`, `QuestDef` in `types.ts` | Only 3 objective types (kill/collect/interact); single linear `requiresQuest`; **no branching, choices, or multi-outcome**. Scales in count, thin in variety. The vision explicitly wants branching/choice/consequence quests. |
| **Crafting depth** | `crafting.ts`, `content/crafting.ts` | Real but shallow: 4 stations, recipes gate on character level only. **No profession skill levels / progression.** |
| **"Grow" theming** | `content/crafting.ts`, `gathering.ts` | Cannabis theme is item names on a normal reagent to product bench (see PLACEHOLDER). |
| **NPC dialogue** | `interaction.ts`, `NpcDef.greeting` | One `greeting` string per NPC + quest text. **No dialogue trees / branching conversation.** |
| **Guilds** | `PlayerMeta.guild` string, `server/social_db.ts` | Persists membership + name + rank string only. **No guild bank, permissions, guild chat, or progression.** |
| **Day/night & weather** | `render/sky.ts`, `weather.ts` | HDRI/zone-tint driven, biome-gated. Not a dynamic time-of-day or weather system. |
| **Character customization** | `src/ui/character_appearance.ts` (46 lines) | Class + numbered skin + unlockable chroma only. **No gender / hair / face / clothing** despite the task listing them. |

### PLACEHOLDER (visible but no real gameplay)

| System | Where | Reality |
|---|---|---|
| **Cultivation / "growing"** | `content/crafting.ts` Grow Station, seed items | The code comment is explicit: the Grow Station "is NOT where plants grow, it makes the things growing needs." Seeds/strains are `kind:'junk'` upgrade items; the "Prime Strain Seed" is a dead-end with no consumer. **No planting, growth timers, genetics, or breeding.** |
| **Strains / genetics** | seed items (`common/enriched/prime_strain_seed`) | Three ascending-quality junk items. Not a genetics model. |
| **Holder tiers (Solana)** | `src/sim/holder_tier.ts` | Explicitly cosmetic ("does not apply holder tiers as gameplay rules"), nameplate badge only. |

### MISSING (required by the vision, absent)

| System | Evidence | Scope |
|---|---|---|
| **Real cultivation lifecycle** (plant to germinate to grow to harvest to cure) | none in `src/sim/` | Headline pillar. Net-new sim system + seam facet + UI. |
| **Genetics / breeding** (traits, inheritance, mutation, phenotypes) | none | Net-new; needs a manageable data model (see roadmap). |
| **Factions / reputation** | `grep faction|reputation` -> only mob-AI ally checks | Net-new: standing, rep gains, rep-gated vendors/unlocks. |
| **Sessions / consumable buffs from strains** | not wired (items exist, no buff link) | Can reuse the mature auras + item-use path. |
| **Player camp / housing / settlement progression** | only account bank (`stash.ts`); `CAMPS` = mob spawns | Net-new, large; multiplayer-architecture-sensitive. |
| **Portals / fast-travel network** | only dungeon/delve transition portals | Net-new player system. |
| **Achievements / collection logs** | `grep achievement` -> zero hits | Net-new. |
| **Profession skill progression** | recipes gate on level only | Net-new leveling layer. |
| **Dialogue trees** | single greeting string | Net-new (needed for quest/faction depth). |
| **Character creator (gender/hair/face/clothing)** | skin-only | Large net-new (sim data model + preview UI + cosmetics seam). |
| **Scripted-encounter authoring path** | `encounters/nythraxis.ts` is 1.2k bespoke lines | Each boss is engineering, not content (framework gap). |

### DUPLICATED / overlapping

- **Fishing channel vs harvest channel.** `harvest.ts` was extracted as a clean module that
  "mirrors the fishing channel," but the fishing channel (`startFishing`/`completeFishing`)
  still lives inside the `sim.ts` monolith. Same pattern, two homes. Low-risk consolidation.
- **Branding split (`World of ClaudeCraft` vs `Growverse`).** Both identities coexist:
  ~1,914 `Growverse` occurrences across 184 files vs ~1,372 old-brand occurrences across 220
  files. Not "duplicated systems" but duplicated identity that must converge (domain, mobile
  package ids, the $WOC token all still say ClaudeCraft).

### REMOVE / REPLACE (candidates, with care)

- **Hollowmere Halloween wing** (`content/hollowmere.ts`, the Pumpkin King): 0% themed,
  seasonal-event content. Keep as a seasonal or rework wholesale; do not let it define identity.
- **Superseded original GDD** (`docs/growverse-gdd.md`): marked "Superseded"; keep as theming
  source, do not implement the base-building grow-sim as specified.
- Nothing else should be *deleted* outright, the inherited fantasy content is the reworkable
  raw material of the divergence, not dead weight (per the master directive's safety rules).

---

## 2. Growverse divergence: how far, exactly

| Zone (internal id) | Display name | % original | State |
|---|---|---|---|
| `the_dam` (zone4) | The Dam | **~90%** | Original Baked Beaver newcomer zone (Boone Cascade, Sequoia Marsh, Ollie Ridgeback, Wren Alder, Junie Stonewater; Haze Critter, Driftwood Snapper, Overbaked Beaver). |
| `eastbrook_vale` (zone1) | Bloomhaven Vale | **~25%** | The Sluice outpost + fishing + Grow Station grafted on; spine is still WoW (blight wolves, boars, bandit camp, Blightcaller undead, Hollow Crypt). |
| `mirefen_marsh` (zone2) | The Sunken Wastes | **~5%** | Verbatim clone (drowned husks, broodmother, Deacon Voss, Vael the Mistcaller). |
| `thornpeak_heights` (zone3) | Thornreach Heights | **~0 to 5%** | Verbatim clone (ogres, necromancers, revenants, Korzul the Gravewyrm raid). |
| `hollowmere` | Hollowmere | **~0%** | Halloween graveyard wing (Pumpkin King). |

Other divergence facts:
- **No literal cannabis in-game.** `grep cannabis|weed|marijuana|ganja|THC|joint|blunt` in
  `src/sim` -> zero player-facing hits. The theme is euphemistic ("Bloom", "grow", "strain").
- **The content-audit plan is unexecuted.** `docs/content-audit.md` "New name/story" columns
  are 100% blank; it is a scoping doc, not a record of work.
- **Named IP characters (Anderz, Solace, Raiin/Vyrra, Elyra, Zira, etc.) do not exist in code**
 , they appear only in the task briefing/docs, not in any content file.
- **Solana/$WOC**: real, production-grade, but balance-only, cosmetic, NFT-free, and still
  branded ClaudeCraft (mint hardcoded, token named $WOC).
- The best divergence direction on record is `docs/design/starter-zone-redesign.md`
  (cultivation-as-progression, Indica/Sativa/Hybrid "Sessions" buffs, Baked Beaver identity,
  the "Dry" antagonist), a strong proposal, **not yet built**, ending with open canon
  questions for the owner.

---

## 3. Build / test / stability health

**Verdict: HEALTHY, with one branch regression to fix before merge.**

| Check | Result |
|---|---|
| `npm ci` | PASS (703 packages, `0 vulnerabilities`) |
| `npm run check:ts` (`tsc --noEmit`) | **PASS, clean** (exit 0, ~66s cold on ~330k hand-written LOC) |
| Biome 2.5.0 (changed-files ratchet) | PASS |
| `tests/architecture.test.ts` (determinism/purity guard) | **24/24 PASS** |
| Sampled suites (`combat_damage` + `snapshots` + `talents`) | 147/147 PASS |
| `tests/sim.test.ts` | **91/92 pass, 1 FAIL** |

- **Test suite: 607 `*.test.ts` files** (broad, mechanic-per-file: combat/mob AI dominate with
  ~66 `mob_*`; plus quests, i18n gates, loot, pets, delves, arena, wallet, nythraxis, admin,
  electron/capacitor/discord shells). Unit tests run in plain Node with Postgres mocked.
- **CI (`.github/workflows/ci.yml`)** is a genuine merge gate: `lint` (changed-files),
  `pr-gate` (i18n freshness diff, `security:gate` malware/wallet-drainer scan, full `npm test`,
  `tsc`, and all four builds), and a stricter `release-gate` (full 14-locale i18n enforcement).
- **The architecture guard is a real asset:** it scans every sim file and fails on any
  `render/ui/game/net`/`three` import, any DOM global, or any `Math.random`/`Date.now`/
  `performance.now` in the sim, plus `IWorld` seam purity and pure-core registry completeness.
  This is what makes the determinism invariant enforceable as the game grows.

**The one failure (P1/P2, a real regression this branch introduced):**
`sim.test.ts > "rolls the fishing catch table only when the cast completes"` fails
deterministically (seed 42). A hostile mob (`sourceId:76`) now reaches the Mirror Lake fishing
spot and deals 10 damage mid-cast, producing `castStop {success:false}` so no catch roll fires.
This traces to recent starter-zone content work on this branch ("carve the Skeleton Grotto,
muster the undead there" near Mirror Lake). Because `pr-gate` runs full `npm test`, **this
would block a PR.** Fix: move the undead muster/mob placement away from the Mirror Lake fishing
spot (content edit), or harden the test to not assume an uninterrupted cast. This is a QUICK WIN
and a good first concrete task (see roadmap).

**Supply-chain note:** dependency set is tiny and deliberate (`npm audit` clean). The Solana
wallet stack + Electron auto-updater are the notable surfaces; both are mitigated (a
`security:gate` malware/wallet-drainer scan runs in CI; Electron fuses are hardened in
`package.json`). Worth a focused `privacy-security-review` pass given the wallet surface.

---

## 4. Preserve / Improve / Refactor / Expand / Replace / Remove (summary verdict)

- **PRESERVE:** the deterministic sim core + `SimContext` seam; combat/classes/talents/items/
  loot/dungeons/delves; the `IWorld` seam + client HUD framework + renderer + mobile; auth/
  moderation/networking; the auction house dupe-safe pattern; daily-rewards relational schema.
- **IMPROVE:** quest framework (add objective types + branching/choice); crafting into real
  professions with skill levels; NPC dialogue into trees; guilds into a real subsystem;
  character customization.
- **REFACTOR (carefully, non-blocking):** extract fishing channel out of `sim.ts`; keep
  chipping `hud.ts`/`main.ts`/`sim.ts` monoliths per the module-first rule; add content
  id-integrity validation; converge branding.
- **EXPAND:** finish the divergence zone-by-zone; build the identity systems (cultivation,
  genetics, Sessions, factions/reputation, settlements, portals, collections).
- **REPLACE:** the two server re-platforming items before mass scale, single-world runtime
  and JSONB-blob persistence (see `GROWVERSE_SYSTEM_ARCHITECTURE.md`).
- **REMOVE:** nothing outright now; treat Hollowmere as seasonal, the old GDD as theming source.
</content>
</invoke>
