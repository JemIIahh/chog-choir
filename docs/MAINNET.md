# Mainnet runbook

Everything here was rehearsed first: the deploy script, the contract and the page, against the **real** Chog Genesis and the **real** $CHOG on a local fork of Monad mainnet (`qa/fork-rehearsal.mjs`, `qa/mainnet-fork-ui.mjs`), and the whole product on real Monad testnet (`MODE=testnet node qa/e2e.mjs`). Nothing is sent to mainnet until you run the commands below. The contract is immutable once deployed.

## What you need to provide

- A decision on **round length**. Recommended: **one day** (`EPOCH_SECONDS=86400`): rounds turn over at 00:00 UTC, a streak means "I came back tomorrow", and a judge who looks in on a different day sees a different round.
- **A wallet to deploy from, with about 1 MON on Monad mainnet.** The deploying wallet has **no special powers afterwards**: the contract has no owner and no admin functions, so it only needs to pay the gas once. Three ways, safest first:

| | How | Where the key lives |
|---|---|---|
| **1. Fund the prepared wallet** | Send about 1 MON (mainnet, chain 143) to `0x7a79011b2998D04cDF5b72c19155C37CF9Ff9D43`. Claude runs the deploy. | A fresh key generated on this machine (`contracts/.env.mainnet`, git-ignored). Your own wallet's key never leaves it. |
| **2. Deploy from your own wallet, in your own Terminal** | Below. | Your key goes into an encrypted keystore on your machine (you type it at a hidden prompt), and is never in a file, a chat or an environment variable. |
| **3. Hardware wallet** | Same command as 2 with `--ledger` (or `--trezor`) instead of `--account chog-main`. | On the device. |

Never paste a private key into a chat or a script.

## Deploy

**Option 2 (and 3), in your own Terminal:**

```sh
cast wallet import chog-main --interactive     # paste your private key once at the hidden prompt, then choose a password

cd ~/Desktop/chog-choir/contracts
NFT=0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763 \
TOKEN=0x350035555E10d9AfAF1566AaebfCeD5BA6C27777 \
EPOCH_SECONDS=86400 \
forge script script/Deploy.s.sol --rpc-url https://rpc.monad.xyz --account chog-main --broadcast
```

It asks for the keystore password, prints the new `CHOIR` address, and that address is all that is needed afterwards. (`contracts/.env.testnet` holds only the throwaway *testnet* key and is deliberately not named `.env`, so forge never loads it by accident.)

**Option 1** is the same script with the prepared key (`DEPLOYER_PRIVATE_KEY` from `contracts/.env.mainnet`).

The script **refuses** on chain 143 unless `NFT` and `TOKEN` are exactly those two addresses and `EPOCH_SECONDS` is set. Both signing paths were rehearsed on a fork of mainnet against the real collection and token: the intended wallet's nonce goes up by one, and the choir reads back the real NFT, the real $CHOG and 86400.

## After deploying

1. Put it in `web/src/chain/deployments.json` under `"143"`:
   ```json
   "143": { "choir": "0x…", "nft": "0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763", "token": "0x350035555E10d9AfAF1566AaebfCeD5BA6C27777", "encorePrice": "1000000000000000000000", "epochSeconds": 86400 }
   ```
   (no `faucet` field: that is what makes the page behave as the real-collection experience).
2. Read it back: `cast call <CHOIR> "chogToken()(address)" --rpc-url https://rpc.monad.xyz` must print the real $CHOG, `chog()` the real collection, `epochSeconds()` 86400, `encorePrice()` 1000e18, and `startTime() % 86400` must be 0.
3. `cd web && pnpm build && node ../qa/smoke-prod.mjs`, then redeploy the app (`cd web && vercel deploy --prod`; the project is already linked) and run `node qa/smoke-prod.mjs https://chog-choir.vercel.app/`. Switch the page to "Real Chogs on Monad" and check the round loads.
4. Verify the source on the explorer so judges can read it.
5. Sing with a real Chog yourself and take one encore, so the first real activity is yours and you see the burn on the explorer.
6. Update `SUBMISSION.md` (uncomment the **[MAINNET]** lines) and the README deployments table.

## Do not

- Do **not** seed the mainnet choir with notes that are not from real holders. The testnet seeding is labelled as the builder's; on mainnet an honest empty choir is better than a staged one. The "What if more Chogs sing?" slider is there so a quiet round still shows what the band becomes.
- Do **not** reuse the testnet deployer key for mainnet.
