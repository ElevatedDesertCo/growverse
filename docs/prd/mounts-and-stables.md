# Mounts and Stables, v1 (with the $GROW exclusive)

Status: approved plan, implementation in progress
Owner: andy@elevateddesertco.com
Branch: `claude/mount-system-stable-xrvpsk`

## Executive summary

World of ClaudeCraft gets a classic-style mount system: at level 20 a player can
buy a mount from a stable vendor, summon it out of combat for a +60% ground speed
boost, and is dismounted by damage, combat, swimming, or death. A new stable
vendor NPC (Stablemaster Marla) sells three copper-priced mounts and one
exclusive mount, the Verdant Bloomstrider, priced in $GROW, a new premium
currency backed by a server-side ledger. $GROW is the in-game representation of
the upcoming $GROW crypto token; v1 ships the permanent spend/entitlement rails
(Postgres ledger, admin credit tooling, server-authoritative spend) with zero
blockchain code in this repo. A future token bridge credits the same ledger.

## Decisions locked in (from the design interview)

1. Mount role: speed plus visual. +60% ground speed, dismount on damage or
   entering combat. No mounted combat, no flying, single speed tier in v1.
2. Acquisition: stable vendor purchase gated on character level 20.
3. $GROW v1: server-side ledger only. Balances are credited by operators via the
   admin dashboard (and later by a token bridge); spending happens in game at the
   stable. No wallet linking, no RPC, no on-chain code in this repo.
4. Roster: three copper mounts plus the one $GROW exclusive.
5. Exclusive identity: distinct theme, name, and lore (below), not extra speed.
   Graphics-fairness invariant: the exclusive is cosmetic prestige only.

## The v1 roster

No horse model exists in the repo, and render visuals are GLB-loaded, so the
roster rides existing creature models (`public/models/creatures/`):

| Mount | Model | Price | Notes |
|---|---|---|---|
| Highfield Alpaca | `alpaca.glb` | copper (tuned to economy) | starter flavor |
| Ironhide Bull | `bull.glb` | copper | sturdy look |
| Thornback Boar | `wild_boar.glb` | copper | scrappy look |
| Verdant Bloomstrider | `stag.glb` + verdant treatment | $GROW | the exclusive |

### Verdant Bloomstrider lore

A stag-like mount grown, not born: bark-and-moss body, antlers that flower as it
runs, petal-burst hoofsteps. Seeded by the first druids from a coin of living
amber. "A grown thing, never tamed." Render treatment: green/emissive tint over
the stag model plus a leaf/petal speed-FX layer (reusing the travel-form
speed-FX pattern).

## Architecture

### Why $GROW can never live in the sim

The deterministic sim runs identically offline, online, and headless. An
external token balance is non-deterministic outside data, so the source of truth
is a Postgres ledger on the authoritative server. The sim only ever sees a
plain `growCoins` number on `PlayerMeta` (synced from the ledger on login and
after credits) and the resulting entitlement (`ownedMounts`). Offline worlds
simply have a zero balance (dev commands can grant for testing).

### Sim core (src/sim/)

- New content: `src/sim/content/mounts.ts` with `MountDef` records
  (id, itemId, speed bonus 0.6, requiredLevel 20, visual key, exclusive flag),
  merged into a `MOUNTS` table via `data.ts`.
- Mounts are sold as items (classic style): new `ItemKind` `'mount'` with
  `use: { type: 'learnMount', mountId }`. Buying uses the existing
  server-authoritative vendor flow; using the item consumes it and adds the
  mount to `PlayerMeta.ownedMounts` (a `Set<string>`, persisted in the JSONB
  `CharacterState` like `unlockedMilestones`; no SQL migration needed).
- Premium pricing: `BaseItemDef.growPrice?: number`. `buyItem` branches: a
  grow-priced item checks and decrements `meta.growCoins` instead of copper and
  emits a purchase event the server settles against the ledger.
- Active mount: new system module `src/sim/mounts.ts` behind the `SimContext`
  seam (summon, dismiss, auto-dismount rules). Summoning requires ownership,
  level 20, alive, out of combat, not swimming. It sets `Entity.mountId` and a
  `'mounted'` aura (value 1.6); `moveSpeedMult` folds it exactly like
  `form_travel`. Damage taken, entering combat, swimming, and death dismount.
- Commands: `summon_mount`, `dismount` added to `COMMAND_NAMES`, with
  `server/game.ts` cases (pinned by `tests/command_schema.test.ts`).
- All new player-visible sim emits get matching entries in
  `src/ui/sim_i18n.ts` (S3 guard).

### IWorld seam (src/world_api/)

New `IWorldMounts` facet: `growCoins`, `ownedMounts`, `activeMountId`,
`summonMount(id)`, `dismount()`. Implemented in BOTH `Sim` and `ClientWorld`.
Wire: per-entity terse key for `mountId` (all visible players need it for
render), self-frame keys for `growCoins` and `ownedMounts` (mirroring the
copper plumbing in `server/game.ts` and `src/net/online.ts`), registered in
`tests/snapshots.test.ts`.

### $GROW ledger (server/)

- `accounts.grow_balance` column plus a `grow_ledger` table
  (account, delta, reason, actor, created_at), added with the repo's idempotent
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` migration pattern.
- Credit: admin dashboard tool plus `POST /admin/api/grow/credit`
  (account, amount, reason); writes the ledger, updates the balance, live-syncs
  `meta.growCoins` for online characters.
- Spend: on the sim's grow-purchase event the server settles atomically
  (`UPDATE ... SET grow_balance = grow_balance - $1 WHERE grow_balance >= $1`
  plus a ledger row); on a failed settle it resyncs the in-sim balance.
- The balance is account-scoped (all characters share it), matching how a
  future token deposit bridge will credit it.

### Render (src/render/)

Rider-on-mount: when `Entity.mountId` is set the renderer builds the mount's
`CharacterVisual` (same lazy pattern as the druid travel form's second visual),
plays its gallop/idle clips from movement, and seats the player visual on top.
The Bloomstrider gets the verdant tint and a leaf/petal speed-FX layer.

### UI (src/ui/)

- Vendor window: mount rows show the copper price via the existing path; a
  grow-priced row shows the $GROW price (new formatter + icon), with the
  player's balance visible. Pure-core changes land in `vendor_view.ts`.
- New Mounts window: `mounts_view.ts` (pure core, in `UI_PURE_CORES`) plus
  `mounts_window.ts` painter: owned mounts list, summon/dismiss.
- Every new string is an English `t()` key in the i18n catalog (contributor
  adds English only). Wiki: `npm run wiki:content` plus `guide.*` prose keys.

### Stable

Stablemaster Marla, a vendor NPC in the starting town (zone1), `vendorItems`
listing the four mount items, with a stable-flavored greeting. Paddock props
and a riding-lessons quest are follow-ups, not v1.

## Fairness, safety, invariants

- Determinism: no new rng draws; no wall-clock; fixed-tick only.
- `src/sim/` stays DOM-free and import-clean (architecture guard).
- Graphics tiers cannot hide mounts in a way that hides actionable info
  (mounts are cosmetic plus speed; speed is server-authoritative).
- The exclusive confers no gameplay advantage over copper mounts.
- No secrets, no `ALLOW_DEV_COMMANDS` in production; grow credits are
  admin-authenticated and ledgered with actor attribution.

## Test plan

- `tests/mounts.test.ts`: gate (level, ownership, combat, swim), summon speed
  multiplier, auto-dismount on damage/combat, copper purchase, grow purchase
  (balance decrement, insufficient funds), persistence round-trip.
- Existing guards: `architecture`, `command_schema`, `snapshots`,
  `localization_fixes` (S3), full `npm test`, `npm run build`.
- QA gate (`/qa`) over the final diff before push.

## Phases

1. Sim core: types, content, mounts module, commands, persistence.
2. Wire and IWorld: server snapshot, ClientWorld mirror, schema tests.
3. $GROW ledger: DB migration, settle/credit, admin dashboard tool.
4. Render: rider-on-mount visuals, Bloomstrider treatment and FX.
5. UI: vendor grow pricing, Mounts window, i18n, wiki content.
6. QA and ship: tests, /qa, push to `claude/mount-system-stable-xrvpsk`.

## Follow-ups (explicitly out of v1)

- Riding Lessons quest and jump course at the stable (the teaser video).
- Epic +100% tier, mounted-only zones, mount drops from bosses.
- $GROW token bridge (wallet link, deposits), account-wide mount collections
  UI, additional $GROW sinks (exclusive gear, quests).
