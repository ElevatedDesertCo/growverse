# Starter Zone Redesign: the cannabis / stoner / fantasy MMORPG

Status: PROPOSAL for review. This fills the "New (yours)" column of `docs/content-audit.md`
for the starter zone (`eastbrook_vale`, currently "Bloomhaven Vale") and sets the world
pillars everything else inherits from. Nothing here is committed to code yet.

Anything below framed as lore (the Baked Beavers, the Bloom, the antagonist) is a PROPOSED
direction built on what already lives in the repo: the "Baked Beaver" landmark, the Bloom /
Bloomhaven vocabulary, the desert-and-water theming of The Dam / The Tanque / The Reservoir,
and the fishing and cannabis-growing systems already added. Correct any of it with the real
Baked Beaver canon and I rework from there.

---

## 0. Why the starter zone first
It is the fingerprint. The current starter quest ids (`q_wolves`, `q_boars`, `q_spiders`,
`q_murlocs`, `q_mine`) are the exact classic-MMO opening template (kill wolves, kill boars,
kill spiders, kill the lake creatures, clear the vermin mine). That inherited SEQUENCE is
what makes two games "read the same" even after rewording. Breaking it, and teaching the
game's own pillars in the first hour instead, is the single highest-impact divergence.

## 1. World premise (the ownable identity)
The world runs on the **Bloom**: a sacred, living cannabis whose flowering keeps the world
mellow, green, and magical. Magic, healing, and good fortune are all drawn from the Bloom.
When the Bloom withers, the world goes harsh: crops die, tempers fray, the light goes flat.

The **Baked Beavers** are the Bloom's cultivators and keepers, a chill, communal people of
dam-builders and master growers. The player arrives as a new **Cultivator**, taken in by the
Baked Beaver commune to learn the craft and defend the Bloom.

The antagonists are anything that withers or burns the Bloom (see section 5). This single
premise reskins the whole game: growing is not a side activity, it is the world's magic
economy, its progression spine, and its story stakes.

## 2. Four pillars (the systems that make it not-a-clone)
1. **Cultivation as progression.** Grow strains, cross-breed genetics, harvest. Strains are
   not flavor, they yield the consumables that power combat (pillar 2). A player levels their
   garden alongside their character.
2. **Sessions (the buff system).** Smoking and edibles replace generic food/flask buffs.
   "Spark up" for an instant short buff; edibles for a delayed-onset, longer, stronger buff.
   Strain type sets the buff profile:
   - **Indica**: defense, health regen, damage reduction ("couch-lock" = a slow/stationary tradeoff).
   - **Sativa**: haste, crit, energy/resource regen (a lighter, jittery, shorter buff).
   - **Hybrid**: balanced middle-ground buffs.
   This is your ownable version of the classic consumable-buff meta, and it wires growing
   directly to power. Note: the items `Bloom Juice`, `Bloom Extract`, `Bloom Essence`,
   `Elixir of the Bloom` already exist and slot straight into this.
3. **The Baked Beaver as identity.** Your Baked Beaver (the NFT / community tie-in) is your
   companion pet or mount and your commune membership badge. Community membership becomes
   in-world identity rather than a bolt-on.
4. **Commune reputation.** Faction rep with the Baked Beavers unlocks strains, extraction
   recipes, dam upgrades, and cosmetics, giving the grind a home that is entirely yours.

Supporting reskins that fall out of the premise:
- **Crafting = curing / extraction.** The crafting tree becomes drying, curing, extracts,
  tinctures, and edibles. Alchemy becomes the extraction lab.
- **Currency / resource.** "Nugs" as a resource tier for Bloom crafting (keep the existing
  money for vendors; Bloom-work uses Nugs and seeds).

## 3. Starter zone identity (`eastbrook_vale`)
| Field | Old (inherited) | New (proposed) |
|---|---|---|
| Zone name | Bloomhaven Vale | Bloomhaven Vale (keep, it already works) |
| Hub | Bloomhaven | Bloomhaven (the Baked Beaver commune town) |
| Framing | generic starter valley | the founding Bloom garden the beavers tend; the player's home base |

Keep the name. Deepen the meaning: Bloomhaven is explicitly the Baked Beaver commune, built
around the first and greatest Bloom garden, watered by the beavers' dams.

### POIs (old -> new)
| Old POI | New POI | Note |
|---|---|---|
| Bloomhaven | Bloomhaven | keep |
| Baked Beaver (landmark) | The Baked Beaver (landmark) | keep, make it the commune lodge / tavern-dispensary |
| Wolf Run | Coyote Wash | desert-native, and the "munchie coyote" range |
| Boar Meadow | Javelina Flats | Sonoran desert peccaries, regionally authentic |
| Mirror Lake | Mirror Lake (keep) | the commune's fishing water |
| Sporewood | The Mitewood | where the crop pests breed |
| Copper Dig | The Old Dig | reskin the "vermin mine" site (see quests) |
| Ashen Maw Camp | The Dry Camp | the antagonist's beachhead (section 5) |
| Withered Shrine | The Withered Bloom | a first patch of Bloom killed by the Dry |
| Reliquary Hill | Seedvault Hill | where the beavers keep heirloom genetics |
| Bloomwood Glade | Bloomwood Glade (keep) | already yours |
| The Sluice (landmark) | The Sluice (keep) | already yours |

## 4. New starter quest chain (breaks the fingerprint, teaches the pillars)
Objectives (kill N, collect N, talk to X) are mechanics and stay; names, givers, story, and
the SEQUENCE are new. The order now teaches Grow, then Fish, then Fight, then Faction.

| Old id / name | New name | New beat (what it teaches) |
|---|---|---|
| q_wolves / Wolves at the Door | First Sprout | Plant, water, and harvest your first Bloom seed at a garden plot. Teaches the cultivation core loop in minute one. |
| (new) | A Good Cure | Take your harvest to the drying lodge and roll your first Session buff. Teaches the buff/consumable system. |
| q_murlocs / Trouble at the Lake | A Good Haul | Fish Mirror Lake for the commune feast. Friendly, not a kill quest. Teaches fishing. |
| q_spiders / Sporewood Menace | Mites! | Clear Bloom Mites infesting the Mitewood before they reach the gardens. First combat, but a native crop pest, not generic spiders. |
| q_boars / Bristleback Hides | Javelina Trouble | Drive off the javelinas raiding the garden rows. Desert-native pest. |
| q_mine / Rats in the Mine | Squatters in the Old Dig | Trimmer Gremlins have holed up in the Old Dig stealing cured Bloom. Clear them out. (Reskins the vermin-mine trope into a crop-theft raid.) |
| q_bones / The Restless Dead | The Dry Creeps In | The antagonist intro: a patch of Bloom has gone gray and withered. Investigate the Withered Bloom and find the Dry's mark. |
| (new capstone) | Welcome to the Commune | Meet Elder Dampaw, earn Baked Beaver membership, and gain your Baked Beaver companion. Ties identity + community + NFT in as the emotional payoff. |

The undead-chapel arc (`q_whispers`, `q_names_of_the_dead`, `q_silence_the_call`, `q_rite`,
`q_hollow`, the Blightcaller Morthen line) is the mid-vale content and reworks into the Dry
antagonist arc (section 5), not the first hour. Flagged for the next pass.

## 5. Antagonist identity (replaces generic undead / bandits / blight)
The threat to a cannabis world is whatever withers or burns the Bloom. Proposed primary
antagonist, the **Dry** (a.k.a. the Harsh): a drought-born anti-Bloom force that fits the
Sonoran desert setting. It gray-rots the Bloom and husks the joy out of the living, turning
them into shuffling **Dried** (this cleanly reskins the existing undead as "people the Dry
hollowed out," so the crypt dungeons become withered places rather than generic tombs).

Comedic and thematic minion factions to draw on:
- **Narcs**: prohibition constructs / golems out to eradicate the Bloom (a fantasy
  law-enforcement faction, played for humor).
- **Trimmer Gremlins / Cartel Goblins**: black-market thieves who steal cured Bloom.
- **Crop-pest bestiary**: real grower pests scaled to monster size (mites, aphids, thrips,
  a Broodmite boss). Authentic, funny, and impossible to mistake for another game.

## 6. Bestiary reskin (starter mobs, old -> new)
| Old mob | New mob | Note |
|---|---|---|
| Blight Wolf | Munchie Coyote | raids the commune's snack stash; desert-native |
| Old Ashfang (rare) | Ol' Smoky (rare coyote) | the one that no trap holds |
| Bristleback Boar | Razorback Javelina | Sonoran peccary |
| Sporewood Weaver (spider) | Bloom Mite / Miteling | crop pest |
| (spider elite) | The Broodmite (elite) | pest boss in the Mitewood |
| Mirror Lake silt-crawler | Reservoir Snapper | snapping turtle; Snapper Shallows already exists in The Dam |
| Kobold miner | Trimmer Gremlin | crop thief in the Old Dig |

## 7. Open questions for you (need your canon)
1. **Baked Beaver lore**: who are they exactly, and what are the real character names I should
   use (the elder, key NPCs)? I used "Elder Dampaw" as a placeholder.
2. **The Bloom**: is "the Bloom" the right name for the sacred cannabis, or do you have a
   community term (a strain name, a brand term) it should be?
3. **Antagonist**: does "the Dry" land, or do you prefer the comedic "Narcs" as the primary
   villain, or something from Baked Beaver lore?
4. **NFT integration**: is the Baked Beaver best as a companion pet, a mount, a cosmetic
   badge, or all three? That decides how it hooks into the starter capstone quest.
5. **Tone**: how hard do we lean into the humor (full stoner comedy) versus a sincere fantasy
   world that happens to run on the Bloom? That sets the writing voice for every quest.

## 8. Suggested build order after sign-off
1. Rewrite the starter quest chain text + ids + givers (data-only edit in `zone1.ts`).
2. Reskin the starter mob names/templates and POI labels.
3. Add the cultivation-to-Session buff link as the first unique SYSTEM (design spec first).
4. Roll the Dry antagonist through the mid-vale undead arc.
5. Repeat the pattern zone by zone using `docs/content-audit.md` as the checklist.
