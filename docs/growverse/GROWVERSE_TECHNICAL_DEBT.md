# GROWVERSE: Technical Debt Register (Phase 0)

Date: 2026-07-14. Evidence-based. Severity: P0 (blocking) / P1 (core) / P2 (important) /
P3 (nice-to-have). "Effort" is a rough order of magnitude. Companion to
`GROWVERSE_CURRENT_STATE_AUDIT.md` and `GROWVERSE_SYSTEM_ARCHITECTURE.md`.

---

## Blocking / correctness

| ID | Severity | Item | Evidence | Effort |
|---|---|---|---|---|
| TD1 | P1 | `npm test` RED: Mirror Lake fishing cast interrupted by a mob | RESOLVED. `tests/sim.test.ts` "rolls the fishing catch table only when the cast completes" failed deterministically (seed 42): a by-design `q_murlocs` Siltling on the Mirror Lake shore reached the reseated dock's computed fishing spot and interrupted the cast. Fixed test-first by clearing mobs (matching the sibling fishing tests), since the test verifies clean catch-on-completion, not lakeshore safety. Follow-up (P3): the reseated dock now overlaps the murloc shore camp, a minor content/UX note for the team | S |
| TD2 | P1 | No content id-integrity validation | `src/sim/content/CLAUDE.md`: "there's no compile check that a `loot.itemId` exists"; a bad `requiresQuest`/spawn/loot id ships silently | S |

## Persistence / scale (architecture blockers, tracked in ARCHITECTURE doc)

| ID | Severity | Item | Evidence | Effort |
|---|---|---|---|---|
| TD3 | P2 (P1 at scale) | Whole-character JSONB blob rewritten every ~30s | `serializeCharacter` -> `saveCharacterState` (`server/db.ts:1812`); no relational item/quest/rep tables; write amplification grows with new state | L |
| TD4 | P2 | No item-instance identity / economy ledger | market is per-realm JSONB; cannot trace/audit/dupe-forensic | L |
| TD5 | P3 (P1 at scale) | Single-process/single-thread/single-world runtime | `server/game.ts:997`; ceiling ~50-200 co-located players; snapshot serialization on tick thread | XL |
| TD6 | P2 | Content-as-code => restart-to-deploy | quests/NPCs/items hardcoded, merged at boot in `data.ts`; live expansion disconnects everyone | L |
| TD7 | P3 | Ad-hoc migrations (no versioned framework) | idempotent `CREATE/ALTER ... IF NOT EXISTS` re-run at boot; hand-rolled blob fixups | M |

## Modularity / monoliths (active extraction targets, non-blocking)

| ID | Severity | Item | Evidence | Effort |
|---|---|---|---|---|
| TD8 | P3 | Fishing channel still inside `sim.ts` | `startFishing`/`completeFishing` in `sim.ts` while `harvest.ts` was extracted and "mirrors the fishing channel" (duplication) | S |
| TD9 | P3 | `hud.ts` 11.8k / `main.ts` 7.5k / `sim.ts` 5.9k / `renderer.ts` 5.1k / `server/game.ts` 3.8k | line counts; module-first rule says never grow them, extract new behavior as siblings | ongoing |
| TD10 | P3 | `main.ts` accretes identity plumbing | ~1k+ lines of wallet/Discord/GitHub linking that belong in extracted modules | M |
| TD11 | P3 | `types.ts` 2.4k god-module (types + constants + formulas + SimEvent union) | one file for all shared types; would benefit from per-domain splits at scale | M |

## Content / divergence debt

| ID | Severity | Item | Evidence | Effort |
|---|---|---|---|---|
| TD12 | P2 | Divergence ~20-25% done; zones 2-4 + Hollowmere + dungeons + raid are inherited fantasy | `content/zone2-4.ts`, `hollowmere.ts` headers; `docs/content-audit.md` "New" columns 100% blank | XL (content) |
| TD13 | P2 | "Cultivation" is theming, not a mechanic | `content/crafting.ts:11-15` "NOT where plants grow"; `prime_strain_seed` is a dead-end junk item | (=Phase B) |
| TD14 | P2 | Brand split: old identity in 220 files | canonical URL + hreflang in `index.html` still `worldofclaudecraft.com`; android/ios package ids `com.worldofclaudecraft`; token `$WOC`; mint hardcoded | M |
| TD15 | P3 | Internal zone ids still WoW-era | `eastbrook_vale`/`mirefen_marsh`/`thornpeak_heights` (display names differ), renaming ids is determinism/persistence-sensitive, do carefully | M |
| TD16 | P3 | Named IP cast (Anderz, Solace, Raiin/Vyrra...) exist only in docs | `grep` hits only `tests/offline_characters.test.ts` fixtures | (=content) |

## Framework gaps (needed for the vision; not "debt" so much as unbuilt)

| ID | Severity | Item | Notes |
|---|---|---|---|
| TD17 | P2 | Quest framework: only kill/collect/interact, single linear prereq, no branching/choice | `quests/quest_credit.ts`, `QuestObjective` in `types.ts` |
| TD18 | P2 | NPC dialogue is one greeting string, no trees | `NpcDef.greeting`, `interaction.ts` |
| TD19 | P2 | Guilds are a name+rank string, no bank/perms/progression | `PlayerMeta.guild`, `server/social_db.ts` |
| TD20 | P2 | Scripted bosses are bespoke code (Nythraxis 1.2k lines), no authoring framework | `encounters/nythraxis.ts` |
| TD21 | P3 | Character customization is skin-only (no gender/hair/face/clothing) | `src/ui/character_appearance.ts` (46 lines) |

## Security / supply chain (monitor)

| ID | Severity | Item | Notes |
|---|---|---|---|
| TD22 | P3 | Wallet surface warrants a focused security pass | Solana stack + a `security:gate` malware/wallet-drainer scan exists; run `privacy-security-review` before wallet changes |
| TD23 | P3 | Behavioral bot detector ships as a no-op stub in the public tree | `server/bot_detector/stub.ts`; real detection needs the private clone + `ANTIBOT_ENFORCE=1` |

---

## Recommended debt-paydown ordering

1. **TD1, TD2 now** (Phase A quick wins), green CI + a content safety net.
2. **TD8** alongside Phase A (cheap monolith trim while touching fishing).
3. **TD3/TD4 incrementally** as Phase B/C add new persistent state (relational for the new
   state only; leave the working blob for legacy fields).
4. **TD17 with Phase D** (quest depth), **TD18/TD20** as content needs them.
5. **TD14/TD15 as a tracked branding sweep** (identity-level; not ad hoc), coordinated with the
   owner's canon decisions.
6. **TD5/TD6 deferred** until concurrency or live-content cadence demands them.
</content>
