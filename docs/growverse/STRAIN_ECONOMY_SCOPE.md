# Scope: the graded strain economy

**Goal.** Make cultivated Bloom worth money to someone other than the grower, so
genetics produce a price signal instead of a private stat buff.

**Status.** Scoping only. Nothing here is built.

---

## 1. The problem, precisely

The cultivation loop already works end to end: craft a seed, plant it in one of
`GARDEN_PLOT_COUNT` plots, wait out `growSeconds`, harvest, press the Bloom into
tonics. Breeding works too: `src/sim/genetics.ts` carries dominant/recessive
alleles across three traits (`potency`, `vigor`, `yield`) at tiers 0 to 3, and
`breedGenotype` segregates them properly.

The gap is in one line of `harvestPlot` (`src/sim/cultivation.ts:215`):

```ts
for (const y of def.yields) ctx.addItem(y.itemId, y.count, meta.entityId);
```

Every harvest, from every strain, grants the same fungible `bloom_extract`.
Genetics currently changes only **how much** you get:

- `yieldBonus(expressTrait(g, 'yield'))` adds extra units of the bulk yield
- `dropsEssence(expressTrait(g, 'potency'))` adds an essence on a potent strain
- `growTimeFactor(expressTrait(g, 'vigor'))` shortens the timer

So a carefully bred Prime cross and a starter Common seed produce **the identical
tradeable good**. A buyer has no reason to prefer yours, and therefore no reason
to pay for it. The breeding system has no economic consumer.

**A second problem that makes this worse.** `bloom_extract` is also a herbalism
gathering drop from the vale's flower patches (`src/sim/content/gathering.ts`,
consumed by the alchemy recipes at `src/sim/content/crafting.ts:660+`). Cultivated
Bloom competes directly with Bloom you can pick off the ground for free. Right now
gathering strictly dominates: same item, no seed cost, no timer, no garden slot.

**What already works and needs no changes.** The market is complete:
`market_search`, `market_list`, `market_buy`, `market_cancel`, `market_collect`
are live on `IWorld`, listings are `{itemId, count, price}`, and items carry a
`sellValue` vendor anchor. Players can already trade Bloom. It is just not worth
trading.

---

## 2. Why not item instances

The obvious fix is per-copy item data: attach the genotype to the harvested stack.
The fork cannot do this today. `InvSlot` is `{itemId, count}` with no payload, and
`MarketListing` is `{itemId, count, price}`.

Upstream solved it for Professions 2.0 with `ItemInstancePayload`
(`signer`, `rolled.stats`, `masterwork`, `enchant`, `craftedRecipeId`, `boundTo`)
plus `item_instance_merge.ts` and `item_instance_transfer.ts`. It is good code.

**It is also 44 files across sim, net, server, and UI**, and it drags in bank,
mail, trade, vendor unbind, enchanting, and masterwork. That is a professions
migration wearing an economy hat. Not step one.

**Item ids are the cheap path.** Distinct ids per grade are ordinary stackable
items, so the existing market, bags, bank, trade, mail, and vendor all handle them
for free, with zero new architecture. Classic MMOs ship consumable tiers exactly
this way. The cost is item-table rows and a loss of per-copy identity (you cannot
tell WHOSE Prime Bloom this is), which is Phase 2's problem, not Phase 1's.

---

## 3. The design

**One trait, one job.** The three genetics traits already map cleanly onto the
three economic axes, and only one of them is currently unused as an axis:

| Trait | Governs | Status |
|---|---|---|
| `vigor` | grow **time** | already implemented (`growTimeFactor`) |
| `yield` | harvest **quantity** | already implemented (`yieldBonus`) |
| `potency` | harvest **grade** | **this is the change** |

Today `potency` only flips a binary essence drop. Promoting it to the quality axis
gives each trait a distinct economic meaning and makes breeding decisions real:
breed for speed, for volume, or for grade, and the market prices the difference.

**The grade ladder.** Four grades keyed off the expressed potency tier (0 to 3):

| Potency tier | Grade item | Source |
|---|---|---|
| n/a | `bloom_extract` | herbalism gathering (unchanged) |
| 0 to 1 | `bloom_extract` | a Common cultivated harvest |
| 2 | `bloom_extract_fine` | a bred strain |
| 3 | `bloom_extract_prime` | a well-bred strain |

This also fixes the gathering-dominates problem: picked Bloom stays the base
grade, and the grades above it are cultivation-only. Gathering keeps feeding the
low-end recipes; breeding owns the top of the ladder.

**The demand side is the load-bearing half.** Grades are worthless if nobody needs
them. The tonic recipes must give a non-grower a reason to buy:

- Higher grades produce **stronger or longer** Session tonics, not just cheaper
  ones. `src/sim/sessions.ts` already models `onset` (spark vs edible) and
  `couchLock`, so grade can scale buff magnitude and duration against that
  existing tradeoff.
- At least one desirable tonic should be **grade-gated**, not merely
  grade-improved: a recipe that cannot be made from picked Bloom at all.

Without this, everyone grows their own and the market stays empty. **This is the
part most likely to be got wrong, and it is a balance question, not a code
question.**

---

## 4. Phase 1 scope (the buildable unit)

Deliberately small. Every piece is inside code the fork already owns.

**Content (`src/sim/content/`)**
- `items.ts`: two new item rows, `bloom_extract_fine` and `bloom_extract_prime`,
  with ascending `sellValue` (the vendor floor that anchors market pricing).
- `crafting.ts`: grade-aware tonic recipes, including one grade-gated recipe.
- `cultivation.ts`: no change (`PLANTS` keeps declaring the base yield).

**Sim (`src/sim/`)**
- `genetics.ts`: one new pure function, `harvestGrade(potencyTier): string`,
  returning the graded item id. Deterministic, no rng, unit-testable directly.
- `cultivation.ts`: `harvestPlot` routes the bulk yield through `harvestGrade`
  when the plot has a strain. Roughly 10 lines. The `yieldBonus` and essence
  arms are untouched.
- `sessions.ts`: no change if grade scales through recipe outputs (preferred).

**i18n (`src/ui/i18n.catalog/`)**
- English names and tooltips for the two new items, English-only per the
  contributor rule.
- `src/ui/sim_i18n.ts`: the harvest notice already interpolates the strain name,
  so it should need no new rule. **Verify against the S3 guard**
  (`tests/localization_fixes.test.ts`), do not assume.

**Tests (`tests/`)**
- `genetics.test.ts`: extend for `harvestGrade` across all four tiers.
- `cultivation.test.ts`: a bred high-potency strain harvests the graded item; a
  Common strain and a gathered node both still produce base `bloom_extract`.
- The parity gate will move again (harvest grants a different item id). Same
  drill as the VFX port: measure the drift field by field first, confirm only
  `frames[].events` changed, then remint as its own commit.

**Explicitly NOT in Phase 1**
- No item-instance layer, no per-copy provenance, no "grown by <player>".
- No market code changes at all. Graded items list and sell as ordinary stacks.
- No new UI window. Grades are items; bags and the market view render them already.
- No risk, heat, territory, or spoilage mechanic. See Phase 3.

**Rough size:** two content tables, one pure function, ~10 lines in `harvestPlot`,
i18n rows, three test files, one golden remint. Comparable to a day of work, and
the balance pass afterwards will take longer than the code.

---

## 5. Open decisions (these need your call)

1. **How many grades?** Four (base plus two cultivated tiers) is proposed, matching
   the existing 0 to 3 potency tiers with the bottom two collapsed. Five would need
   a wider potency range in `genetics.ts`.
2. **Do grades gate recipes or scale them?** Recommendation: mostly scale, with at
   least one gated recipe so high grades have inelastic demand. Pure scaling risks
   a market where nobody bothers.
3. **Does the vendor buy graded Bloom?** A vendor `sellValue` floor stops player
   prices collapsing to zero, but it also caps how interesting the market gets. A
   low floor is probably right.
4. **Does the Baked Beaver reputation track cultivation grade?** There is already a
   cultivation reputation hook at the end of `harvestPlot`. Grade could feed it,
   which gives solo players a reason to grow high-potency even with no buyer.

---

## 6. Risks worth naming now

- **The demand problem is the real problem.** Everything here is easy except
  making a non-grower want to buy. If Phase 1 ships and the market stays empty,
  the answer is recipe design, not more economy plumbing.
- **Gathering still competes.** The grade ladder pushes picked Bloom to the bottom,
  but if the low-grade recipes stay the ones people actually use, cultivation
  remains optional. Watch which recipes get used, not which get added.
- **Low population breaks player economies.** A market needs enough sellers to be
  liquid. Below some concurrency the whole system reads as broken. Graded items at
  least still function as a solo progression ladder when nobody is online, which is
  a deliberate property of this design and a reason to prefer it over a pure
  auction-house feature.
- **Farmability.** Grades come from breeding, which is time-gated by plots and
  `MAX_STRAINS = 12`. That is a natural throttle. If plots or the library cap are
  ever raised, revisit.
- **The parity gate will go red.** Expected and benign, same as the VFX port, but
  it must be measured rather than assumed before reminting.

---

## 7. Phases beyond this

- **Phase 2, provenance.** "Prime Bloom, grown by <player>" as a tradeable identity.
  Either a narrow cultivation-only instance model, or upstream's
  `ItemInstancePayload` if professions are being ported anyway. Only worth doing
  once Phase 1 proves people trade at all.
- **Phase 3, risk.** Contested grow sites, spoilage, or an enforcement/heat
  mechanic. This is where the loop starts to resemble what made the recent
  crime-sim titles sell, and it is the most differentiated thing on this list.
  It is also the most speculative. Do not scope it until Phase 1 has data.
