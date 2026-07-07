# Baked Beavers x Growverse: Integration Build Plan

**Owner:** Andy Heidrick (EDC / ESS)
**Strategy:** Proof-first. Build a playable Beaver content slice, ship it quietly, then show the founders something real.
**Repo reality:** This is the World of Claudecraft fork re-skinned as Growverse. Stack is **Vite + Svelte + TypeScript + Capacitor + Electron**, NOT Next.js/Tailwind/Zustand. Content is **data-as-code** in `src/sim/content/`.
**Do NOT build in v1:** new wallet plumbing. The engine ALREADY has `net/wallet.ts` + `sim/holder_tier.ts` + `world_api/cosmetics.ts`: the NFT-reward path is a Phase-3 config task on existing systems, not new infrastructure.

**DECISION (locked):** The Beavers get their own **brand-new zone**: `zone4.ts`, id `the_dam`, "The Dam", a **levels 1-6 newcomer starter area**. Rationale: gives the founders a real "I built you your own place in the world" story, makes it a genuine destination (not a bolt-on camp), and doubles as a clean on-ramp for Beaver community members joining Growverse fresh. Costs more setup than a POI-in-existing-zone, accepted on purpose.

---

## 0. Strategic frame

Baked Beavers is a **community brand**, not a floor-price NFT project. "Cannabis, Community, Culture": Tucson-anchored, casual ownership (free Starter Beaver PFPs + paid Magic Eden mints on Solana). Discord, a Monday broadcast show, local events, no game. **You have a game.** The collab: Growverse becomes what their community plays; you get a warm, local, aligned audience to seed it.

Goals, sequenced (not parallel):
1. **NOW**: grow player base + EDC local awareness (this slice).
2. **NEXT**: deepen lore + a co-branded event.
3. **LATER**: NFT/holder rewards via the engine's EXISTING wallet/holder-tier system.

**Governance risk:** their IP is loosely held (free + paid ownership split). Frame as **fan tribute / official-pending** until a founder says yes. Don't claim "official," don't copy their exact PFP art.

---

## 1. How the Beavers actually plug into THIS engine

The base-builder "faction picker + resource buff" model from earlier planning does NOT exist here. This is a WoW-style engine. The Beavers plug in as a **zone with NPCs, mobs, quests, and a cosmetic skin**, using systems that already exist:

| Beaver concept | Real engine mechanism | File |
|---|---|---|
| The Dam (place) | A new **zone** OR a POI/camp inside an existing zone | `src/sim/content/zone4.ts` (new, copy `zone3.ts`) |
| Beaver characters | **NPCs** (quest-givers) + **mobs** | same zone file: `ZONE4_NPCS`, `ZONE4_MOBS` |
| Beaver storyline | **Quests** with objectives/rewards | `ZONE4_QUESTS` + `ZONE4_QUEST_ORDER` |
| Beaver look | **Cosmetic skin** (already a system) | `src/sim/content/skins.ts` |
| Holder rewards (later) | **holder_tier / wallet** (already built) | `net/wallet.ts`, `sim/holder_tier.ts` |

**Most important correction:** you are adding *content records*, not building new systems. Faster and safer.

---

## 2. This slice's Definition of Done (proof)

A player can travel to a Beaver area, meet a named Beaver NPC, pick up and complete a short Beaver quest, and see Beaver-themed naming/flavor. Screenshot-able. That's the founder demo.

Minimum viable content:
- 1 Beaver zone OR a Beaver camp/POI inside an existing zone
- 3 to 5 Beaver NPCs/mobs (use the lore doc's characters)
- 1 to 2 quests (a kill or collect objective + turn-in)
- Optional: 1 cosmetic Beaver skin entry

---

## 3. MANDATORY guardrails (from the repo's own CLAUDE.md: a naive build WILL break these)

These are enforced by CI tests. The build prompt must honor all of them:

1. **i18n two-file rule (S3 guard).** Every player-visible English string (NPC/mob/quest/zone `name`, `text`, `greeting`) requires its id added to `src/ui/world_entity_i18n.ts`. Miss this → `tests/localization_fixes.test.ts` fails CI. **The #1 trap.**
2. **Wiki regen.** After adding content, run `npm run wiki:content` and commit the regenerated `src/guide/content.generated.ts`, or `tests/guide.test.ts` fails. A new creature model also needs `npm run wiki:stills`.
3. **No engine logic in `content/`.** Only plain exported TS records.
4. **No dangling ids.** Every `loot.itemId`, `giverNpcId`, `targetMobId` must reference something defined; no compile check, fails at runtime.
5. **Register in `sim/data.ts`.** A new zone module must be imported and spread there, or the engine never sees it.
6. **Types first.** Need a new field? Add it to `src/sim/content/types.ts` first.
7. **Vanilla-fidelity.** Don't invent ability costs/levels; cross-ref `docs/design/spell-ranks.md` if you touch abilities. (This slice probably won't.)
8. **Tests.** Content is covered by `tests/progression.test.ts`, `tests/sim.test.ts`. Run before claiming done.

---

## 4. Claude Code / Fable 5 build prompt (paste-ready, repo-accurate)

> You are working in the Growverse repo (a Vite + Svelte fork of World of Claudecraft). Content is data-as-code in `src/sim/content/`. Read `src/sim/content/CLAUDE.md` and `docs/beavers/THE_DAM_LORE_AND_CHARACTERS.md` before writing anything.
>
> **Task:** Add a small "Baked Beaver" content slice using existing engine systems. Do NOT build new systems, do NOT touch wallet/holder code, do NOT invent abilities.
>
> **Step 1, orient (no code):** Report (a) how `zone3.ts` structures `ZONE3_MOBS`/`ZONE3_NPCS`/`ZONE3_QUESTS`/`ZONE3_CAMPS`/`ZONE3_OBJECTS`, (b) how these merge in `sim/data.ts`, (c) how `skins.ts` defines a cosmetic, (d) how ids register in `src/ui/world_entity_i18n.ts`. Wait for my go-ahead.
>
> **Step 2, build:** Create a **brand-new zone** in `src/sim/content/zone4.ts`, using `zone3.ts` as the structural template (same `ZoneDef` shape: id, name, zMin/zMax, levelRange, biome, hub, graveyard, lakes, pois, welcome; plus `ZONE4_ROADS`, `ZONE4_MOBS`, `ZONE4_NPCS`, `ZONE4_QUESTS`, `ZONE4_QUEST_ORDER`, `ZONE4_CAMPS`, `ZONE4_OBJECTS`, `ZONE4_ITEMS`, `ZONE4_PROPS`).
>
> Zone spec (DECIDED, do not re-litigate):
> - **id:** `the_dam` · **name:** "The Dam"
> - **levelRange:** [1, 6], a fresh newcomer starter area (on-ramp for Beaver community members joining new). Confirm this does not collide with the level band or `zMin/zMax` coordinate range of zone1/zone2/zone3; pick a non-overlapping `zMin/zMax` band and report the numbers you chose before finalizing.
> - **biome:** pick the closest existing valid biome to a wooded riverside/dam (e.g. forest/wetland). Do NOT invent a new biome enum value unless you add it to `types.ts` first.
> - **hub:** "The Dam" beaver town · **POIs:** include "The Tanque" (the watering-hole easter egg).
>
> Add 3 to 5 Beaver NPCs/mobs and 1 to 2 quests using the named characters and lore from `THE_DAM_LORE_AND_CHARACTERS.md` as English source strings (Boone Cascade as the hub quest-giver; a kill or collect questline). Wire everything: register the new module in `sim/data.ts`, add every new entity id (zone, NPCs, mobs, quests, items) to `src/ui/world_entity_i18n.ts`, keep all string ids consistent.
>
> **Step 3, verify:** Run `npm run wiki:content` and commit the regenerated file. Run `npm run check:ts` and the content tests. Report exactly what passed. Do NOT claim done until green.
>
> **Constraints:** Original fan-tribute content only: no Baked Beavers copyrighted art or text. Irreverent stoner-street-art tone. Nod to "Stay Baked AZ" and Arizona/mountain/snowboard motif as flavor. Mark any future holder-reward hook with a `// BEAVER-PHASE3` comment; do not implement it.

---

## 5. The "show the founders" move (after it ships)

1. Record a 30 to 60s clip: traveling to the Beaver area, talking to a Beaver NPC, completing the quest.
2. DM in Discord (you're already a member), builder-to-builder: *"Built a Baked Beaver questline into my game Growverse as a fan, wanted to show you before I do anything public. Open to making it official?"*
3. Lead with the artifact, not an ask.
4. Only after a yes: go public, plan a co-branded event, discuss holder rewards.

---

## 6. NFT / holder rewards (LATER, Phase 3, easier than expected)

The engine already ships `net/wallet.ts`, `sim/holder_tier.ts`, `sim/discord_tier.ts`, and a cosmetics system. So "Beaver holders get a special skin/title" is a **config + gating** task on existing rails, not new infra.

- v1: honor-system, anyone claims the Beaver cosmetic, OR Discord-role gated via the existing `discord_tier` system (lower-lift than wallet).
- Phase 3: extend the existing wallet/holder-tier check to recognize Beaver ownership → grant the holder cosmetic/title. Respect the free-vs-paid split: keep a Discord-role honor tier so free Starter-Beaver members aren't locked out.
- Don't promise tokens/airdrops before talking to a founder.

**Recommendation:** for the community tie-in, lean on the **existing Discord-tier system** first (they already have a Discord you're in) rather than wallet verification. Less code, matches how their community actually gathers.

---

## 7. Priorities snapshot

| Priority | Item | When |
|---|---|---|
| Must-have | Orient against real repo systems (Step 1) | Before any code |
| Must-have | Beaver area + 3 to 5 NPCs/mobs + 1 to 2 quests | This slice |
| Must-have | i18n ids registered + wiki regen + tests green | Same change |
| Must-have | Screen-capture proof clip | After it runs |
| Should | Founder DM with proof | This week / next |
| Can wait | Beaver cosmetic skin | Fast-follow |
| Can wait | Co-branded event (Discord-tier gated) | After founder yes |
| Later | Wallet/holder-tier Beaver rewards | Phase 3, existing systems |

---

## 8. Risks / blind spots

- **Stack mismatch (RESOLVED):** earlier plans assumed a Next.js base-builder. This repo is Svelte/Vite WoW-style. All instructions above are corrected for it.
- **i18n S3 guard:** most likely thing to break a build. The prompt forces registration in `world_entity_i18n.ts`.
- **Wiki staleness:** forgetting `npm run wiki:content` fails CI. Prompt includes it.
- **Scope creep:** ship ONE questline slice first, not a whole zone economy.
- **IP/brand:** fan tribute until a founder says yes; no copied art.
- **Free vs paid holder split:** keep a Discord-role honor tier permanently so free members aren't excluded.
