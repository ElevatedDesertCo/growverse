# Asset Checklist — Phase 2

> Status legend:
> - **final** — approved final art, in-game now.
> - **generated** — stand-in (e.g. cropped from concept sheet, AI-generated, library reuse). Functional but should be replaced with proper canon art before launch.
> - **placeholder** — no file exists; `<AssetImage>` renders a styled fallback card. Drop a file at the listed path + flip status in `lib/data/assetManifest.ts` to make it live.
>
> All paths are public (under `/`). Canonical home for NEW assets is `public/assets/{images,audio,animations}/<category>/<id>.<ext>`. Existing v1.1 assets stay at their current paths until a migration pass.
>
> **Single source of truth**: `lib/data/assetManifest.ts`. This doc mirrors it; if the two ever disagree, the manifest wins.

---

## Buildings — 17 entries

Recommended source size: **512×512 PNG with transparency**, artwork centered, ~10% padding on each side for game grid composition.

| Building | Filename | Folder | Type | Status | Notes |
|---|---|---|---|---|---|
| Guild Core | grow-tent.png ✗ (placeholder using soul-altar-sheet) | /buildings-library/ | PNG triptych | **generated** | NEEDS isolated PNG — central foundation building, 3×3 footprint |
| Bloom Extractor | bloom-extractor.png | /buildings/ | PNG transparent | **final** | — |
| Storage Vault | amber-vault-sheet.png (placeholder) | /buildings-library/ | PNG triptych | **generated** | NEEDS isolated PNG |
| Training Grounds | training-grounds-sheet.png | /buildings-library/ | PNG triptych | **generated** | NEEDS isolated PNG, 3×2 footprint |
| Spirit Nursery | seed-reliquary-sheet.png | /buildings-library/ | PNG triptych | **generated** | NEEDS isolated PNG |
| Portal Gate | obsidian-antichamber-sheet.png | /buildings-library/ | PNG triptych | **generated** | NEEDS isolated PNG with portal glow |
| Relic Workshop | bloom-reservoir-sheet.png | /buildings-library/ | PNG triptych | **generated** | NEEDS isolated PNG (Brazzle's workshop) |
| Defense Totem | outpost-beacon-sheet.png | /defenses-library/ | PNG triptych | **generated** | NEEDS isolated PNG |
| Vine Wall | root-barrier-sheet.png | /defenses-library/ | PNG triptych | **generated** | NEEDS isolated PNG, 2×1 footprint |
| Spore Trap | snare-totem-sheet.png | /defenses-library/ | PNG triptych | **generated** | NEEDS isolated PNG (Spores guild) |
| Flame Totem | doobie-cannon-sheet.png | /defenses-library/ | PNG triptych | **generated** | NEEDS isolated PNG (Ember guild) |
| Water Channel | spirit-shrine.png (wrong theme) | /buildings-library/ | PNG | **generated** | NEEDS proper water-themed PNG (Water guild) |
| Root Wall | root-barrier-sheet.png | /defenses-library/ | PNG triptych | **generated** | NEEDS isolated PNG (Thorn guild) |
| Myco Extractor | myco-reliquary-sheet.png | /buildings-library/ | PNG triptych | **generated** | NEEDS isolated PNG (Spores guild) |
| Grow Tent (legacy) | grow-tent.png | /buildings/ | PNG transparent | **final** | Kept for v1.1 saves; not in P2 BuildMenu |
| Amber Forge (legacy) | amber-forge.png | /buildings/ | PNG transparent | **final** | Kept for v1.1 saves |
| Thorn Trap (legacy) | thorn-trap.png | /buildings/ | PNG transparent | **final** | Kept for v1.1 saves |

## Resources — 8 entries

Recommended source size: **128×128 PNG** with transparency, icon-style.

| Resource | Filename | Folder | Type | Status | Notes |
|---|---|---|---|---|---|
| Bloom Essence | leaf.png | /icons/ | PNG | **final** | Cropped from resource-icons-set sprite sheet |
| Amber Shards | fire.png | /icons/ | PNG | **final** | Cropped from resource-icons-set |
| Myco Dust | mushroom.png | /icons/ | PNG | **final** | Cropped from resource-icons-set |
| Relic Fragments | relic-fragments.png | /assets/images/resources/ | PNG | **placeholder** | Stone/glyph fragment icon |
| Spirit Seeds | spirit-seeds.png | /assets/images/resources/ | PNG | **placeholder** | Glowing seed pod icon |
| Portal Energy | portal-energy.png | /assets/images/resources/ | PNG | **placeholder** | Purple swirl / vortex icon |
| Guild XP | guild-xp.png | /assets/images/resources/ | PNG | **placeholder** | Heraldic crest / star icon |
| Card Shards | card-shards.png | /assets/images/resources/ | PNG | **placeholder** | Iridescent crystal-card shard icon |

## Guild badges — 6 entries

Recommended size: **256×256 PNG with transparency**, heraldic / shield silhouette.

| Guild | Filename | Folder | Status |
|---|---|---|---|
| Bloomveil | bloomveil.png | /assets/images/guild-icons/ | **placeholder** |
| Ember | ember.png | /assets/images/guild-icons/ | **placeholder** |
| Water | water.png | /assets/images/guild-icons/ | **placeholder** |
| Spores | spores.png | /assets/images/guild-icons/ | **placeholder** |
| Roots/Thorn | thorn.png | /assets/images/guild-icons/ | **placeholder** |
| Dustroot Archive | dustroot.png | /assets/images/guild-icons/ | **placeholder** |

## Characters — 16 entries

Recommended size: **512×768 PNG portrait** with transparency, head-to-waist crop, neutral pose, faces camera, transparent background.

| Character | Filename | Folder | Status | Notes |
|---|---|---|---|---|
| Anderz | anderz.png | /assets/images/characters/ | **placeholder** | Protagonist. Look TBD by player customization later. |
| Solace | solace.png | /assets/images/characters/ | **placeholder** | Vine/spirit/cannabis-plant hybrid (NOT a fox). Three pollen-yellow eyes. |
| Raiin | raiin.png | /assets/images/characters/ | **placeholder** | Rival → co-Grower → romantic interest |
| Davis | davis.png | /assets/images/characters/ | **placeholder** | Tall, skinny side character |
| Elyra | elyra.png | /assets/images/characters/ | **placeholder** | Bloomveil Guild Leader — verdant, regal |
| Ashira | ashira.png | /assets/images/characters/ | **placeholder** | Ember Guild Leader, "the Blaze Binder" — heat-warped armor |
| Myco | myco.png | /assets/images/characters/ | **placeholder** | Spores Guild Leader — mushroom-mantled |
| Zira | zira.png | /assets/images/characters/ | **placeholder** | Thorn Guild Leader — bark-armored, vine-bound |
| Athir | athir.png | /assets/images/characters/ | **placeholder** | Dustwarden — map-cloaked, weathered |
| Elder Thorn | elder-thorn.png | /assets/images/characters/ | **placeholder** | Mythic mentor (a.k.a. Master Thorn) |
| Art | art.png | /assets/images/characters/ | **placeholder** | — |
| Brazzle | brazzle.png | /assets/images/characters/ | **placeholder** | Larger, light-skinned, bearded relic forager |
| Nicole | nicole.png | /assets/images/characters/ | **placeholder** | Tech Wizard — long hair, Mexican-toned skin, flower tattoos, laptop |
| Armando | armando.png | /assets/images/characters/ | **placeholder** | Heavyset, baseball cap + jersey, jeans, relic necklace, bat |
| Carlito | carlito.png | /assets/images/characters/ | **placeholder** | Information broker |
| Eris | eris.png | /assets/images/characters/ | **placeholder** | Primary antagonist — Corrupted Spirit Weaver |

## Spirit Pets — 7 entries

Recommended size: **512×512 PNG with transparency**, full-body, on transparent ground or with mystical aura.

| Pet | Filename | Folder | Status | Notes |
|---|---|---|---|---|
| Solace | solace.png | /assets/images/spirit-pets/ | **placeholder** | Anderz's companion — floating vine/cannabis-leaf cluster |
| Vyrra | vyrra.png | /assets/images/spirit-pets/ | **placeholder** | Raiin's — sinuous water dragon with crystalline scales |
| Fumez | fumez.png | /assets/images/spirit-pets/ | **placeholder** | Davis's — glowing blue ghost fox, translucent |
| Wingus | wingus.png | /assets/images/spirit-pets/ | **placeholder** | Art's — hawk spirit, wind-marked plumage |
| Berle | berle.png | /assets/images/spirit-pets/ | **placeholder** | Brazzle's — mysterious beetle, iridescent carapace |
| Ashira's Fire-Fox | ashira-firefox.png | /assets/images/spirit-pets/ | **placeholder** | Smoldering paws, crowned flame |
| Armando's Wolf | armando-wolf.png | /assets/images/spirit-pets/ | **placeholder** | Dark canine with green glowing markings |

## Backgrounds — 2 entries

| Asset | Filename | Folder | Type | Status | Notes |
|---|---|---|---|---|---|
| Splash | growverse-splash.png | /brand/ | PNG (1672×941) | **final** | Cosmic desert scene with wordmark |
| Base ambient | base-ambient.png | /assets/images/backgrounds/ | PNG (≥1920×1080, looping-tileable on horizontal) | **placeholder** | Soft cosmic desert backdrop, low contrast (sits behind the grid) |

## UI assets (already in repo, sitting in `/ui/`)

13 frame / button / panel pieces from the asset library. All `generated` — usable as-is for Phase 2 (none currently displayed in components, reserved for later card / panel polish work).

## VFX — 8 entries

| VFX | Filename | Folder | Type | Status | Notes |
|---|---|---|---|---|---|
| Ember Strike (P1) | ember-strike-sheet.png | /effects/ | PNG sheet | **generated** | — |
| Water Burst (P1) | water-burst-sheet.png | /effects/ | PNG sheet | **generated** | — |
| Dust Hit (P1) | dust-hit-sheet.png | /effects/ | PNG sheet | **generated** | — |
| Spells Set (P1) | spells-set.png | /effects/ | PNG sheet | **generated** | — |
| Effects Set (P1) | effects-set.png | /effects/ | PNG sheet | **generated** | — |
| Collect Burst | collect-burst.png | /assets/images/vfx/ | PNG particle | **placeholder** | Currently rendered via CSS dots — drop a sprite to replace |
| Placement Dust | placement-dust.png | /assets/images/vfx/ | PNG particle | **placeholder** | Currently CSS gradient — drop a sprite to replace |
| Upgrade Glow | upgrade-glow.png | /assets/images/vfx/ | PNG sprite | **placeholder** | Currently CSS radial gradient — drop a sprite to replace |

## Action Icons (5 entries)

Recommended format: **PNG with transparent background**, square (1:1), ≥256×256, ≤120KB each. Painted style to match the v2 art reference (warm gold trim + magical inner glow).

| Icon | Filename | Folder | Status | Used by | Reference |
|---|---|---|---|---|---|
| Build | build.png | /assets/images/ui/actions/ | **placeholder** | BottomNav Build button | Greenhouse cabinet w/ glowing bloom + green gem cap |
| Upgrade | upgrade.png | /assets/images/ui/actions/ | **placeholder** | UpgradeModal CTA, level-up badge | Greenhouse + gold upward arrow |
| Move | move.png | /assets/images/ui/actions/ | **placeholder** | Edit-mode handle on placed buildings | Shears + trowel on purple aura |
| Collect | collect.png | /assets/images/ui/actions/ | **placeholder** | Ready-to-collect badge on growing buildings | Bloom plant w/ resin droplet |
| Timer / Progress | timer.png | /assets/images/ui/actions/ | **placeholder** | Grow-progress ring | Hourglass w/ amethyst cap + amber shards |

Manifest refs: `ui.actionBuild`, `ui.actionUpgrade`, `ui.actionMove`, `ui.actionCollect`, `ui.actionTimer`.

## Audio — SFX (8 entries — all live)

All currently wired. Sourced from the Kenney UI Audio pack (CC0,
https://kenney.nl/assets/ui-audio); converted to mono 128 kbps MP3 via
ffmpeg. See `public/assets/audio/sfx/CREDITS.txt` for per-file mapping.

| SFX | Filename | Folder | Status | Trigger |
|---|---|---|---|---|
| Button Click | button-click.mp3 | /assets/audio/sfx/ | **final** | Build / Edit / Place / Upgrade / Settings / modal buttons |
| Resource Collect | resource-collect.mp3 | /assets/audio/sfx/ | **final** | Tap a ready Grow Tent or Bloom Extractor / Amber Forge with pending |
| Build Placed | build-placed.mp3 | /assets/audio/sfx/ | **final** | New building lands on the grid |
| Upgrade Complete | upgrade-complete.mp3 | /assets/audio/sfx/ | **final** | Any building's level increases · daily reward claim · milestone hit · save import |
| Locked / Error | locked.mp3 | /assets/audio/sfx/ | **final** | Tap a locked or unaffordable Build card · save import error · arm-but-not-confirm delete |
| Decor — Leaf | decor-leaf.mp3 | /assets/audio/sfx/ | **final** | Clear a cactus or dead shrub |
| Decor — Stone | decor-stone.mp3 | /assets/audio/sfx/ | **final** | Clear a rubble pile |
| Decor — Metal | decor-metal.mp3 | /assets/audio/sfx/ | **final** | Clear a relic debris or old lantern |

## Audio — Music (1 entry — live)

| Track | Filename | Folder | Status | Notes |
|---|---|---|---|---|
| Base Ambient | base-ambient.mp3 | /assets/audio/music/ | **final** | "Desert Theme" by yd on OpenGameArt (CC0). 1:38 stereo MP3 loop. Auto-starts on first user interaction, fades in 1.2s, pauses on tab background, mute/volume in Settings. See `CREDITS.txt`. |

## Audio — Voice

Empty. Reserved for character voice lines when the cinematic + dialogue systems land (Phase 3+). Suggested format: WAV → MP3 conversion, per-character folders.

## Animations

Empty. Reserved for spritesheets / atlases / Rive / Spine when richer motion ships.

---

## Migration notes

- The recommended canonical home for ALL new assets is `public/assets/{category}/<id>.<ext>`. Legacy v1.1 assets stay at their current paths (`/icons/`, `/buildings/`, `/brand/`, `/defenses-library/`, etc.) until a separate cleanup pass.
- To swap a placeholder for a real asset:
  1. Drop the file at the path listed in this checklist.
  2. Flip the entry's `status` in `lib/data/assetManifest.ts` from `"placeholder"` to `"final"` (or `"generated"` for AI/stand-in art).
  3. Refresh — `<AssetImage>` will start rendering the real file instead of the styled fallback. No component edits required.
- To move an existing generated asset to its canonical home:
  1. Move the file (e.g. `git mv public/buildings-library/soul-altar.png public/assets/images/buildings/guild-core.png`).
  2. Update only that entry's `path` in `assetManifest.ts`.
  3. Components don't change — they just go to the new path automatically.
