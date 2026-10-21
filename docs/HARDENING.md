# Hardening log

What was checked before any mainnet deployment, what was wrong, what was done. Kept honest: each line says how it was verified.

## Found and fixed

| # | Finding | Fix | Verified by |
|---|---|---|---|
| 1 | The deploy script could silently wire the **real** Chog Genesis to the **free faucet token** (set `NFT` but forget `TOKEN`), or deploy a free copy of the collection as the gate. Both are permanent once deployed. | On Monad mainnet the script refuses unless `NFT` and `TOKEN` are the real contracts and `EPOCH_SECONDS` was set on purpose. The choir's constructor also refuses addresses that are not contracts. | Five wrong and right combinations run against a mainnet fork (each wrong one reverts with its own message); `test_constructorNeedsRealContracts`. |
| 2 | The encore "burn" was a transfer to `0x…dEaD`. The real $CHOG has `burn()` and the community already uses it (total supply is below 1B), so supply never moved. | The choir pulls the tokens in and calls `burn()`. `totalBurned` counts it and the app shows it. | Fork rehearsal against the real $CHOG: supply drops by exactly 1,000, the holder paid exactly 1,000, the choir holds none. Unit tests include a token that refuses and a token whose burn reverts (nothing is recorded). |
| 3 | Anyone with many Chogs signs once per Chog, every round. The biggest holder has 73. | `placeMany`: several Chogs in one transaction, all or nothing. The app's "Sing with all" splits into batches of 25 and picks each Chog's note from its own phrase. | Fork rehearsal: 72 real Chogs in one transaction, 4.2M gas (58k each). Unit tests: ownership, repeats, shape, range, streaks. e2e: three Chogs, one transaction. |
| 4 | The encore approval was unlimited (2²⁵⁶−1), which looks bad in a wallet. | Approve exactly one encore's price. | e2e: allowance is 0 after the encore. |
| 5 | The app landed on mainnet as soon as it was deployed, where a judge without a Chog sees an empty choir. | Lands on the free testnet choir unless `?net=` or their last choice says otherwise; holders of real Chogs get a one-tap switch. | `defaultNet` and the e2e (which loads without any network preference). |
| 6 | One public RPC. A rate limit would blank the app. | Reads fall over across three public endpoints per network. The "every seat" call is split into chunks of 400 because a single 1,969-seat call is heavy on Monad's gas pricing and some RPCs cap `eth_call`. | Endpoints probed for chain id; e2e. |
| 7 | An out-of-gas message told mainnet users to find a testnet faucet. | Message depends on the network. | Code review. |
| 8 | Rounds started at the moment of deployment, so "ends in 3:12:00" meant nothing and a daily round turned over at a random hour. | Rounds start on multiples of their length (a one-day round turns over at 00:00 UTC). | `test_roundsStartOnMultiplesOfTheirLength`; fork rehearsal; e2e. |
| 9 | **Found by testing with the biggest real holder (73 Chogs):** "Your Chogs" showed 73 Chogs as five stacks of squashed, overlapping thumbnails, so individual Chogs could not be seen or picked. | The grid's rows were collapsing; `grid-auto-rows: min-content` fixes it, and a holder of more than 10 gets a taller scrolling list. | `qa/mainnet-fork-ui.mjs` and a before/after measurement (scroll height 246px → 1000px for 73 thumbnails). |
| 10 | **Found by the same test:** tapping an already-occupied cell on the staff did nothing, so an encore (or a note) could not be placed on a crowded beat even though notes stack. | An occupied cell now selects like an empty one. | `qa/mainnet-fork-ui.mjs`. |
| 11 | While in "what if more Chogs sing?" the page header counted the stand-in voices as real. | The header shows the real number plus "(+ preview)". | `qa/e2e.mjs`. |
| 12 | The QA scripts killed processes by pattern (`pkill -f`), which can hit other sessions' processes. | They only stop the processes they started, by pid file. | Code review. |

## Testing done, and what each one proves

| Test | Against | Proves |
|---|---|---|
| `forge test` (38 + vectors) | the contract | rules, edge cases, a refusing token, a token whose burn reverts |
| `pnpm test` (66) | the code | audio, pitch detection, hummed tunes, duets, batching, wallet switching, error messages, network choice |
| `qa/e2e.mjs` (local) | fresh anvil chain, real browser | the whole product, including hum with a fake microphone |
| `MODE=testnet qa/e2e.mjs` | **real Monad testnet** | the same flow with real signed transactions and real waits for rounds to end (passed) |
| `qa/fork-rehearsal.mjs` | mainnet fork, **real Chog Genesis and $CHOG** | deploy script, 72-Chog batch (4.2M gas), real burn, seal |
| `qa/mainnet-fork-ui.mjs` | same fork, real browser | a real 73-Chog holder: finds them, sings them in 3 batches, takes an encore with real $CHOG |
| `qa/smoke-prod.mjs` | production build, **real testnet**, no overrides | loads as a judge sees it, ignores dev-only link parameters, talks only to Monad RPCs and Google Fonts, fits a phone |

## Checked and fine

- Only a Chog's owner can place or encore it; a stranger's transaction reverts (unit test and fork rehearsal against the real collection).
- Token ids on the real collection run 1 to 1969; `ownerOf(0)` and `ownerOf(1970)` revert, as the app assumes.
- Reading who owns what takes one call (2.6 s on the public RPC).
- The real $CHOG is a clone of an implementation with `transferFrom`, `burn` and `permit` and no owner, pause, blacklist or mint. A real transfer moved exactly the price (no fee).
- No secrets in the repository or its history; the deployer key is in a gitignored `.env`.
- Sealing is permissionless and bounded: at most 1,969 Chogs, one note and one encore each, so a round is at most 3,938 notes.

## Known limits (not fixed on purpose)

- The encore price is immutable. At about $0.001 per $CHOG it is about $1; about a quarter of holders have enough today.
- The band meter counts distinct *Chogs*, not distinct wallets. One wallet with 25 Chogs can unlock the bass.
- A Chog held in a marketplace escrow or a vault cannot sing until it is back in the owner's wallet.
- I cannot listen. Pitch, formants and loudness are measured offline; how the hum feature and the band *feel* is for a human ear.

## How to re-run it all

```sh
cd contracts && forge test
cd ../web && pnpm test && npx tsc --noEmit
cd ../qa && ./run-e2e.sh                 # local chain, real browser
node fork-rehearsal.mjs                  # mainnet rehearsal on a fork, real collection and token
MODE=testnet EPOCH=300 node e2e.mjs <nft> <choir> <token>   # real testnet
```
