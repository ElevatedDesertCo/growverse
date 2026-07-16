# $GROW: the Growverse Coin (PRD + Tokenomics)

> **STATUS: APPROVED DESIGN, PRE-MINT.** Decisions in this doc were locked with the
> project owner on 2026-07-16. The token does not exist on-chain yet. Nothing in the
> codebase changes behavior until the integration phase (section 8) lands and the
> `GROW`/`WOC` mint env var points at the real mint address.

| | |
|---|---|
| **Owner** | Andy Heidrick (Elevated Desert Co) |
| **Tier** | 0 - Foundations (builds on the shipped wallet-link PRD, `docs/prd/woc/wallet-link.md`) |
| **Chain** | Solana mainnet-beta (devnet rehearsal first) |
| **Reg posture** | Utility/cosmetic-only, hold-to-unlock, non-custodial. See section 9. |

## 1. One-line pitch

$GROW is the Growverse's on-chain coin: holding it in a linked wallet unlocks
cosmetic VIP status in the game (badges, exclusive skins, holder quests, early
access), and it will later power the accessory store. It never grants combat power,
and the game server never touches player funds.

## 2. Token specification

| Field | Value | Notes |
|---|---|---|
| Name | Growverse Coin | Metaplex token metadata `name` |
| Symbol | GROW | Metadata `symbol`; render as $GROW in copy |
| Standard | SPL Token (classic program) | Not Token-2022: no transfer hooks or fees wanted, and classic SPL has the widest wallet/DEX support |
| Total supply | 1,000,000,000 (fixed) | Matches the existing 18-rung holder-tier ladder math (`src/sim/holder_tier.ts`), which is percent-of-1B based |
| Decimals | 9 | SPL default; 1B * 10^9 raw units fits u64 comfortably |
| Mint authority | **Revoked after initial mint** | Fixed supply forever; the single strongest credibility signal |
| Freeze authority | **Revoked at creation** | No one can freeze holder accounts; expected by DEXes and screeners |
| Metadata | Metaplex Token Metadata (immutable after launch) | Name, symbol, logo URI, description; host logo/JSON on permanent storage (Arweave/Irys or shadow-drive) |
| Metadata description | "The coin of the Growverse. Holding $GROW unlocks cosmetic VIP perks in the Growverse MMO. No gameplay power. growverse game by Elevated Desert Co." | Keep utility-framed, no price/profit language |

## 3. Allocation (the "Balanced" plan, locked)

| Bucket | % | Amount | Wallet | Policy |
|---|---|---|---|---|
| Community and player rewards | 40% | 400,000,000 | Dedicated rewards wallet (multisig) | Funds quest events, airdrops to verified players, creator bounties, seasonal events. Published wallet address so spend is publicly auditable. Target emission: multi-year, never more than ~5% of supply per quarter. |
| Liquidity | 25% | 250,000,000 | Liquidity ops wallet (multisig) | Seeds the initial Raydium/Meteora pool(s). LP position locked or burned after seeding (burn is the stronger signal; decide at pool creation). Unused liquidity reserve stays in the multisig. |
| Project treasury | 20% | 200,000,000 | Treasury multisig | Development, marketing, partnerships (e.g. Baked Beavers collab), exchange/aggregator listings. 6-month timelock on 75% of it is recommended. |
| Team | 15% | 150,000,000 | Vesting contract (Streamflow or similar) | 3-month cliff, then linear vest over 12 months. On-chain vesting, publicly verifiable. |

Wallet hygiene (non-negotiable):
- **Fresh keypairs for every bucket.** Do not reuse the existing NFT-project wallet as
  the mint authority or a bucket wallet; it has its own history and blast radius.
- Multisig (Squads is the Solana standard) for rewards, liquidity, and treasury;
  hardware wallet signers.
- The mint-authority keypair is used exactly once (mint + revoke) and then retired.
- **No private key, seed phrase, or keypair file ever enters this repo, its env files,
  or the game server.** The server remains read-only against the chain
  (`server/woc_balance.ts` pattern).

## 4. Economic model: hold-to-unlock (locked)

Perks gate on the **balance of the player's verified linked wallet**, read
server-side over RPC exactly as the $WOC integration does today. Players never send
tokens to the project to use the game, the server never initiates or receives
transfers, and unlinking or selling simply drops the tier.

Why this model (vs spend-to-treasury or burn-to-buy):
- Non-custodial end to end; the game stays a *reader* of the chain.
- No payment processing, refunds, chargebacks, or money-transmission surface.
- Perks are reversible state, which matches the existing holder-tier design.
- A spend/burn store remains possible as a later phase (section 7), gated on legal
  review; nothing in this design forecloses it.

## 5. Holder-tier ladder: the Cultivation Ranks

Same thresholds and mechanics as the shipped ladder in `src/sim/holder_tier.ts`
(rungs 1-8 climb 10x, rungs 9-16 step by whole percents of supply, then 10% and
100%); only the theme changes.

> **IMPLEMENTATION NOTE (shipped):** the machine keys were NOT renamed. The
> legacy upstream keys (`ember`, `coinbearer`, ... `sovereign`) are invisible to
> players but feed CSS hooks, analytics, the i18n catalog keys, and all 20 locale
> overlays, so renaming them is churn with no player-visible gain. The
> cultivation names below shipped as the ENGLISH VALUES of
> `wallet.holderTiers.<legacy-key>.name`/`.flavor`; the table's key column is the
> original design proposal, kept for the name-to-threshold mapping.

| Rung | Key | Threshold ($GROW) | Share | Working name |
|---|---|---|---|---|
| 1 | `seedling` | 1 | - | Seedling |
| 2 | `sprout` | 10 | - | Sprout |
| 3 | `sapling` | 100 | - | Sapling |
| 4 | `gardener` | 1,000 | - | Gardener |
| 5 | `tender` | 10,000 | - | Tender of the Grove |
| 6 | `cultivator` | 100,000 | - | Cultivator |
| 7 | `harvester` | 1,000,000 | - | Harvester |
| 8 | `grovekeeper` | 10,000,000 | 1% | Grovekeeper |
| 9 | `bloomwarden` | 20,000,000 | 2% | Bloomwarden |
| 10 | `verdant` | 30,000,000 | 3% | Verdant |
| 11 | `sunblessed` | 40,000,000 | 4% | Sunblessed |
| 12 | `rootlord` | 50,000,000 | 5% | Rootlord |
| 13 | `wildbloom` | 60,000,000 | 6% | Wildbloom |
| 14 | `evergreen` | 70,000,000 | 7% | Evergreen |
| 15 | `groveshaper` | 80,000,000 | 8% | Groveshaper |
| 16 | `worldtree` | 90,000,000 | 9% | Worldtree |
| 17 | `growmaster` | 100,000,000 | 10% | Growmaster |
| 18 | `sovereign` | 1,000,000,000 | 100% | Sovereign of the Growverse |

Tone guardrail from the Growverse GDD: mystical cultivation, premium, calm.
Not frat-bro stoner. Names, icons, and flair colors follow that register.

## 6. Utility map: launch-day VIP perks (all locked in scope)

Everything below is cosmetic, convenience, or access. **Never combat power, never
actionable-information advantages.** This inherits the wallet-link PRD's
non-negotiable and the repo's graphics-fairness rule of thumb: if it changes an
outcome a player competes over, it is not allowed.

1. **Holder badge + name flair** (mostly shipped, needs rebrand)
   - The existing in-world holder-tier flair broadcast, re-keyed to the Cultivation
     Ranks and the $GROW mint. Tier badge on the player card and nameplate styling.
2. **Exclusive holder skins** (existing systems: `src/sim/content/skins.ts`,
   `world_api/cosmetics.ts`)
   - Armor, weapon, and character *appearance* sets that unlock at tier thresholds,
     e.g. a Cultivator-and-above armor glow set, a Harvester weapon skin line.
   - This is the seed of the accessory store: the store UI later sells access to the
     same cosmetic records.
3. **Holder-only quests** (new content records + a visibility gate)
   - A repeatable VIP quest line from a dedicated questgiver NPC, visible only to
     verified holders at or above a configured rung (proposal: `sprout`, rung 2, so
     entry is cheap and the perk is broad).
   - Rewards: cosmetic items, titles, and normal-economy gold/XP at standard rates
     (the quest is *access*-gated; its rewards must not beat comparable open quests,
     or it becomes pay-for-power through the back door).
4. **Early access + holder event windows**
   - New zones/dungeons open to holders (rung threshold configurable) for a fixed
     window (e.g. 48 hours) before general release; holder-only event nights.
   - Early access must not confer lasting competitive advantage: world-first race
     achievements, leaderboards, and server-first titles pause during holder-early
     windows or are cosmetic-only.

## 7. Accessory store: phased plan

- **Phase A (with launch): tier showcase.** The wardrobe/collections UI marks
  holder-exclusive cosmetics with their required rung; tapping shows "Unlocks at
  Cultivator (100,000 $GROW held)". No transactions.
- **Phase B: hold-to-unlock store.** A dedicated store window listing exclusive
  armor/weapon/character cosmetics; "buying" means meeting the rung and claiming.
  Inventory rotates seasonally to create collectibility without scarcity-for-payment.
- **Phase C (deferred, legal-gated): spend or burn purchases.** True purchases where
  tokens leave the player's wallet (burn preferred over pay-to-treasury). Requires
  counsel review, wallet-transaction UX in the client, and a custody-free flow
  (player signs a burn from their own wallet; server verifies the transaction
  signature on-chain before granting the item). Explicitly out of scope until then.

## 8. Game integration plan (next session's work)

The engine was built for exactly this; integration is mostly renaming and content.

1. **Mint config. (SHIPPED)** `server/woc_balance.ts` reads `GROW_MINT` first,
   with the legacy `WOC_MINT` names as fallbacks. One code path, one mint.
2. **Ladder rebrand. (SHIPPED)** The Cultivation Ranks landed as English
   name/flavor values on the stable legacy keys (see the section 5 note); the
   supply constant is `GROW_MAX_SUPPLY`.
3. **i18n. (SHIPPED for the rebrand)** Rank names and $GROW wallet copy landed as
   English catalog values; the 20 locale overlays keep their existing (now stale)
   translations for the maintainer to refill at release, per the repo workflow.
   Future VIP quest/store strings follow the same rules; the S3 guard applies.
4. **Holder quests.** Content records in `src/sim/content/` plus a server-side
   visibility gate keyed on the account's verified holder rung (the server already
   knows it; the gate is an interest/eligibility check, not sim logic, keeping
   `src/sim/` deterministic and chain-free).
5. **Skins.** New cosmetic records in `skins.ts` with rung requirements enforced
   server-side on equip/claim.
6. **Wiki.** `npm run wiki:content` regen; holder-exclusive content is flagged
   spoiler-safe in the guide.
7. **Tests.** Extend `tests/wallet*.test.ts`, `tests/woc_balance.test.ts` (rename),
   holder-tier unit tests for the new keys, and a fairness test that no holder perk
   grants stats.

Determinism invariant restated: **`src/sim/` never reads the chain.** Wallet, RPC,
and balances stay in `server/` + `src/net/`; the sim only ever sees a resolved tier
index the same way it does today.

## 9. Launch runbook (outline)

Full step-by-step runbook (with exact CLI commands and a verification checklist) is a
separate deliverable; this is the shape:

1. **Devnet rehearsal.** Create keypairs, mint 1B test $GROW, attach metadata, revoke
   authorities, point a dev server's `GROW_MINT` at it, verify wallet-link + tier
   badges end to end with a test wallet.
2. **Asset prep.** Logo (512x512 PNG + SVG), metadata JSON, uploaded to permanent
   storage; token description per section 2.
3. **Mainnet mint.** Fresh mint-authority keypair; create mint (9 decimals, freeze
   authority disabled); create the four bucket token accounts; mint per section 3;
   set immutable metadata; **revoke mint authority; retire the keypair.**
4. **Custody setup.** Squads multisigs for rewards/liquidity/treasury; Streamflow
   vesting for team tokens. Publish all bucket addresses.
5. **Liquidity.** Seed the pool from the liquidity wallet when ready (trading start
   is a deliberate, separate decision from minting); lock or burn LP.
6. **Cutover.** Set `GROW_MINT` on the production server; ship the integration
   release; announce with utility-first framing.

## 10. Legal and communications posture (read before any public post)

Not legal advice; engage a crypto-literate attorney before mainnet liquidity.
The design choices above were made to keep risk low, and marketing can undo that:

- **Never market price, profit, ROI, "early", or "moon."** Describe $GROW only by
  what it does in the game. Profit-expectation marketing is the fastest way to make
  a utility token look like a security (Howey), regardless of the tech.
- **No promises of future value-accruing work** ("we will burn X%, driving price
  up"). Announce features when they ship.
- **Cosmetic-only is also a compliance feature.** Selling power would push toward
  gambling/consumer-protection regimes on top of securities risk. Keep the wallet-link
  PRD's constraint locked.
- **Cannabis adjacency:** the token is a game token, not a cannabis product, but ad
  platforms and app stores treat cannabis-themed crypto conservatively. Mobile-store
  builds (see `docs/mobile-store-release.md`) must not surface token purchase flows
  at all (Apple/Google rules on crypto), and hold-to-unlock perks in mobile builds
  need store-policy review.
- **Terms and privacy:** update `TERMS_AND_CONDITIONS.md` / `PRIVACY_POLICY.md` for
  the token relationship (no custody, perks revocable, wallet data handling) before
  launch.
- **Team tokens vest publicly** (section 3): verifiable on-chain vesting is both the
  credibility story and the paper trail.

## 11. Open questions

- Final English names for a few rungs (Tender of the Grove vs Tender; Verdant as a
  noun) get settled during the i18n pass.
- Which DEX for the seed pool (Raydium CPMM vs Meteora DLMM) and LP lock vs burn.
- Whether the Baked Beavers collab (see `docs/beavers/`) gets a $GROW hook, e.g. a
  Beaver-themed holder skin, once that relationship is formalized.
- Minimum rung for holder quests (`sprout` proposed) and for early-access windows.
- Whether Discord role sync (`src/sim/discord_tier.ts` exists) should mirror
  Cultivation Ranks at launch.
