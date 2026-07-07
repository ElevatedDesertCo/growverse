# The Dam: Beaver Zone Lore & Characters (drop-in content)

Original fan-tribute content for Growverse. Inspired by Baked Beavers' tone; no copied art or text.
Tone: irreverent, stoner-street-art, confident. Arizona / mountain / snowboard motif.
**Format note:** written for THIS engine (WoW-style: zone + NPCs + mobs + quests), not a base-builder.

---

## The place: The Dam (a zone or POI)

A hidden hollow where a colony of galaxy-blue beavers dammed a river and built a shanty-town of driftwood and neon. Smoke drifts off the water. Snowboards lean on every wall. Newcomers to the world map: they came down off the frozen ridges and never left.

**Easter egg POI:** *The Tanque*, the colony's watering hole, a neutral hangout where the flavor text nods to Tanque Verde / JARS. Motto stitched on the entry banner: **Stay Baked, AZ.**

---

## Origin narrative (zone description / lore, ~3 short paragraphs)

> Nobody invited the Beavers. They came down off the frozen ridges on snowboards, dragging a half-built dam behind them and a strain nobody had seen before, something that grew in cold thin air where nothing should. They dammed the river, lit their first fire, and named the place home. "Our dam is here now," their elder said. Nobody argued.
>
> The Dam grows loud and grows fast. Where the older settlements hoard and hide, the Beavers burn open and share the smoke. Their crop runs hot and blue, laced with something the mountain gave them. Travelers who wander in leave slower, happier, and usually holding a snack they don't remember accepting.
>
> Their creed is shouted at the start of every gathering: **Stay Baked, AZ.** It doesn't mean anything. It means everything. The Dam doesn't want to conquer the map. They just want a bigger dam, a hotter fire, and everyone invited to the burn.

---

## Beaver NPCs & mobs (use as entity records)

Map each to the engine's NPC/mob record shape (id, name, greeting, questIds for NPCs; stats/loot for mobs). Names/greetings are the English i18n source: remember to register ids in `src/ui/world_entity_i18n.ts`.

**1. Boone Cascade:** elder / main quest-giver (NPC)
Galaxy-blue fur, cracked snowboard as a throne. Came down the mountain first. Talks slow, three steps ahead. *Greeting hook:* welcomes the player to The Dam, hands out the intro quest.

**2. Sequoia "Seq" Marsh:** grower / vendor (NPC)
Runs the blue-strain grows; the only Beaver who tracks numbers, so she's the closest thing to a merchant. *Role:* vendor + a collect quest.

**3. Ollie Ridgeback:** raid-happy scout (NPC or mob-adjacent)
Never met a fight he didn't board straight into. *Role:* gives a kill quest against a local pest/mob.

**4. Wren "The Broadcast" Alder:** the voice (NPC)
Runs the Beaver signal, a pirate broadcast. Nod to their real Monday show. *Role:* daily/repeatable quest board flavor.

**5. Junie Stonewater:** lorekeeper (NPC)
Oldest Beaver; remembers the ridge before the descent. Speaks in riddles that turn out to be directions. *Role:* unlocks the origin lore + the hidden Tanque POI.

**Filler mobs (for kill/collect objectives):** Haze Critters, Driftwood Snappers, or a mild "Overbaked" beaver-gone-feral: low-level, on-theme, safe to invent since they're new mobs (not abilities).

---

## Suggested first questline (1 to 2 quests = the proof slice)

1. **"Welcome to The Dam"** (Boone): travel + interact intro: talk to Boone, then to Junie, unlock the lore. Reward: XP + a few copper.
2. **"Clear the Haze"** (Ollie): kill objective: thin out N Haze Critters near the dam. Reward: XP + copper + a themed junk/quest item ("Blue Bud Nug").

Keep it to a kill or collect + turn-in. That's a complete, screenshot-able loop.

---

## Cosmetic (fast-follow, uses existing `skins.ts` system)

A **Beaver skin / tint**, galaxy-blue chroma. Honor-system claim in v1; Discord-tier or holder-tier gated later. Mark the gate hook `// BEAVER-PHASE3`.

---

## How this feeds later phases

- **Cosmetic skins:** each character = a potential future skin/title.
- **Co-branded event:** a weekend "Haze Rush" kill-count leaderboard in the Beaver zone, tied to Wren's broadcast (their real Monday show).
- **Holder rewards:** Beaver cosmetic/title via the engine's existing `holder_tier`/`discord_tier`, config, not new code.
