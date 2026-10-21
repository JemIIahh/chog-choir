#!/bin/sh
# fresh local chain, then the whole flow in a real browser
cd "$(dirname "$0")"
R=$(./local-chain.sh)
set -- $R
echo "nft=$1 choir=$2 token=$3"
node e2e.mjs "$1" "$2" "$3"
