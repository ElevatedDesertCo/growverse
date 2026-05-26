# Portal Awakening — Opening Cinematic Script

> **Type**: cinematic intro (no forced player actions). Plays automatically
> on first launch. Skippable at any time via persistent "Skip" button.
> Replayable from **Settings → Watch Intro**. On completion, sets
> `tutorialComplete: true` in the save and grants the player **10 Bloom Essence**.
>
> **Companion doc**: `docs/growverse-gdd-v2.md` (Canon, characters, resources).
> **Implementation**: scene data is exported from
> `lib/cinematic.ts` and consumed by `components/game/OpeningCinematic.tsx`.
> To edit the script, just edit this file — the scene array mirrors it
> 1:1 and I'll sync them in the same commit.

## Tone reference (from canon)

> "Great. You touched the glowing desert tumor. Now reality has trust issues."
> — Solace

> "That portal opened because of you? That's terrifying. Mostly because you
> look like you lose arguments with soup."
> — Raiin

Lines below are written to match: comedic, irreverent, modern, with the
fantasy-stakes played straight underneath.

---

## Scene list

7 scenes. Each is one tap-to-advance card with: a backdrop, optional
speaker portrait, optional speaker name, body text. Skip button always
present.

### Scene 1 — The Desert Wakes

- **Backdrop**: cosmic desert (use existing splash bg).
- **Speaker**: narrator (no portrait).
- **Body**:
  > The desert was supposed to be empty.
  >
  > That was the deal, you'd been told. Walk three days east. Don't ask
  > about the lights on the horizon. Don't touch the glowing things. Come
  > home alive.
  >
  > You'd already broken rule three.

### Scene 2 — The Glowing Thing

- **Backdrop**: cosmic desert with a portal/crystal element highlighted (purple portal area of the splash).
- **Speaker**: narrator.
- **Body**:
  > It hummed. Crystal, maybe. Or amber. Or a tooth.
  >
  > You reached out before your brain could file a complaint.

### Scene 3 — Reality, Briefly

- **Backdrop**: portal opens, purple/green energy.
- **Speaker**: **Solace** (first appearance — a small floating vine/cannabis-leaf spirit).
- **Body**:
  > "Great. You touched the glowing desert tumor. Now reality has trust
  > issues."
  >
  > The voice came from a hovering cluster of leaves and gold. It blinked
  > at you with three pollen-yellow eyes and looked exactly as patient
  > as someone watching their landlord burn down their building.

### Scene 4 — Introductions, Sort Of

- **Backdrop**: portal energy fades, dust settles.
- **Speaker**: **Solace**.
- **Body**:
  > "Solace. I'm Solace. I'm your spirit companion now, apparently. The
  > Cores pick who they pick."
  >
  > A faint pulse rose from beneath the dust at your feet — slow, like
  > something waking up that wished it hadn't.
  >
  > "Oh good," said Solace. "That's your Guild Core. It's broken. Welcome
  > to your problem."

### Scene 5 — Bloom Energy, Corruption, and Math

- **Backdrop**: damaged Guild Core silhouette, Bloom Essence (green leaf bottle icon) shimmering.
- **Speaker**: **Solace**.
- **Body**:
  > "This place used to run on Bloom Energy. Sacred Grow. Spirit lines.
  > Whole vibe."
  >
  > "Then the Corruption came through a portal a lot like that one." A
  > leaf-finger jabs at the still-glowing crack behind you. "And now
  > Bloom comes in fragments. Essence, we call it. You're going to be
  > collecting a lot of it."
  >
  > "Welcome to the Growers, Anderz. We do not get weekends."

### Scene 6 — Eris, Off-Stage

- **Backdrop**: shadowy figure silhouette in distant portal, briefly.
- **Speaker**: narrator.
- **Body**:
  > Far away, somewhere the portal didn't fully close, something
  > **noticed**.
  >
  > Eris turned her head. She'd been weaving for a long time. A new
  > thread had just appeared in the pattern, and it was the wrong color.
  >
  > She smiled. Threads can be cut.

### Scene 7 — Your Move

- **Backdrop**: dawn over the damaged Guild Core, game UI visible underneath at low opacity.
- **Speaker**: **Solace**.
- **Body**:
  > "Alright. Step one: don't die. Step two: repair the Core. Step
  > three: build things. Step four through eleven, we'll get to."
  >
  > A small icon shimmers in your pocket — **10 Bloom Essence**, your
  > starting allotment from the Core.
  >
  > "Tap to begin."

→ Cinematic ends. Player drops into the Guild Base View with their normal
starting resources **plus 10 Bloom Essence**, and the new tutorialComplete
flag set so this never auto-plays again.

---

## Skip / Replay

- **Skip button**: top-right corner of every scene. Tap → cinematic ends
  immediately. Player still gets the +10 Bloom Essence grant (so skipping
  doesn't punish them) and `tutorialComplete: true` is set.
- **Replay**: Settings → "Watch Intro" → plays scenes 1–7 again with no
  resource grant (already received) and no `tutorialComplete` change.

## Future hooks

- **Scene 6 (Eris off-stage)** is the seed for the antagonist arc that
  unlocks in later story chapters (sprint 10+).
- **Solace's "Anderz"** address establishes the player-character identity
  for future Grower Roster / dialogue work.
- The "Step four through eleven, we'll get to" line is a nod to the
  13-step main loop — explicit setup for the eventual full tutorial arc
  that will live inside Story Chapter View (screen 10).

Version 1.0 — locked.
