# What to take from Hempire and Bud Farm

**Date:** 2026-08-02
**Purpose:** Research pass on the two reference titles, filtered through what Growverse
actually is (a 20 Hz MMORPG with combat as its core loop), not what they are (mobile
tycoon / idle tapper).

---

## 0. The filter

Both reference games are **mobile free-to-play with retention monetization**. Growverse
is a persistent-world MMORPG. That difference kills a third of their design outright,
and it is worth being blunt about which third, because copying it would actively hurt:

| Their mechanic | Why it works there | Why it does NOT port |
|---|---|---|
| Idle / tap progression | The game plays itself between sessions | Growverse's core loop is active combat; idle income competes with it |
| Timed watering windows that DECAY | Punishing absence is the retention hook | An MMO player is offline mid-raid; punishing that is hostile |
| Energy gates, timer skips | The monetization surface | No equivalent, and you do not want one |

**And a hard line on what is not ours to take:** mechanics and system design are fair game
and are how the genre advances. Art, UI layouts, character names, and real-world strain
brand names are not. This repo already made that call deliberately: the strain name pools
in `src/sim/strain_naming.ts` are in the fork's own vale/marsh/peaks register
specifically so nothing is borrowed from real-world brands. Keep that discipline.

---

## 1. The single best idea: strain MASTERY

**What Hempire does.** Growing a plant *well* (hitting its watering intervals, reaching
perfect health) raises a permanent **mastery** level for that strain. Higher mastery
means permanently more buds and better odds of the rare Epic Bud drop.

**Why it matters here.** Growverse cultivation currently has **zero skill expression**.
You plant, a timer runs, you harvest. The outcome is fully determined at plant time by
the genotype. Nothing you do between planting and harvesting changes anything, so there
is no reason to be present and no way to get better at growing.

Mastery fixes exactly that, and it stacks cleanly on what exists: genetics decide the
strain's ceiling, mastery decides how close to that ceiling you actually get.

**The adaptation that matters.** Do NOT copy the decay. Hempire shrinks your next
watering window when you miss one, because punishing absence is its retention model.
In an MMO that reads as a punishment for playing the rest of the game. Invert it:

> Tending is an **opt-in bonus**, never a penalty. A crop left alone yields exactly what
> it yields today. A crop tended at the right moments yields more and builds mastery.

An untended plant must never yield *less* than it does now, or every raid night becomes
a cultivation loss.

---

## 2. Breeding ideas worth stealing

**Epic Buds as the breeding input.** Hempire gates breeding behind two rare buds (a
mother and a father), dropped randomly on harvest and **guaranteed on a perfect grow**.
That is a much better gate than Growverse's current flat cost of 2 Common Buds, because
it ties the breeding economy to grow *skill* rather than grow *volume*. A grower who
tends well breeds more. Pairs naturally with mastery above.

**Breeding IMPROVES an already-discovered strain.** In Hempire, crossing a strain you
already have does not waste the attempt: it raises that strain's quality instead. This is
a clean answer to a real pressure Growverse has: `MAX_STRAINS = 12` means a library fills
and every further cross forces a release. An "improve instead of add" path gives a full
library somewhere to go.

**Quality levels separate from genetics.** Hempire runs a per-strain quality ladder
(bronze, silver, gold, green, shiny silver, platinum) alongside the strain identity.
Growverse's bud grades (common / fine / prime) are the same idea at lower resolution.
Worth knowing the ladder can be longer than three rungs if the economy wants more
gradations to price.

---

## 3. The Hempire Cup: the best fit of anything researched

**What it is.** A 20-player competition on a 48-hours-on / 48-hours-off cycle. Everyone
starts with a set of tournament buds and can earn more; you have the window to breed them
against your own collection to push the quality rating as high as you can. Rewards scale
with your league, and finishing top 3 earns a gem that eventually promotes you a tier.

**Why it fits Growverse specifically.** This is the one system that is *more* at home in
an MMO than in a mobile tycoon, because it is inherently multiplayer and Growverse already
has the scaffolding it needs:

- ranked competition with Elo and matchmaking (`social/arena.ts`)
- leaderboards
- a seasonal-event precedent upstream (the Vale Cup)
- and now a breeding system with a quality axis to actually compete on

**And it solves an economy problem.** The strain-economy doc flags that a player market
needs enough buyers to stay liquid. A recurring Cup is a **scheduled demand spike**: for
48 hours, everyone competing wants high-grade buds, and most of them would rather buy
than breed. That is exactly the pull the market needs, on a timer, forever.

I would rank this above every remaining item on the strain-economy roadmap except
finishing the fusion ceremony.

---

## 4. Building taxonomy: one building, one verb

**What both games do.** Their bases decompose into single-purpose structures: storage
(Warehouse, Shed), production (Bakery, Oil Factory, Cannabis Factory), commerce
(Dispensary, Global Market, Pawn Shop), and specialists (Breeding Lab, Distribution
Center). Every building answers exactly one question, and the base reads as a legible
production chain rather than a menu.

**This is already the instinct behind Breeding Chamber + Extraction Lab.** It is the
right one. The rule to hold: **a building is a verb, not a container.** The moment a
structure does two unrelated things it stops teaching the player anything.

Growverse's current and proposed set maps cleanly:

| Structure | Verb | State |
|---|---|---|
| Garden field | grow | built |
| Grow Station | make what growing needs | built |
| **Breeding Chamber** | **cross** | **built this session** |
| **Extraction Lab** | **concentrate** | **proposed below** |
| Alchemy Lab | brew Sessions | built (Sable) |
| World Market | trade | built |

---

## 5. The Extraction Lab

The press process already exists (`pressed_resin_fine` / `pressed_resin_prime`), so the
lab has a system to house rather than needing one invented. What it adds is a third axis:
**extraction METHOD**, alongside bud grade and the existing cure/press/infuse split.

Proposed methods, ordered by how much they ask of the player:

| Product | What it asks for | Why that is interesting |
|---|---|---|
| **Hash** | Any grade, no extra input | The floor. Turns surplus common buds into something sellable. |
| **Shatter** | Fine+, a press accessory | The workhorse tier. |
| **Live Resin** | **Buds processed within minutes of harvest** | See below. The best mechanic in this list. |
| **Diamonds** | Prime buds, a long process time | The prestige tier. Something to point at. |

**Live Resin is the one to build first.** Real live resin is made from material that
never dried, which means in-game it must be extracted from a *fresh* harvest. That
constraint is authentic AND it is a genuinely good mechanic: it creates a reason to be
standing at the lab when your crop finishes, rather than harvesting whenever you happen
to walk past. It rewards presence without punishing absence, which is exactly the
adaptation rule from section 1. Nothing is lost by missing the window; you simply make
hash instead.

Implementation sketch: buds carry a `harvestedAt` sim time, and the live-resin recipe
checks freshness. That is one field and one guard, reusing the plot timer pattern already
in `cultivation.ts`.

---

## 6. From Bud Farm specifically

Bud Farm is an idle tapper, so most of it does not transfer. Two things do:

- **Minigames as a change of pace** ("Bongo Battles"). Growverse already has this
  instinct: there is a card minigame and the Vale Cup upstream. A short chamber or lab
  minigame would fit the same slot.
- **A collectible roster.** Their pot-head / critter collection is the same shape as a
  strain library. Growverse's library IS the collection, and now that strains carry names,
  lineage, and a breeder, it can carry the same pride.

What NOT to take from it: tap-to-progress and idle income. Both directly compete with
combat for the player's attention, and combat is the thing Growverse is actually built on.

---

## 7. Recommended order

1. **Fusion ceremony** (already scoped) — the cross needs a visible moment and a name reveal.
2. **Extraction Lab + Live Resin** — the user's ask, and the freshness constraint is the
   most interesting single mechanic researched.
3. **Strain mastery** — the biggest missing piece in cultivation. Bonus-only, never decay.
4. **Epic Buds gate breeding** — pairs with mastery; makes grow skill the breeding economy.
5. **Breed-to-improve** — relieves the `MAX_STRAINS` cap.
6. **The Cup** — the largest win, and the one that makes the player market liquid. Wants
   1 to 5 in place first so there is something to compete on.

## Sources

- [Hempire Wiki: Breeding Lab](https://hempire.fandom.com/wiki/Breeding_Lab)
- [Hempire Wiki: Buildings](https://hempire.fandom.com/wiki/Buildings)
- [Hempire Wiki: Hempire Cup](https://hempire.fandom.com/wiki/Hempire_Cup)
- [Hempire Help Center: Breeding Lab](https://lbc-studios-inc.helpshift.com/hc/en/3-hempire/section/21-breeding-lab/)
- [Hempire Help Center: The Hempire Cup](https://lbc-studios-inc.helpshift.com/hc/en/3-hempire/section/25-the-hempire-cup-1649368082/)
- [Hempire Help Center: Increasing a Strain's Mastery Level](https://lbc-studios-inc.helpshift.com/hc/en/3-hempire/faq/63-how-to-increase-a-strain-s-mastery-level/)
- [High Times: Everything You Need To Know About Hempire](https://hightimes.com/entertainment/hempire-game-everything-you-need-know-about-hempire/)
- [Level Winner: Hempire Strategy Guide](https://www.levelwinner.com/hempire-tips-cheats-strategy-guide/)
- [Bud Farm: Idle Tycoon (MWM)](https://mwm.ai/apps/bud-farm-idle-tycoon-game/1445219537)
- [Bud Farm: Idle Tycoon (Google Play)](https://play.google.com/store/apps/details?id=com.LDRLY.budfarmidletycoon)
