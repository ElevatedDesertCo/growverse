# Intentionally retained legacy identifiers

Growverse is a fork of World of ClaudeCraft (see `README.md`, `LICENSE`,
`CREDITS.md`, `THIRD_PARTY_NOTICES.md`). The 2026-07 branding sweep replaced
every player-facing "World of ClaudeCraft" / "$WOC Wallet" label with Growverse
branding. The identifiers below still carry the old name ON PURPOSE: each one is
a compatibility contract with deployed clients, live databases, app stores, or
on-chain assets. Do not rename any of them without the migration noted in its
row. Player-visible text must never surface these identifiers directly.

## Domains and URLs (blocked on a Growverse domain that does not exist yet)

| Identifier | Where | Why retained |
|---|---|---|
| `https://worldofclaudecraft.com` | canonical/hreflang/OG/JSON-LD in `index.html`, `play.html`, `guide.html`, `public/*.html`, `public/robots.txt`, `public/sitemap.xml`, `public/llms.txt`, `src/guide/head.ts`, `src/main.ts` (`SITE_URL`), `scripts/build_sitemap.mjs`, `scripts/seo_audit.mjs`, `.env.example`, `bot/config.ts` | It is the live production origin. There is no Growverse domain in the repo or DNS evidence of one. Cutting over is a coordinated migration (DNS, TLS, redirects, sitemap resubmission, OAuth callback URLs, native attestation origins, Electron update feed), not a rename. |
| `https://updates.worldofclaudecraft.com/desktop` | `package.json` `build.publish.url` | Every installed desktop build polls this feed. The old feed must keep serving (or redirect) or shipped installs never see another update. |
| `worldofclaudecraft://desktop-login` | `package.json` `build.protocols`, `electron/main.cjs`, `src/main.ts` | OS-registered deep-link protocol of installed desktop builds; the web login flow redirects to it. Add `growverse://` alongside in a future release rather than swapping. |
| `app://worldofclaudecraft` | `electron/main.cjs` (`APP_ORIGIN`), allowed in `server/web_login_guard.ts` | The packaged shell's serving origin. Changing it wipes desktop users' origin-scoped storage (session, settings) and breaks CORS for already-shipped builds. The server allowlist now accepts both this and `app://growverse`. |
| `public/8229a69237564e43bae74c07bff2ac88.txt` | domain-verification token | Presumed host/search-console verification for the live domain; delete only when the old domain is retired. |

## Mobile and desktop application identity

| Identifier | Where | Why retained |
|---|---|---|
| `com.worldofclaudecraft` (Android applicationId, namespace, java package, `package_name`, `custom_url_scheme`) | `android/app/build.gradle`, `android/app/src/**`, `android/.../strings.xml` | Changing a Play Store applicationId makes it a different app; existing installs stop updating. Display name (`app_name`) is now Growverse. |
| `com.worldofclaudecraft` (iOS `PRODUCT_BUNDLE_IDENTIFIER`) | `ios/App/App.xcodeproj/project.pbxproj` | Same App Store rule; `CFBundleDisplayName` is now Growverse. |
| `com.worldofclaudecraft` (Capacitor `appId`) | `capacitor.config.ts` | Must equal the native store ids above (`appName` is Growverse). |
| `com.worldofclaudecraft` attestation defaults | `docker-compose.yml`, `.env.example` (`GOOGLE_PLAY_INTEGRITY_PACKAGE_NAME`, `APPLE_BUNDLE_ID`), legacy GCP project number `865860061593` | Server-side attestation must match the ids the shipped apps really use. NOTE: `server/native_attestation.ts` defaults to `com.elevateddesertco.growverse`; production env vars must pin whichever id the store build actually ships with. |

## Client-side persisted keys (renaming = silent player data loss)

`localStorage` keys written by shipped clients: `woc_session` (login token),
`woc_settings`, `woc_keybinds` (+ per-character variants), `woc_seed`,
`woc_last_realm`, `woc_cached_stats`, `woc_perf_overlay`, `woc_chat_tabs`,
`woc_chat_active_tab`, `woc_chat_geometry`, `woc_ignored_chat_names`,
`woc_homepage_music_muted`, `woc_discord_choice`, `woc_site_visitor_id`,
`woc_music_editor_theme`, `wocc.charSort`, `woc_hotbar_*`, `woc_emote_wheel_*`,
`woc_fishing_intro_*`. Renaming any of these logs players out or resets their
local preferences unless a read-old-write-new migration ships first. The DOM
event `woc:languagechange`, the `window.__woc*` debug globals, and the
`.woc-balance`/`.woc-coin`/`--woc-*` CSS names are internal identifiers kept for
the same low-churn reason (never rendered as text).

## Wire contracts between shipped clients, the server, and sibling services

| Identifier | Where | Why retained |
|---|---|---|
| `GET /api/woc/balance` | `server/main.ts`, `server/woc_balance.ts`, `src/net/wallet.ts` | Deployed web/desktop/native clients fetch this literal path. Rename only with an alias window. |
| postMessage sources `woc-github` / `woc-discord` | `server/github.ts`, `server/discord.ts`, `src/main.ts` | Server-rendered popup HTML talks to whatever client bundle the player has; renaming skews old clients. |
| Headers `x-woc-deploy-secret`, `x-woc-discord-secret`, `x-woc-daily-reward-secret` | `server/internal.ts`, `server/daily_rewards.ts`, `bot/server_client.ts` | Cross-process contracts with deploy tooling, the Discord bot, and the external payout service; they do not deploy atomically with this repo. |
| Env vars `WOC_MINT`, `WOC_DAILY_REWARD_SERVICE_URL/SECRET/CONFIG_TTL_MS`, `EASTBROOK_MEDIA_DIR`, `EASTBROOK_IMAGE_TAG` | server, compose, `.env.example` | Set in live host `.env` files; renaming breaks running deployments until ops migrate. Dev-only `WOC_*` script vars kept with them for consistency. |
| DB column `daily_reward_days.woc_usd_price` (+ JSON field `wocUsdPrice`) | `server/db.ts`, `server/daily_rewards*.ts` | Live schema and a field name shared with the external payout service. |
| Advisory-lock constant `0x57_4f_43_01` ("WOC") | `server/db.ts` | All realm processes must lock the same key during rolling deploys. |
| `eastbrook` (Docker services/volumes, Postgres user/db, `/opt/eastbrook`, backups) | `docker-compose.yml`, `DEPLOY.md`, `deploy/` | Pre-fork ops codename. Renaming volumes/users orphans the production database. (The in-world zone id `eastbrook_vale` is game content, not branding.) |
| MediaWiki internals: `/opt/woc` paths, `woc-mediawiki-entrypoint`, `woc-mediawiki.css`, `woc-loading-screen.jpg`, `.woc-seed-hash` marker, `woc-*` CSS classes, dev-only `$wgSecretKey` fallback string | `mediawiki/` | Container-internal names shipped as one image (safe but pointless to churn); the seed-hash marker and secret fallback are stateful on running wikis. Player-visible wiki branding (sitename, hero, logo) is now Growverse. |
| `WoC Initiate` ... `WoC Mythic` Discord role names | `bot/logic.ts`, `bot/main.ts` | The bot resolves live guild roles BY NAME. Renaming requires renaming the roles in the production guild in the same step (then update `tests/discord_bot.test.ts`). Flagged for Andy. |
| Realm name `Claudemoon` | `server/realm.ts` default, `characters.realm` rows, client copy (`Champion of Claudemoon` title, maintenance page) | The live realm's proper name; every existing character/guild/friend row is keyed to it. Renaming the realm is a data migration plus a product decision, like renaming a WoW server. |
| `$WOC` / `WOC` token references | wallet + daily-rewards UI strings, `server/woc_balance.ts`, `WOC_MINT` | $WOC is a real third-party SPL token (mint `3WjLsc...UicRth`) that holder flair and daily rewards genuinely read. References to the token by its ticker are accurate, not legacy branding; only the "$WOC Wallet" BRAND label was replaced with "Growverse Wallet". |
| `wocDesktop` extraMetadata key, `WOC_DISTRIBUTION`/`WOC_CRASH_SUBMIT_URL`/`WOC_OPEN_DEVTOOLS` build env vars | `scripts/electron-builder-config.mjs`, `electron/desktop_config.cjs`, CI | Writer and reader ship together but CI/host env sets the vars; rename in lockstep with CI config later if desired. |
| `python/wow_env.py` / `WoWClassicEnv` | `python/` | Public-ish RL API module/class names; renaming breaks downstream imports (docstrings now say Growverse). |

## Historical and legal content left unchanged (not identifiers)

- `LICENSE` (MIT, Copyright (c) 2026 Levy Street), `License.txt` (KayKit CC0),
  `CREDITS.md`, `THIRD_PARTY_NOTICES.md`: required attribution.
- `README.md` fork acknowledgement (kept, reworded for clarity).
- `PRIVACY_POLICY.md`, `TERMS_AND_CONDITIONS.md`, `public/privacy.html`,
  `public/terms.html`: legal documents naming the original operator (Dream Home
  AI Limited, trading as Levy Street) and the old domain. Replacing the legal
  entity and contractual scope is a legal task for the owner, not a
  find-and-replace; untouched and flagged.
- `docs/prd/woc/*`, `docs/release-notes/*`, `ELECTRON-DESKTOP-AUDIT.md`,
  `docs/beavers/*`, wiki Community Lore / Sources pages: historical documents
  about the World of ClaudeCraft era; kept as history.
- `docs/i18n/README.*.md` / `CONTRIBUTING.*.md`: translated snapshots; the
  brand proper noun and repo links were swapped mechanically, full re-translation
  happens at the next release-tier localization batch.

## Needs an owner decision (see the branding-sweep report)

- Public contact email `woc@levystreet.com` (press/support/legal pages).
- Instagram/TikTok handles `@worldofclaudecraft`; Discord invite
  `discord.gg/KSTJkrCq3`; GitHub Sponsors link `github.com/sponsors/levy-street`.
- `public/World-of-Growverse-Whitepaper-v1.0.pdf` filename and contents.
- Realm name `Claudemoon`, Discord role prefix `WoC`, and the eventual
  Growverse domain cutover (which unlocks the whole Domains table above).
