# $GROW mint runbook

Companion to `docs/growverse/GROW_COIN.md` (the locked design). This is the
operational, step-by-step path from nothing to a live token: devnet rehearsal
first, then the real mainnet launch. Everything here runs on YOUR machine with
YOUR wallets; no key, seed phrase, or keypair file ever enters this repo, its
env files beyond the public mint address, or the game server.

## 0. Prerequisites (once)

1. Install the Solana CLI suite (includes `solana`, `solana-keygen`, `spl-token`):

   ```sh
   sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
   ```

   Restart your shell, then verify: `solana --version && spl-token --version`.
2. A browser wallet (Phantom or any injected Solana wallet) on the machine you
   will test the game in. This is the wallet you link in-game; it is separate
   from the mint authority the script creates.
3. For the local game: Docker (for `npm run db:up`) and the usual
   `npm install` done.

## 1. Devnet rehearsal (do this now)

Devnet is a free playground chain: fake SOL from a faucet, same programs and
tooling as mainnet. The rehearsal proves the whole pipeline, mint plus game,
before real money exists.

1. Get your browser wallet's address: open Phantom, copy the account address.
   Also switch Phantom to devnet: Settings > Developer Settings > Testnet Mode.
2. Mint the test token and fund your wallet in one step:

   ```sh
   scripts/grow_mint_devnet.sh YOUR_PHANTOM_ADDRESS
   ```

   The script creates a throwaway devnet authority under
   `~/.config/growverse/devnet/`, mints 1,000,000,000 test GROW, sends 250,000
   to your wallet (enough for the Cultivator rank, rung 6), and prints the two
   env lines you need. It never touches your global solana config or mainnet.
3. Point the local game at the mint. In `.env.local` at the repo root:

   ```sh
   SOLANA_RPC_URL=https://api.devnet.solana.com
   GROW_MINT=THE_MINT_ADDRESS_THE_SCRIPT_PRINTED
   ```

4. Run the game locally:

   ```sh
   npm run db:up      # Postgres 16 in Docker (once per boot)
   npm run server     # authoritative server on :8787
   npm run dev        # client on :5173
   ```

5. In the game (http://localhost:5173): create an account, open the wallet UI,
   connect your browser wallet, and complete the sign-to-link verification.
   Your GROW balance and Cultivation Rank badge should appear within the
   balance cache window (up to 2 minutes for the broadcast badge; the player
   card refreshes on open).
6. Play with thresholds: transfer yourself more or less test GROW and watch the
   rank change:

   ```sh
   spl-token -C ~/.config/growverse/devnet/solana-config.yml \
     transfer MINT_ADDRESS 1000000 YOUR_PHANTOM_ADDRESS --fund-recipient
   ```

Optional full-fidelity pass: re-run the script with
`GROW_REVOKE_AUTHORITIES=1` on a fresh mint to rehearse the authority revoke
that mainnet requires.

## 2. Mainnet launch (only after the rehearsal is green)

Do not rush this section. Each step is cheap to do slowly and expensive to
redo. Budget roughly 0.1 SOL for fees plus whatever you seed as liquidity.

### 2.1 Wallets and custody first

1. Create the four bucket destinations per the allocation plan
   (GROW_COIN.md section 3): rewards, liquidity, treasury, team.
   Rewards/liquidity/treasury should be Squads multisigs (https://squads.so)
   with hardware-wallet signers; the team bucket goes into a Streamflow
   (https://streamflow.finance) vesting contract, 3-month cliff, 12-month
   linear.
2. Create a FRESH mint-authority keypair, used exactly once, on a clean
   machine: `solana-keygen new -o grow-mainnet-authority.json`. Fund it with
   ~0.1 SOL. Do not reuse the NFT-project wallet or the devnet keypair.

### 2.2 Token metadata assets

1. Logo: 512x512 PNG (plus the source SVG kept in `scripts/brand/` if we
   generate one procedurally).
2. Metadata JSON (name, symbol, description, image URI) per the spec in
   GROW_COIN.md section 2.
3. Upload both to permanent storage (Arweave via https://irys.xyz, or
   Metaplex's upload tooling). Record the final JSON URI.

### 2.3 Mint

With the authority keypair active and `-u mainnet-beta`:

```sh
# 1. Create the mint: 9 decimals, NO freeze authority (the CLI default).
spl-token create-token --decimals 9
# note the mint address: GROW_MINT

# 2. Attach Metaplex metadata (name: Growverse Coin, symbol: GROW, the JSON
#    URI from 2.2). Use metaboss (https://metaboss.dev):
metaboss create metadata --mint GROW_MINT --metadata metadata.json
#    then mark it immutable once verified:
metaboss set immutable --mint GROW_MINT

# 3. Mint the allocations straight to the bucket wallets.
spl-token create-account GROW_MINT
spl-token mint GROW_MINT 400000000 REWARDS_MULTISIG_TOKEN_ACCOUNT
spl-token mint GROW_MINT 250000000 LIQUIDITY_MULTISIG_TOKEN_ACCOUNT
spl-token mint GROW_MINT 200000000 TREASURY_MULTISIG_TOKEN_ACCOUNT
spl-token mint GROW_MINT 150000000 TEAM_VESTING_FUNDING_ACCOUNT

# 4. THE POINT OF NO RETURN: fix the supply forever.
spl-token authorize GROW_MINT mint --disable

# 5. Retire the authority keypair (it now controls nothing, but hygiene).
```

Use `spl-token transfer ... --fund-recipient` variants if a bucket needs its
associated token account created; verify every bucket balance on
https://solscan.io before step 4.

### 2.4 After the mint

1. Fund the Streamflow vesting contract from the team bucket; publish the
   contract link.
2. Publish all bucket addresses (website, Discord, the repo README section for
   $GROW) so spend is auditable.
3. Set `GROW_MINT` (and a dedicated `SOLANA_RPC_URL`, e.g. Helius) on the
   production server env; deploy the integration release.
4. Liquidity is a separate, deliberate decision: when ready, seed the pool
   from the liquidity multisig (Raydium or Meteora), then lock or burn the LP
   position and publish the transaction.
5. Marketing posture: utility only. Re-read GROW_COIN.md section 10 before the
   announcement post.

## 3. Verification checklist

- [ ] Devnet: script ran clean, game showed balance and rank for a linked wallet
- [ ] Devnet: rank changed after a test transfer (within cache TTL)
- [ ] Devnet: `GROW_REVOKE_AUTHORITIES=1` rehearsal done once
- [ ] Mainnet: four bucket balances verified on Solscan BEFORE revoking
- [ ] Mainnet: mint authority shows `null` on Solscan after revoke
- [ ] Mainnet: freeze authority shows `null` (was never set)
- [ ] Mainnet: metadata renders (name/symbol/logo) in Phantom and Solscan
- [ ] Team vesting contract live and published
- [ ] Production `GROW_MINT` set; a real linked wallet shows its rank in-game
