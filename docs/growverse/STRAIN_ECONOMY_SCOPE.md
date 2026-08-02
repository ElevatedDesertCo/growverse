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

### Gap 1: one item is doing four jobs

`harvestPlot` (`src/sim/cultivation.ts:215`) grants flat `bloom_extract` regardless
of strain. Genetics changes only quantity (`yieldBonus`) and speed
(`growTimeFactor`). A carefully bred Prime cross and a starter Common seed produce
the **identical tradeable good**, so a buyer has no reason to prefer yours.

The deeper problem is that `bloom_extract` is overloaded. It is simultaneously:

1. the cultivation harvest output (`content/cultivation.ts`)
2. a herbalism gathering drop from the vale's flower patches (`content/gathering.ts`)
3. the input to 10 alchemy recipes (`content/crafting.ts`)
4. the breeding cost (`strain_library.ts:23`)

One item cannot be the farmer's commodity, the forager's drop, and the crafter's
input at once. That overload is why grading it is awkward, and it is also why
**gathering currently dominates growing**: picked flowers and a bred harvest yield
the same thing, but picking costs no seed, no timer, and no garden slot.

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

### 2a. Buds: split the harvest from the extract

**Plants yield buds.** That is what a grown plant actually produces, and giving it
its own name lets every other concept keep one job:

| Concept | One job |
|---|---|
| seed | what you plant |
| strain | the genetics |
| **bud** | **what you harvest: the farmer's commodity** |
| process | what you do to buds |
| session | what you consume |

`bloom_extract` stays exactly what it honestly is: a botanical extract pressed
from picked flowers, feeding the inherited alchemy recipes (healing and mana
draughts). **It does not change**, so none of those 10 recipes move and no
existing player inventory needs migrating. Cultivation stops competing with
foraging because they no longer produce the same item at all.

Breeding cost moves from `bloom_extract` to buds. Breeding from your own harvest is
more coherent than breeding from picked flowers, and it makes buds a sink.

**Bud grade comes from potency.** The three genetics traits then map cleanly onto
three separate economic axes, with no overlap:

| Trait | Governs | Status |
|---|---|---|
| `vigor` | grow **time** | implemented (`growTimeFactor`) |
| `yield` | bud **quantity** | implemented (`yieldBonus`) |
| `potency` | bud **grade** | **only flips a binary essence drop today** |

Three bud grades keyed off the expressed potency tier: `bud_common` (tiers 0 to 1),
`bud_fine` (tier 2), `bud_prime` (tier 3). Distinct item ids mean the existing
market, bags, bank, trade, and mail handle them **for free**.

*Why not per-copy item data:* upstream solved that with `ItemInstancePayload`, but
it is 44 files and drags in bank, mail, vendor unbind, enchanting, and masterwork.
That is a professions migration wearing an economy hat. Item ids get the price
signal now; per-copy provenance is Phase 3.

### 2b. Processing: the second axis

What you do with buds determines what you get. The tonic archetypes for this
**already exist** in `content/crafting.ts`, they just have no input chain:

| Process | Output character | Existing exemplar |
|---|---|---|
| **Cure** | instant onset, moderate duration | `lively_bloom_tonic` (sativa-style) |
| **Infuse** | delayed onset, long duration, couch-lock | the `onset: 12` Slow-Bloom tonic |
| **Press** | strongest, shortest | (new) |

`src/sim/sessions.ts` already models `onset` (spark vs edible) and `couchLock`, so
the process chosen *is* the delivery method. Nothing new is needed in the session
system at all.

**3 bud grades x 3 processes = 9 outcomes** from one small content table. Grade
scales the magnitude, process picks the shape. That is real depth for very little
content, and it is exactly "whatever process you do with the buds determines the
outcome."

**The economic payoff is the two-tier supply chain.** Buds are the farmer's
product; sessions are the processor's product. Those are two player roles that
need each other, which is what actually makes a player economy work. A grower with
no interest in alchemy sells raw buds. A processor with no garden buys them. That
is a stronger market than a single commodity everyone both makes and consumes.

### 2c. Quest demand: the buyers who do not grow

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

### 2d. Named genetics: the branding layer

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

### 2e. Cut swapping: barter that is actually about genetics

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
genetics of 2d to matter, so it lands after them.

### 2f. Bulk lots

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
| 1 | **Buds + grades** | A farmer's commodity distinct from foraged extract; quality becomes visible and priceable | ~1 day |
| 2 | **Processing** | Grade x process outcomes; the two-tier supply chain (farmer and processor) | ~1 to 2 days |
| 3 | **Quest demand** | Buyers who do not grow; supply sink; market liquidity | ~1 to 2 days |
| 4 | **Named genetics + breeder credit** | Brands, reputation, the thing worth being known for | ~2 to 3 days |
| 5 | **Cut swapping** | Genetics-for-genetics barter; the differentiated economy | ~3 days |
| 6 | **Bulk pricing view** | Volume trade reads correctly | ~half day |

**Phases 1 to 3 are one unit of work.** Buds without processing is a commodity with
one use. Processing without quest demand is a supply chain whose only customer is
the person who built it. Any one of the three alone produces a market that does not
clear. Plan them as a single arc even if they land as separate commits.

---

## 4. Phase 1 in detail (buildable as written)

**Content**
- `content/items.ts`: `bud_common`, `bud_fine`, `bud_prime`, ascending `sellValue`
  (the vendor floor that keeps player prices off zero).
- `content/cultivation.ts`: `PLANTS` yields change from `bloom_extract` to
  `bud_common` as the declared base; grade resolution happens at harvest.

**Sim**
- `genetics.ts`: one pure function `budGrade(potencyTier): string`. Deterministic,
  no rng, unit-testable directly.
- `cultivation.ts`: `harvestPlot` routes the bulk yield through `budGrade` when the
  plot carries a strain. ~10 lines. `yieldBonus` and the essence arm untouched.
- `strain_library.ts`: `BREED_COST_ITEM` moves from `bloom_extract` to `bud_common`.

**What deliberately does NOT change**
- `bloom_extract` keeps its item id, its herbalism gathering drops, and all 10 of
  its alchemy recipes. No recipe migration, and no player's existing stacks break.

**i18n**
- English names and tooltips for the three bud items, English-only per the
  contributor rule. Verify the harvest notice against the S3 guard
  (`tests/localization_fixes.test.ts`) rather than assuming it still matches.

**Tests**
- `budGrade` across all four potency tiers.
- A high-potency strain harvests `bud_prime`; a Common strain harvests
  `bud_common`; a gathered flower node still yields `bloom_extract`.
- Breeding consumes buds, and errors with none held.
- The parity gate will move (harvest grants a different item id). Same drill as the
  VFX port: measure the drift field by field, confirm only `frames[].events`
  changed, remint as its own commit.

**Explicitly not in Phase 1:** no processing recipes yet (Phase 2), no
item-instance layer, no market code changes, no new UI window, no risk or spoilage
mechanic.

---

## 5. Decisions needed

1. **Bud grade count.** Three (`common` / `fine` / `prime`) matches the existing 0
   to 3 potency range with the bottom two tiers collapsed. Four needs a wider range
   in `genetics.ts`.
2. **Do different strains produce different BUD TYPES, or only grades?** Grades
   alone (one bud item per quality tier) is Phase 1 as written. Bud *types* per
   strain lineage (a sativa-line bud vs an indica-line bud, each biasing which
   process pays off) is richer and more true to the fantasy, but it multiplies the
   item table by the number of lineages. Recommendation: ship grades first, then
   add ONE lineage axis in Phase 2 if the processing matrix feels flat.
3. **Gate or scale.** Recommendation: mostly scale session strength and duration
   with bud grade, plus at least one hard-gated recipe. Pure scaling risks an empty
   market.
4. **Vendor floor on buds.** Recommendation: low but non-zero. It stops a price
   collapse without capping the interesting range.
5. **Do quests mostly `collect` or `cultivate`?** Recommendation: `collect` for the
   bulk (it is what makes the market work), `cultivate` only for a grower-identity
   line.
6. **Strain name moderation.** Player-authored names need a filter and a report
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
- **Player-authored strain names are a moderation surface.** Do not ship 2d without
  a filter.
- **Farmability.** Grades come from breeding, throttled by plot count and
  `MAX_STRAINS = 12`. If either is raised, revisit whether high grades stay scarce.
- **Quest-driven demand can be farmed too.** If a quest is repeatable and its
  reward exceeds the market price of its inputs, it becomes a gold faucet. Keep
  strain quests non-repeatable, or price rewards below input cost.
- **The parity gate will go red** on Phase 1. Expected and benign, but measure
  before reminting.
