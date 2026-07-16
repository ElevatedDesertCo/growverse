#!/usr/bin/env bash
# Devnet rehearsal mint for $GROW (see docs/growverse/GROW_MINT_RUNBOOK.md).
#
# Creates a throwaway devnet mint authority, mints the full 1,000,000,000 GROW
# test supply to it, and (optionally) sends some to your own browser wallet so
# you can test the in-game holder tiers. Prints the .env.local lines to point
# your local game server at the new mint.
#
# Usage:
#   scripts/grow_mint_devnet.sh [YOUR_BROWSER_WALLET_ADDRESS]
#
# Env knobs:
#   GROW_REVOKE_AUTHORITIES=1  also revoke the mint authority afterwards, for a
#                              full mainnet-fidelity rehearsal (default: keep it
#                              so you can mint more test tokens later).
#   GROW_TEST_TRANSFER=250000  how many GROW to send to the wallet address arg.
#
# This script NEVER touches mainnet: the RPC URL is hardcoded to devnet and all
# keys live under ~/.config/growverse/devnet/, clearly separated from anything
# real. Do not reuse these keypairs on mainnet.
set -euo pipefail

DEVNET_URL="https://api.devnet.solana.com"
DECIMALS=9
SUPPLY=1000000000
TEST_TRANSFER="${GROW_TEST_TRANSFER:-250000}"
DEST_WALLET="${1:-}"

DIR="$HOME/.config/growverse/devnet"
KP="$DIR/grow-devnet-authority.json"
CFG="$DIR/solana-config.yml"
mkdir -p "$DIR"

for bin in solana solana-keygen spl-token; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "ERROR: '$bin' not found. Install the Solana CLI suite first:" >&2
    echo "  sh -c \"\$(curl -sSfL https://release.anza.xyz/stable/install)\"" >&2
    echo "then restart your shell and re-run this script." >&2
    exit 1
  fi
done

if [ ! -f "$KP" ]; then
  echo "==> Creating devnet mint-authority keypair at $KP"
  solana-keygen new --no-bip39-passphrase --silent -o "$KP"
fi

# Scoped config file so we never mutate your global solana config.
solana -C "$CFG" config set --url "$DEVNET_URL" --keypair "$KP" >/dev/null
AUTHORITY=$(solana-keygen pubkey "$KP")
echo "==> Devnet authority: $AUTHORITY"

BALANCE=$(solana -C "$CFG" balance | awk '{print $1}')
if awk -v b="$BALANCE" 'BEGIN{exit !(b+0 < 0.5)}'; then
  echo "==> Airdropping devnet SOL (faucet can be flaky; retrying up to 5 times)"
  for i in 1 2 3 4 5; do
    if solana -C "$CFG" airdrop 2 >/dev/null 2>&1; then break; fi
    echo "    airdrop attempt $i failed, retrying in 5s"
    sleep 5
  done
  BALANCE=$(solana -C "$CFG" balance | awk '{print $1}')
  if awk -v b="$BALANCE" 'BEGIN{exit !(b+0 < 0.5)}'; then
    echo "ERROR: airdrop failed. Fund $AUTHORITY manually at https://faucet.solana.com (devnet) and re-run." >&2
    exit 1
  fi
fi

echo "==> Creating the GROW test mint (decimals: $DECIMALS, no freeze authority)"
CREATE_OUT=$(spl-token -C "$CFG" create-token --decimals "$DECIMALS")
MINT=$(printf '%s\n' "$CREATE_OUT" | { grep -m1 'Creating token' || true; } | awk '{print $3}')
if [ -z "$MINT" ]; then
  echo "ERROR: could not parse mint address from spl-token output:" >&2
  printf '%s\n' "$CREATE_OUT" >&2
  exit 1
fi
echo "==> Mint: $MINT"

echo "==> Minting the full supply ($SUPPLY GROW) to the authority"
spl-token -C "$CFG" create-account "$MINT" >/dev/null
spl-token -C "$CFG" mint "$MINT" "$SUPPLY" >/dev/null

if [ -n "$DEST_WALLET" ]; then
  echo "==> Sending $TEST_TRANSFER GROW to your wallet $DEST_WALLET"
  spl-token -C "$CFG" transfer "$MINT" "$TEST_TRANSFER" "$DEST_WALLET" \
    --fund-recipient --allow-unfunded-recipient >/dev/null
fi

if [ "${GROW_REVOKE_AUTHORITIES:-0}" = "1" ]; then
  echo "==> Revoking mint authority (mainnet-fidelity rehearsal)"
  spl-token -C "$CFG" authorize "$MINT" mint --disable >/dev/null
fi

cat <<EOF

DONE. Devnet GROW test mint is live.

  Mint address:    $MINT
  Authority:       $AUTHORITY (devnet only, throwaway)
  Supply:          $SUPPLY GROW ($DECIMALS decimals)
$( [ -n "$DEST_WALLET" ] && echo "  Test transfer:   $TEST_TRANSFER GROW -> $DEST_WALLET" )

Point your LOCAL game at it: add to .env.local in the repo root:

  SOLANA_RPC_URL=$DEVNET_URL
  GROW_MINT=$MINT

Then: npm run db:up, npm run server, npm run dev, and link your browser
wallet in-game (switch Phantom to devnet via Settings > Developer Settings
> Testnet Mode first). Full walkthrough: docs/growverse/GROW_MINT_RUNBOOK.md.

To send more test GROW to any wallet later:
  spl-token -C "$CFG" transfer "$MINT" AMOUNT WALLET --fund-recipient --allow-unfunded-recipient
EOF
