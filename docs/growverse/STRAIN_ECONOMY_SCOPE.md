# Design: the Growverse strain economy

**Goal.** A player-driven economy where growers breed named genetics, grade their
harvests, and sell, barter, and swap cuts with other players, with quest demand
underneath it so the market has buyers who do not grow.

**Status.** Design. Phase 1 is buildable as specified; later phases are sketched.

---

## 0. What already exists (checked, not assumed)

More of this is built than it looks from outside the code.

| Piece | State | Where |
|---|---|---|
| Cultivation loop | **Works.** Seed, plot, timer, harvest, press into tonics | `src/sim/cultivation.ts` (290 lines) |
| Genetics | **Works.** Dominant/recessive alleles, 3 traits, tiers 0 to 3, proper segregation | `src/sim/genetics.ts` (140 lines) |
| Sessions (tonics) | **Works.** Spark vs edible onset, couch-lock tradeoff | `src/sim/sessions.ts` |
| Auction market | **Works.** search / list / buy / cancel / collect, 5% merchant cut as a gold sink | `src/sim/market.ts` |
| **Player barter** | **Already works.** `tradeSetOffer(items, copper)` on both sides, so item-for-item at 0 copper is a legal trade today | `src/sim/social/trade.ts` |
| **Quest collect objectives** | **Already works.** `{type:'collect', itemId, count}` | `src/sim/types.ts:1619` |
| Grower reputation | Exists (Baked Beaver faction), hooked at end of harvest | `src/sim/content/reputation.ts` |

**So the plumbing for "sell, trade, barter" is mostly done.** What is missing is
not transaction machinery. It is three things: nothing to differentiate one
grower's product from another's, no identity for what you bred, and no buyer who
is not also a grower.

---

## 1. The three real gaps

### Gap 1: every harvest is the same item

`harvestPlot` (`src/sim/cultivation.ts:215`) grants flat `bloom_extract` regardless
of strain. Genetics changes only quantity (`yieldBonus`) and speed
(`growTimeFactor`). A carefully bred Prime cross and a starter Common seed produce
the **identical tradeable good**, so a buyer has no reason to prefer yours.

Worse: `bloom_extract` is also a herbalism gathering drop from the vale's flower
patches. Cultivated Bloom competes with Bloom you can pick for free, with no seed
cost, no timer, and no garden slot. **Gathering currently dominates growing.**

### Gap 2: what you breed has no name

`breed()` (`src/sim/genetics.ts:104`) does this:

```ts
return { id: newId, baseId: a.baseId, name: a.name, genotype, landrace: ... };
```

A cross inherits parent A's name. You cannot name what you made. This is the
single largest missing piece for the fantasy: strain culture is *entirely* about
named genetics and breeder credit. A market where every seller lists "Common
Bloom" has no brands, no reputation, and nothing to be proud of.

### Gap 3: everyone who wants Bloom can grow Bloom

Tonics buff the drinker. If the only consumer of Bloom is a grower, the market
clears at zero. **This is the load-bearing risk of the whole design**, and the fix
is not economy plumbing.

---

## 2. The design

### 2a. Grades: one trait, one job

The three genetics traits map onto the three economic axes, and one sits unused:

| Trait | Governs | Status |
|---|---|---|
| `vigor` | grow **time** | implemented (`growTimeFactor`) |
| `yield` | harvest **quantity** | implemented (`yieldBonus`) |
| `potency` | harvest **grade** | **only flips a binary essence drop today** |

Promote `potency` to the quality axis. Four grades keyed off the expressed tier:

| Source | Grade |
|---|---|
| Herbalism gathering (picked) | `bloom_extract` |
| Cultivated, potency 0 to 1 | `bloom_extract` |
| Cultivated, potency 2 | `bloom_extract_fine` |
| Cultivated, potency 3 | `bloom_extract_prime` |

This fixes Gap 1 and the gathering-dominates problem in one move: picked Bloom is
the floor, and everything above it is cultivation-only. Distinct item ids mean the
existing market, bags, bank, trade, and mail handle grades **for free**.

*Why not per-copy item data:* upstream solved that with `ItemInstancePayload`, but
it is 44 files and drags in bank, mail, vendor unbind, enchanting, and masterwork.
That is a professions migration wearing an economy hat. Item ids get the price
signal now; per-copy provenance is Phase 3.

### 2b. Quest demand: the buyers who do not grow

`collect` objectives already exist, so "bring the Baked Beaver 12 Fine Bloom" is a
**content row, not a feature**. And the important property is one that looks like a
loophole and is actually the point:

> A collect objective can be satisfied by **buying** the item.

That is the demand engine. A player who does not want to farm buys from one who
does, to finish the quest. Quest turn-ins remove the item from circulation, so
every quest is both a demand source and a supply sink. This is the cleanest
available answer to Gap 3, and it costs almost nothing to build.

Two objective flavors, and they serve different jobs:

- **`collect` (exists).** Satisfiable by purchase. Use for the *bulk* of strain
  quests. This is what makes the market liquid.
- **`cultivate` (new, small).** Requires harvesting it yourself, tracked at
  `harvestPlot`. Use sparingly, for the grower-identity quest line where buying
  your way through would defeat the point.

Ship `collect` quests first. Add `cultivate` only where a quest genuinely must
mean "you grew this."

### 2c. Named genetics: the branding layer

The mechanic that makes this Growverse and not a generic auction house.

- When a cross is bred, the player **names it**. The name persists on the `Strain`
  in their library and travels with anything descended from it.
- The strain carries **breeder attribution**: the character who first bred that
  cross. A strain that spreads carries your name with it.
- Named strains are what get talked about, sought out, and paid a premium for.
  Reputation attaches to a grower, not just to a stat line.

Cost: a `name` field the player sets (already on `Strain`, just never player-set),
a `breeder` field, validation, and a moderation path. **Player-authored text is a
moderation surface** and must go through whatever the existing name filter is, not
around it.

### 2d. Cut swapping: barter that is actually about genetics

Barter already works mechanically. What is missing is the thing worth bartering.

Real grower trade is not mostly product for cash. It is **genetics for genetics**:
you trade a cut of your mother plant for a cut of theirs. That maps directly onto
the strain library you already have, and it is a genuinely different economy from
every other MMO, which trade only finished goods.

- A **Cut** is a tradeable item that carries a strain: taking a cut from a library
  strain mints one, and using a Cut adds that strain to your library.
- Cuts trade through the existing barter path with zero gold, and through the
  market as listings.
- The `MAX_STRAINS = 12` library cap is the natural throttle: a full library means
  choosing what to keep, which is exactly the real tension.

This is the highest-differentiation mechanic in the document. It needs the named
genetics of 2c to matter, so it lands after them.

### 2e. Bulk lots

Real trade is denominated in size, with volume discounts. Model it simply: a
listing carries a unit count and the market view shows **price per unit** next to
the total, so a buyer can compare a small lot against a bulk one. Bulk sellers
naturally undercut per unit. No new mechanics, just a derived column and the
listing sizes players choose.

Defer anything resembling credit, fronting, or consignment. It creates debt state,
collections, and a scam surface, for little play value.

---

## 3. Build order

Each phase is independently shippable and useful on its own.

| # | Phase | What it unlocks | Rough size |
|---|---|---|---|
| 1 | **Grades** | Quality becomes visible and priceable; cultivation stops losing to gathering | ~1 day |
| 2 | **Quest demand** | Buyers who do not grow; supply sink; market liquidity | ~1 to 2 days |
| 3 | **Named genetics + breeder credit** | Brands, reputation, the thing worth being known for | ~2 to 3 days |
| 4 | **Cut swapping** | Genetics-for-genetics barter; the differentiated economy | ~3 days |
| 5 | **Bulk pricing view** | Volume trade reads correctly | ~half day |

**Phases 1 and 2 are the pair that matters.** Grades without quest demand is a
market with sellers and no buyers. Quest demand without grades is a market where
every unit is interchangeable. Ship them together or back to back.

---

## 4. Phase 1 in detail (buildable as written)

**Content**
- `content/items.ts`: `bloom_extract_fine`, `bloom_extract_prime`, ascending
  `sellValue` (the vendor floor that keeps player prices off zero).
- `content/crafting.ts`: grade-aware tonic recipes, including one grade-gated
  recipe that picked Bloom cannot make.

**Sim**
- `genetics.ts`: one pure function `harvestGrade(potencyTier): string`.
  Deterministic, no rng, unit-testable directly.
- `cultivation.ts`: `harvestPlot` routes the bulk yield through `harvestGrade` when
  the plot carries a strain. ~10 lines. `yieldBonus` and the essence arm untouched.

**i18n**
- English names and tooltips for the two items, English-only per the contributor
  rule. Verify the harvest notice against the S3 guard
  (`tests/localization_fixes.test.ts`) rather than assuming it still matches.

**Tests**
- `harvestGrade` across all four tiers.
- A high-potency strain harvests the graded item; a Common strain and a gathered
  node both still yield base `bloom_extract`.
- The parity gate will move (harvest grants a different item id). Same drill as the
  VFX port: measure the drift field by field, confirm only `frames[].events`
  changed, remint as its own commit.

**Explicitly not in Phase 1:** no item-instance layer, no market code changes, no
new UI window, no risk or spoilage mechanic.

---

## 5. Decisions needed

1. **Grade count.** Four (base + two cultivated) matches the existing 0 to 3
   potency range. Five needs a wider range in `genetics.ts`.
2. **Gate or scale.** Recommendation: mostly scale buff strength and duration with
   grade, plus at least one hard-gated recipe. Pure scaling risks an empty market.
3. **Vendor floor on graded Bloom.** Recommendation: low but non-zero. It stops a
   price collapse without capping the interesting range.
4. **Do quests mostly `collect` or `cultivate`?** Recommendation: `collect` for the
   bulk (it is what makes the market work), `cultivate` only for a grower-identity
   line.
5. **Strain name moderation.** Player-authored names need a filter and a report
   path. Which existing moderation surface should they route through?

---

## 6. Risks

- **Demand is the whole ballgame.** If Phase 2 quests do not create real pull,
  everything above is a well-built market nobody uses. Watch which recipes and
  quests actually get used, not how many exist.
- **Low population breaks player economies.** A market needs sellers to be liquid.
  Grades still work as a solo progression ladder when nobody is online, which is a
  deliberate property of this design and a reason to prefer it over a pure
  auction-house feature.
- **Player-authored strain names are a moderation surface.** Do not ship 2c without
  a filter.
- **Farmability.** Grades come from breeding, throttled by plot count and
  `MAX_STRAINS = 12`. If either is raised, revisit whether high grades stay scarce.
- **Quest-driven demand can be farmed too.** If a quest is repeatable and its
  reward exceeds the market price of its inputs, it becomes a gold faucet. Keep
  strain quests non-repeatable, or price rewards below input cost.
- **The parity gate will go red** on Phase 1. Expected and benign, but measure
  before reminting.
