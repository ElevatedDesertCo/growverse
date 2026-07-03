<div align="center">

# Growverse

**Quest, group up, and raid a hand-built world, free in your browser.**

A project by Elevated Desert Co.

</div>

## What this is

Growverse is a classic-style browser MMO built on one deterministic TypeScript simulation core that runs in three places:

- the **offline browser world** — click Play Offline and you are in,
- the **authoritative multiplayer server** — Postgres-backed accounts sharing a live world,
- the **headless RL env** — Python drives the real game through a Gym interface.

Nine classes with talents, three open-world zones, ~80 quests, five instanced dungeons, ranked PvP arena, real multiplayer, and procedurally generated everything — towns, creatures, icons, and sound are all generated at runtime.

## Quick start

### Play offline in your browser

```bash
npm install
npm run dev        # then open http://localhost:5173 and click Play Offline
```

### Run the full multiplayer stack

```bash
npm run db:up      # Postgres 16 in Docker (dev DB on :5433)
npm run server     # authoritative game server on :8787
npm run dev        # client on :5173 (proxies /api and /ws to the server)
```

See `DEPLOY.md` for production hosting and `CLAUDE.md` for the architecture guide.

## Repo map

| Path | What it is |
|---|---|
| `src/sim/` | Deterministic game core — the source of truth |
| `src/render/` | Three.js renderer (procedural geometry/textures/VFX) |
| `src/game/` | Input, camera, keybinds, mobile controls, WebAudio |
| `src/ui/` | HUD, windows, tooltips, map, i18n (21 locales) |
| `src/net/` | Online client (REST auth + WebSocket world mirror) |
| `server/` | Authoritative game server (HTTP+WS, Postgres, auth) |
| `headless/` + `python/` | RL env server + Python Gym bindings |
| `docs/` | Design docs, including the original Growverse GDD |

## Credits and license

Growverse is a fork of [World of ClaudeCraft](https://github.com/levy-street/world-of-claudecraft) by levy-street, used under the MIT License. See `LICENSE`, `CREDITS.md`, and `THIRD_PARTY_NOTICES.md` for full attribution.

MIT licensed.
