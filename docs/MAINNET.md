# Mainnet runbook

Everything here was rehearsed first: the deploy script, the contract and the page, against the **real** Chog Genesis and the **real** $CHOG on a local fork of Monad mainnet (`qa/fork-rehearsal.mjs`, `qa/mainnet-fork-ui.mjs`), and the whole product on real Monad testnet (`MODE=testnet node qa/e2e.mjs`). Nothing is sent to mainnet until you run the commands below. The contract is immutable once deployed.

## What you need to provide

- A **fresh deployer wallet** with about **1 MON** on Monad mainnet (the deploy costs a fraction of that). Use a new key, not one that holds anything else.
- A decision on **round length**. Recommended: **one day** (`EPOCH_SECONDS=86400`): rounds turn over at 00:00 UTC, a streak means "I came back tomorrow", and a judge who looks in on a different day sees a different round. A shorter round (e.g. 6 hours) makes the choir feel more alive but is harder to keep full.

## Deploy

```sh
cd contracts
export DEPLOYER_PRIVATE_KEY=0x…        # the fresh wallet; never commit it
export NFT=0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763     # real Chog Genesis
export TOKEN=0x350035555E10d9AfAF1566AaebfCeD5BA6C27777   # real $CHOG
export EPOCH_SECONDS=86400
forge script script/Deploy.s.sol --rpc-url https://rpc.monad.xyz --broadcast
```

The script **refuses** on chain 143 unless `NFT` and `TOKEN` are exactly those two addresses and `EPOCH_SECONDS` is set. It prints the new `CHOIR` address.

## After deploying

1. Put it in `web/src/chain/deployments.json` under `"143"`:
   ```json
   "143": { "choir": "0x…", "nft": "0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763", "token": "0x350035555E10d9AfAF1566AaebfCeD5BA6C27777", "encorePrice": "1000000000000000000000", "epochSeconds": 86400 }
   ```
   (no `faucet` field: that is what makes the page behave as the real-collection experience).
2. Read it back: `cast call <CHOIR> "chogToken()(address)" --rpc-url https://rpc.monad.xyz` must print the real $CHOG, `chog()` the real collection, `epochSeconds()` 86400, `encorePrice()` 1000e18, and `startTime() % 86400` must be 0.
3. `cd web && pnpm build && node ../qa/smoke-prod.mjs`, then switch the page to "Real Chogs on Monad" and check the round loads.
4. Verify the source on the explorer so judges can read it.
5. Sing with a real Chog yourself and take one encore, so the first real activity is yours and you see the burn on the explorer.
6. Update `SUBMISSION.md` (uncomment the **[MAINNET]** lines) and the README deployments table.

## Do not

- Do **not** seed the mainnet choir with notes that are not from real holders. The testnet seeding is labelled as the builder's; on mainnet an honest empty choir is better than a staged one. The "What if more Chogs sing?" slider is there so a quiet round still shows what the band becomes.
- Do **not** reuse the testnet deployer key for mainnet.
