# Growverse — Guild Wars

A desert-fantasy guild base-builder. Awaken your Guild Core in a corrupted
desert, clear the land for resources, place buildings on a 16×16 grid,
upgrade your way through tiers, and grow your realm.

🌵 **Play it now:** https://growverse-iota.vercel.app

## Current state — Phase 2 (Portal Awakening)

Core base-building loop:

- **8 buildings live** on a Guild Core unlock track (Core L1 → L4)
- **8 canonical resources** with cap-aware storage (Bloom / Amber / Myco / Relic / Spirit Seeds / Portal / Guild XP / Card Shards)
- **Clearable desert decor** — cactus / shrub / rocks / relic / lantern scatter the map; tap to harvest the mapped resource, regrows every ~10 min
- **Daily reward** with consecutive-day streak (🔥 N-day badge in the HUD)
- **Achievements** — 12 milestones with progress tracking
- **Lifetime stats** persisted independently of game saves
- **Save export / import** with snapshot preview
- **PWA-ready** — manifest, service worker, mobile-friendly

Polish features:

- Painted resource bar with hover tooltips (description / earned-from / used-for / this-session)
- Bottom nav with active-tab glow + Coming Soon modal for upcoming features
- Build menu with category tabs + locked-card ribbons
- Edit mode with delete-for-30%-refund + hint banner
- Camera shake on placement, animated selection halo, drag-preview shimmer
- Welcome modal for first-run players, Daily Bounty popup
- Music bed (CC0 Desert Theme) with auto-fade-in + tab-pause
- 8 SFX (CC0 Kenney UI Audio) including 3 decor-clear variants
- Idle firefly particles for ambient life

Keyboard shortcuts (desktop):

- `B` — Build menu
- `E` — Edit mode
- `Esc` — close panel / exit edit

## Stack

- [Next.js 16](https://nextjs.org) App Router, TypeScript
- [Tailwind v4](https://tailwindcss.com)
- [Zustand](https://github.com/pmndrs/zustand) with persist middleware
- [Framer Motion](https://www.framer.com/motion/)
- [Lucide React](https://lucide.dev)
- Deployed to [Vercel](https://vercel.com) (auto from GitHub)

## Development

```bash
npm install
npm run dev   # localhost:4200
```

Other scripts:

```bash
npm run lint     # ESLint
npm run build    # Production build
```

## Architecture

```
app/                  Next.js App Router entrypoints
components/game/      All gameplay UI (single tree, no per-feature dirs)
lib/
├── buildings.ts      8 BuildingDef definitions + grid constants
├── store.ts          Zustand game state slice (persist v3)
├── economy.ts        Cost ramps + time-aware helpers
├── data/             Typed game data (resources, chapters, characters…)
└── systems/          Pure-helper systems (toast, music, audio, stats…)
public/
├── assets/audio/     CC0 SFX + music (see CREDITS.txt)
├── buildings*/       Painted building art
├── decor/            Decor reference sheets (cropped via mask-image)
└── terrain/          Desert ground / grid / foundation tile set
docs/
├── growverse-gdd-v2.md           Game design document
├── growverse-phase-1-build-plan.md
├── portal-awakening-cinematic.md
└── AssetChecklist.md             Source of truth for what art lives where
```

The asset manifest at `lib/data/assetManifest.ts` is the single source of
truth for every asset path + status. `<AssetImage>` reads from it and
renders a styled placeholder fallback whenever a file is missing — the
game never shows broken images.

## Credits

- **Music:** [Desert Theme](https://opengameart.org/content/desert-theme) by yd (CC0)
- **SFX:** [UI Audio](https://kenney.nl/assets/ui-audio) by Kenney (CC0)

Game art, story, and direction are original to Growverse.

## License

Game code: All rights reserved by Elevated Desert Co.
Third-party assets retain their original CC0 licenses (see
`public/assets/audio/sfx/CREDITS.txt` and
`public/assets/audio/music/CREDITS.txt`).
