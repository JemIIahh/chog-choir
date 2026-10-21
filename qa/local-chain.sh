#!/bin/sh
# Fresh local chain for the end-to-end test: anvil + Multicall3 (copied from Monad) + the three contracts.
# prints: NFT CHOIR TOKEN
# Only ever stops the anvil it started itself (pid in qa/.anvil.pid), never anything else on the machine.
set -e
cd "$(dirname "$0")"
PIDFILE=.anvil.pid
if [ -f "$PIDFILE" ]; then kill "$(cat "$PIDFILE")" 2>/dev/null || true; rm -f "$PIDFILE"; sleep 1; fi
anvil --port 8545 --block-time 1 > .anvil.log 2>&1 &
echo $! > "$PIDFILE"
sleep 2
M=0xcA11bde05977b3631167028862bE2a173976CA11
CODE=$(curl -s -m 20 -X POST https://rpc.monad.xyz -H 'content-type: application/json' -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getCode\",\"params\":[\"$M\",\"latest\"]}" | python3 -I -c "import sys,json;print(json.load(sys.stdin)['result'])")
cast rpc anvil_setCode $M "$CODE" --rpc-url http://127.0.0.1:8545 >/dev/null
K0=$(awk '/Private Keys/{f=1} f&&/^\(0\)/{print $2; exit}' .anvil.log)
cd ../contracts
OUT=$(DEPLOYER_PRIVATE_KEY=$K0 EPOCH_SECONDS=3600 forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast 2>&1)
NFT=$(echo "$OUT" | awk '/^ +NFT /{print $2}')
CHOIR=$(echo "$OUT" | awk '/^ +CHOIR /{print $2}')
TOKEN=$(echo "$OUT" | awk '/^ +TOKEN /{print $2}')
sleep 3
echo "$NFT $CHOIR $TOKEN"
