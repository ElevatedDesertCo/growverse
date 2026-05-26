# GROWVERSE: GUILD WARS — Game Design Document v2.0

**IP**: Elevated Desert: Growverse
**Game**: Growverse: Guild Wars

> **Supersedes v1.1.** v1.1 (Phase 1 Clash-style base loop) is the **mechanical
> foundation** under everything below. Nothing in Phase 1 is being removed.
> Every system on this page is **additive** and ships in phases.

## One-Line Pitch

A Clash-of-Clans-inspired base-building, guild-raiding, spirit-pet strategy
game set in a trippy, comedic, post-apocalyptic desert fantasy world.

## Game Direction Pillars

- Clash-style base-building
- Guild raids
- Spirit pet collection
- Grower / hero progression
- Story chapters
- TCG card collection
- Booster pack rewards
- Portal-based progression

## Tone

Funny, weird, raunchy, surreal, chaotic, trippy, desert fantasy,
post-apocalyptic, comic-book energy, Rick-and-Morty-inspired but original.

## The World

A cosmic desert civilization once thrived on **Bloom Energy** — a sacred life
force channeled through cannabis-based spirit cultivation. Then the
**Corruption** broke through the first portal. Spirit Cartographers vanished.
Guild Cores fell silent. The desert is now scattered with damaged Guild Cores,
corrupted camps, and lost relics. A new generation of **Growers** must wake
the Cores, rebuild their bases, raise spirit companions, and push the
Corruption back portal by portal.

## The Player

You are a Grower. You inherit a **damaged Guild Core**. You repair it. You
collect resources. You build. You raid. You unlock characters, spirit pets,
guilds, and story chapters. You join a Guild. You fight in seasonal Guild Wars.
You build a TCG card collection of your victories.

---

## CANON — Characters

Locked. These names, relationships, and spirit-pet pairings must appear
consistently across cinematics, raid dialogue, card flavor, and UI text.

### Main characters

| Character | Role | Spirit Pet | Notes |
|---|---|---|---|
| **Anderz** | Protagonist | **Solace** | The Grower the player embodies in story chapters. |
| **Solace** | Anderz's spirit companion | — | Floating vine/spirit/cannabis-plant hybrid. **Not a fox.** Voice: dry, sarcastic, slightly motherly. |
| **Raiin** | Rival → co-Grower → romantic interest | **Vyrra** (water dragon) | Roaster antagonist who thaws over the campaign into Anderz's partner. |
| **Davis** | Side character | **Fumez** (glowing blue ghost fox) | Tall, skinny. Not the main character. |

### Guild Leaders (6 guilds)

| Guild Leader | Guild | Spirit Pet | Element / Theme |
|---|---|---|---|
| **Elyra** | **Bloomveil Guild** | — (TBD) | Plant / Bloom energy, healing, growth. Connected to Anderz and Solace. |
| **Ashira** the Blaze Binder | **Ember Guild** | Fire-fox | Fire / forge / aggression |
| *(leader TBD)* | **Water Guild** | — | Water / flow / healing. Connected to Raiin and Vyrra. |
| **Myco** | **Spores Guild** | — (TBD) | Mushrooms / spores / hallucinations |
| **Zira** | **Roots / Thorn Guild** | — (TBD) | Roots / thorns / defense. Legendary mentor: **Elder Thorn / Master Thorn**. |
| **Athir** the Dustwarden | **Dustroot Archive** | — | Maps / relics / portal lore. Formerly the Spirit Cartographer (tragic / fallen ally archetype). |

### Supporting cast

| Character | Role | Spirit Pet | Notes |
|---|---|---|---|
| **Art** | Grower | **Wingus** (hawk) | — |
| **Brazzle** | Relic Forager | **Berle** (mysterious beetle) | Larger, light-skinned, bearded. |
| **Nicole** | Tech Wizard | — | Long hair, Mexican-toned skin, flower tattoos, carries a laptop. Owns Nicole's Tech Lab. |
| **Armando** | — | Dark canine/wolf with green glowing markings | Heavyset Mexican man, baseball cap + jersey, jeans, relic necklace, carries a bat. |
| **Carlito** | Information broker | — | Doesn't sell secrets — *rents emotional damage with payment plans*. |

### Antagonists

| Character | Role | Notes |
|---|---|---|
| **Eris** | The Corrupted Spirit Weaver | Primary antagonist. Corrupts spirits, weaves portals. |

---

## CANON — Dialogue Tone

Locked reference samples. Future writing must match this voice:

> **Solace**: "Great. You touched the glowing desert tumor. Now reality has trust issues."
>
> **Raiin**: "That portal opened because of you? That's terrifying. Mostly because you look like you lose arguments with soup."
>
> **Carlito**: "I don't sell secrets. I rent emotional damage with payment plans."

---

## CANON — Resources & Uses

Eight currencies in the full game.

| # | Resource | Used for |
|---|---|---|
| 1 | **Bloom Essence** | Bloomveil upgrades · Healing buildings · Spirit pet bonding · Vine defenses · Basic base upgrades |
| 2 | **Amber Shards** | Ember upgrades · Weapon upgrades · Attack buildings · Forge buildings · Damage units |
| 3 | **Myco Dust** | Spores upgrades · Poison abilities · Hallucination traps · Fungal units · Control buildings |
| 4 | **Relic Fragments** | Ancient tech · Portal upgrades · Rare building upgrades · Unlocking lore · Special character upgrades |
| 5 | **Spirit Seeds** | Unlocking spirit pets · Evolving spirit pets · Spirit Nursery upgrades · Pet bonding |
| 6 | **Portal Energy** | Unlocking new zones · Story chapter gates · Event portals · Raid map travel |
| 7 | **Guild XP** | Player level · Guild level · Unlocking features · Progression milestones |
| 8 | **Card Shards** | Crafting cards · Upgrading digital cards · Unlocking booster rewards |

### Phase 1 → v2 resource mapping

Phase 1 ships with `leaf` / `fire` / `mushroom` field names. The v2 canon
names are **Bloom Essence / Amber Shards / Myco Dust**. To avoid breaking
existing saves, the codebase keeps the old field names until the Phase 3
economy refactor — the **DISPLAY label** changes immediately when the v2
ResourceBar lands, but the underlying field stays `leaf` etc. through a
small label-mapping helper. Schema migration to the canonical names is a
later phase.

| v1.1 field | v2 canon label |
|---|---|
| `leaf` | Bloom Essence |
| `fire` | Amber Shards |
| `mushroom` | Myco Dust |

The other 5 (Relic Fragments, Spirit Seeds, Portal Energy, Guild XP, Card
Shards) are **new fields** added to `Resources` as their systems land.

---

## CANON — Core Buildings (15)

These are the canonical Phase-1-through-endgame buildings.

| # | Building | Current state | Notes |
|---|---|---|---|
| 1 | **Guild Core** | NEW | Central building. Damaged at game start, repair gates progression. Single instance per base. |
| 2 | **Bloom Extractor** | LIVE | Already implemented. Wires up to Bloom Essence economy. |
| 3 | **Amber Forge** | LIVE | Already implemented. Wires up to Amber Shards economy. |
| 4 | **Myco Extractor** | NEW | Generates Myco Dust. |
| 5 | **Storage Vault** | NEW | Increases resource caps. |
| 6 | **Training Grounds** | NEW (art exists) | `public/buildings-library/training-grounds-sheet.png` already in repo. Trains units. |
| 7 | **Spirit Nursery** | NEW | Unlocks / evolves spirit pets via Spirit Seeds. |
| 8 | **Portal Gate** | NEW | Travel to raid map / story zones. Consumes Portal Energy. |
| 9 | **Relic Workshop** | NEW | Crafts relics from Relic Fragments. |
| 10 | **Defense Totem** | NEW | Generic defense building. |
| 11 | **Vine Wall** | NEW | Bloomveil defense. |
| 12 | **Spore Trap** | NEW | Spores defense / control. |
| 13 | **Flame Totem** | NEW | Ember offense. |
| 14 | **Water Channel** | NEW | Water Guild defense / flow. |
| 15 | **Root Wall** | NEW | Roots/Thorn defense. |

### Phase 1 building reconciliation

| Phase 1 type | Disposition in v2 |
|---|---|
| `growTent` | **Renamed display → "Bloom Garden"** OR rolled into the Bloomveil-themed Bloom Extractor flow. **Decision deferred** to Phase-1-data refactor sprint — flag for design review. Currently produces Leaf, will produce Bloom Essence. |
| `bloomExtractor` | Lives, canonical. |
| `amberForge` | Lives, canonical. |
| `thornTrap` | **Renamed display → "Root Wall"** (canonical name in v2 list #15). Same defensive-plant role, same art. |

Field-name compatibility: store `BuildingType` ids stay `growTent`/`bloomExtractor`/`amberForge`/`thornTrap` to preserve saves; display name + description change in `BUILDINGS` def. New building types add new ids when they land in their phase.

---

## CANON — Main Game Loop (10 steps)

1. Player starts with a **damaged Guild Core**.
2. Player **repairs the Guild Core**.
3. Player **collects resources**.
4. Player **builds and upgrades buildings**.
5. Player **trains units**.
6. Player **unlocks Growers and Spirit Pets**.
7. Player **raids corrupted camps**.
8. Player **earns resources, relics, spirit seeds, card shards, and cards**.
9. Player **upgrades base, characters, pets, and cards**.
10. Player **unlocks story chapters, guilds, portals, and booster packs**.

**Phase 1 (live) covers steps 3, 4, 9 (partial — buildings only).**

---

## Screen Inventory (14 canonical screens)

Status legend: ✅ live · 🟡 in-flight this sprint · ⏳ later phase.

| # | Screen | Status |
|---|---|---|
| 1 | Main Menu | ⏳ |
| 2 | Guild Base View | ✅ |
| 3 | Build Menu | ✅ |
| 4 | Building Upgrade Panel | ✅ (UpgradeModal) |
| 5 | Resource Bar | ✅ (relabel for v2 + add Bloom Essence pill in P2) |
| 6 | Character / Grower Roster | ⏳ (P4) |
| 7 | Spirit Pet Roster | ⏳ (P4) |
| 8 | Raid Map | ⏳ (P5) |
| 9 | Raid Battle View | ⏳ (P5) |
| 10 | Story Chapter View | ⏳ (P3) |
| 11 | Card Collection | ⏳ (P6) |
| 12 | Booster Pack Opening Screen | ⏳ (P6) |
| 13 | Quest / Mission Log | ⏳ (P3) |
| 14 | Settings | ✅ |

---

## Required Data Files & Types

All modular. Each is a TypeScript module of typed records — pure data, no
React. v1.1 used `lib/` at project root (not `src/`). Recommendation: **stay
with `lib/`** to avoid moving the existing 3 files; create `lib/data/` and
`lib/systems/` subfolders for new modules.

```
lib/
  buildings.ts         ← LIVE (current Phase 1)
  economy.ts           ← LIVE (current Phase 1)
  store.ts             ← LIVE (current Phase 1)
  data/                ← NEW (Phase 1 of v2 plan)
    guilds.ts
    resources.ts
    characters.ts
    spiritPets.ts
    units.ts
    cards.ts
    quests.ts
    chapters.ts
    raids.ts
    rewards.ts
  systems/             ← NEW (Phase 2+ of v2 plan)
    resourceSystem.ts
    buildingSystem.ts
    upgradeSystem.ts
    raidSystem.ts
    rewardSystem.ts
    questSystem.ts
    cardSystem.ts
    spiritPetSystem.ts
    progressionSystem.ts
```

Components mirror with named subfolders inside `components/`:

```
components/
  game/                ← LIVE (current Phase 1 — base + nav + modals)
  base/                ← NEW (P2) — base-view specific (extracts from game/)
  characters/          ← NEW (P4)
  pets/                ← NEW (P4)
  raids/               ← NEW (P5)
  cards/               ← NEW (P6)
  story/               ← NEW (P3)
  quests/              ← NEW (P3)
```

---

## v2 Phased Roadmap (canonical)

Each phase ships independently. After each phase the deliverable is: what
changed · files created · files modified · how to test · known limitations
· next phase recommendation.

| Phase | Theme | Scope |
|---|---|---|
| **0** | **Audit** | Read-only inspection of current codebase. Identify what exists, what's missing, what to upgrade first. *(This sprint.)* |
| **1** | **Data foundation** | Create `lib/data/*.ts` modules (guilds, resources, characters, spirit pets, units, cards, quests, chapters, raids, rewards) and types. Pure data, no UI. |
| **2** | **Resource + base loop expansion** | Add Bloom Essence resource pill. Relabel existing pills to v2 canon names. ResourceBar / GuildBaseView / BuildMenu / BuildingCard / UpgradePanel refactor — modular by feature folder. Guild Core gates further construction. |
| **3** | **Quest + Story Chapter system** | QuestLog, QuestCard, ChapterList, ChapterDetail, DialogueBox. Ship Chapter 1: Portal Awakening. Ship Chapter 2: Reality Has Trust Issues. Quests update from player actions; rewards claimable. |
| **4** | **Character + Spirit Pet system** | CharacterRoster, CharacterCard, CharacterDetail, SpiritPetRoster, SpiritPetCard, SpiritPetDetail. Anderz starts unlocked. Solace unlocks early, gives Bloom bonuses. Pets have bond levels + passive/active abilities. |
| **5** | **Raid Map MVP** | RaidMap, RaidNode, SquadSelector, RaidBattleView. Simulated battles first (squad power vs enemy camp power). Win → resources, Guild XP, Card Shards, Spirit Seeds, possible cards. |
| **6** | **TCG Card Collection MVP** | CardCollection, GameCard, BoosterPack, BoosterOpening. Card categories: Growers, Spirit Pets, Abilities, Relics, Terrain, Guild Blessings, Strains, Pure Art Collector Cards. Booster packs reveal 5 cards. Duplicates → Card Shards. |
| **7** | **Base Defense MVP** | Defense buildings contribute a defense score. Enemy waves attack. Guild Core survival → outcome. |
| **8** | **Guild Expansion** | Roll out Water Guild, Ember Guild, Spores Guild, Thorn Guild, Dustroot Archive content. Each unlocks buildings, units, cards, characters, pets. |
| **9** | **Polish + Growverse identity** | Solace sarcastic dialogue. Raiin roast lines. Portal effects. Card-style UI. Guild badges. Resource animations. Better placeholder art / icons. Comic-style story popups. |
| **10** | **Save/load/debug tools** | localStorage save (already live) · reset save (already live) · debug resource buttons · unlock test buttons · export/import save data. |

---

## Anti-Breaking Rules (locked)

- Do not delete working components.
- Do not rewrite the app from scratch.
- Do not create fake buttons with no function.
- Do not hardcode all systems into one file.
- Do not add multiplayer, payments, login, or database yet.
- Use local data and localStorage first.
- Keep everything modular and expandable.
- Prioritize a working game loop over visual perfection.

## Visual Direction

Inherits Phase 1 — deep desert ochre/brown, gold accents, sage green, warm
orange, soft purple, illustrated card-based UI with golden borders, Cinzel
display font + Inter body. Add as we go: portrait art for the named
characters, spirit-pet art for each pairing, corrupted-zone art variants,
TCG card frames.

## Anti-Goals

- NOT a rewrite. Phase 1 mechanics remain the foundation.
- NOT pay-to-win.
- NOT a Clash of Clans skin — borrows structure, owns its own cannabis-mystic IP.
- NOT a frat-bro stoner game (voice is mystical-comedic, not crude).
- NOT real-time multiplayer (async raids; PvP is turn-based / asynchronous).

---

Version 2.0 — locked.
