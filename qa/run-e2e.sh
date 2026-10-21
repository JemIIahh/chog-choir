#!/bin/sh
# fresh local chain + the dev server, then the whole flow in a real browser. Stops only what it started.
cd "$(dirname "$0")"
node make-hum.mjs >/dev/null
R=$(./local-chain.sh) || exit 1
set -- $R
echo "nft=$1 choir=$2 token=$3"
STARTED=""
if ! curl -s -o /dev/null -m 2 http://127.0.0.1:5188/; then
  (cd ../web && exec ./node_modules/.bin/vite --host 127.0.0.1 > ../qa/.vite.log 2>&1) &
  echo $! > .vite.pid
  STARTED=1
  for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -s -o /dev/null -m 2 http://127.0.0.1:5188/ && break; sleep 1; done
fi
node e2e.mjs "$1" "$2" "$3"
CODE=$?
[ -n "$STARTED" ] && [ -f .vite.pid ] && kill "$(cat .vite.pid)" 2>/dev/null; rm -f .vite.pid
[ -f .anvil.pid ] && kill "$(cat .anvil.pid)" 2>/dev/null; rm -f .anvil.pid
exit $CODE
