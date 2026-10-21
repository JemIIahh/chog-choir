# Chog Choir

Every Chog has a voice, and a song. Its real traits decide how it sounds.

Built for Chogathon 2026. Live app: _TBD_ · Demo video: _TBD_ · Contracts: see [Deployments](#deployments).

## What it is

| | |
|---|---|
| **Songs** | Type a Chog's number, hear its song. Each of the 1,969 Chogs has its own key, scale, tempo, band and hook, read from its traits. **Hum a tune** and the Chog sings it back in its own voice and key. **Duet**: add a second Chog and the two sing together. Save it as a clip or poster, or share a link. |
| **Studio** | A staff where every note is a Chog face. Pick a Chog (it sings), tap the staff to place its note, change tempo, space, brightness, key and beat. The whole band lives in the link. |
| **The Choir** | A shared, on-chain choir. One Chog gets one note per round, and only its owner can place it. A loft shows all 1,969 Chogs seated by voice type, lighting up as they sing. The more Chogs have sung, the fuller the band: voices, then a pad, then bass, then drums. A slider asks "what if more Chogs sing?" and plays a preview of a fuller choir (clearly labelled, never sent to the chain). Holders of several Chogs sing them all in one transaction. A counter shows how much $CHOG the encores have burned. |
| **Posters and clips** | Every song can be saved as a video clip (a spinning record for a single Chog) or a 1080×1350 generative poster painted from the song's notes in the Chog's own colours. |
| **Records** | Finished rounds are sealed on-chain by anyone and play back here for good. **Play all** runs every sealed round in order, like an album. |

## How a Chog becomes a voice

The voice is a formant synthesiser built from scratch in Web Audio. No samples.

| Trait | What it does |
|---|---|
| Mouth | The vowel it sings (Drooling is "ahh", Smile is "eee", Bubblegum is "ooo", Wo is "ohh", Flat is "ehh"). |
| Body | Voice type: bass, tenor, alto or soprano. Sets the formant size and the Chog's home range. |
| Eyes | Timbre and vibrato: laser and visors are bright and buzzy, crying eyes are soft and breathy, happy eyes are bouncy. |
| Head | Attack and release: crowns and wizard hats swell slowly, caps start quickly. |
| Accessory | One effect: wobble, grit, shimmer, echo, smoke or a sub-octave. |
| Tier | How many voices sing in unison (Common 1, Uncommon 2, Rare 3, Epic and Legendary 4). |
| Side, Background, Aura, Skin, Form, Base | Stereo position, room size, brightness and a hollow source for skulls. |

The Chog page shows each line in plain words. The rules are in [`web/src/audio/voice.ts`](web/src/audio/voice.ts) and unit tested.

## How a Chog becomes a song

[`web/src/lib/songs.ts`](web/src/lib/songs.ts): Mouth sets the mood (the scale), Body the key, Eyes the tempo, Background the band style (lo-fi, pulse or halftime; assigned once and balanced across the collection). The hook is the Chog's own phrase with a harmony voice a third above on the strong beats. Rendering 200 spread-out songs offline gave no clipping, no silence and loudness within 3 dB of each other.

## On-chain

[`contracts/src/ChogChoir.sol`](contracts/src/ChogChoir.sol), tested with Foundry (38 tests for the choir, plus the epoch-key vectors).

- `place(tokenId, step, pitch)`: the owner of a Chog adds its one note to the current round.
- `placeMany(ids, steps, pitches)`: the same for several Chogs in one transaction, all or nothing. The biggest holder on mainnet has 73 Chogs; the whole batch costs about 4.2M gas (about 58k per Chog) in a rehearsal against the real collection.
- `encore(tokenId, step, pitch)`: a Chog that has sung can burn `encorePrice` of **$CHOG** for a second note, once per round. It is a real burn: the choir pulls the tokens in and calls the token's `burn()`, so the token's total supply drops by exactly the price (not a transfer to a dead address). `totalBurned` counts it.
- Streaks and totals are stored per Chog. `loft(from, count)` returns every Chog's record in one call.
- `seal(epoch)`: anyone can freeze a finished round into a hash and list it in the archive.
- Each round's key is derived on-chain from the round number, so everyone sings in the same one. Rounds start on multiples of their length, so a one-day round turns over at 00:00 UTC.
- The NFT is a constructor argument. On Monad mainnet it is the real Chog Genesis collection (`0xc96d…3763`); on testnet it is `ChogReplica`, a free-to-claim copy with the same ids and metadata, so judges can try everything. The constructor refuses addresses that are not contracts.
- The deploy script refuses to run on Monad mainnet unless `NFT` is the real collection, `TOKEN` is the real $CHOG and `EPOCH_SECONDS` was set on purpose, so a forgotten variable can never wire the real collection to a free stand-in token.

## Why the NFT is essential

- A Chog's voice and song **are** its traits. No Chog, no voice.
- A seat in the Choir needs the real Chog in your wallet, checked by the contract (`ownerOf`).
- The band grows with the number of distinct Chogs that have sung, so holders have a reason to bring each other in.
- Encores burn $CHOG.

## Run it

```sh
cd web && pnpm install && pnpm dev          # http://127.0.0.1:5188
pnpm test                                    # unit tests
cd ../contracts && forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.1.0 --no-git && forge test
cd ../qa && pnpm install && ./run-e2e.sh     # fresh local chain + the whole product in a real browser
node fork-rehearsal.mjs                      # the mainnet deployment rehearsed on a fork, against the REAL Chog Genesis and $CHOG
node mainnet-fork-ui.mjs                     # the same, through the page: the biggest real holder (73 Chogs) sings in 3 batches and takes an encore with real $CHOG
node smoke-prod.mjs                          # the production build as a judge loads it (run `pnpm build` first)
MODE=testnet EPOCH=300 node e2e.mjs <nft> <choir> <token>   # the same browser test on real Monad testnet (needs a 5-minute-round deployment and the deployer key in contracts/.env)
node onboarding.mjs; node theme.mjs; node wallet.mjs   # the welcome, dark/light mode, the wallet button
```

`qa/audio.mjs`, `qa/beat.mjs` and `qa/sweep.mjs` render audio offline and measure it (formants, levels, balance, 200-song sweep).

## Data

- All 1,969 Chogs' traits come from the contract's own `tokenURI` metadata on IPFS (`scripts/build-data.mjs`, `scripts/build-manifest.mjs`). On-chain token ids are a rotation of the number in the name (token 1 is "CHOG #1462"); the app keys on the token id and shows the name number.
- Thumbnails were downscaled from a community copy of the artwork to avoid hammering public IPFS gateways. A random sample of 40 was checked against the on-chain originals (`scripts/verify-art.mjs`, worst mean difference 1.7/255). Art by CHOOLABS.

## Deployments

**Monad testnet (chain 10143), live.** Rounds last 30 minutes. This is the v2 contract (real burn, batch singing, UTC-aligned rounds).

| Contract | Address |
|---|---|
| ChogChoir | [`0xa5Caaa02348578b0c04a32319ea9D1Dd21F8aa78`](https://testnet.monadexplorer.com/address/0xa5Caaa02348578b0c04a32319ea9D1Dd21F8aa78) |
| ChogReplica (free-to-claim copy of the collection) | [`0x4adDeE666Ce1Cb04a9FF6169C2b12711Ecb95844`](https://testnet.monadexplorer.com/address/0x4adDeE666Ce1Cb04a9FF6169C2b12711Ecb95844) |
| ChogToken (free, burnable stand-in for $CHOG, `faucet()`) | [`0x50BbE4bd1F17DeC172930ab99c2ef4A537b40d55`](https://testnet.monadexplorer.com/address/0x50BbE4bd1F17DeC172930ab99c2ef4A537b40d55) |

Rounds on testnet are seeded from the project wallet (`0x79e3…30e4`, a throwaway deployer) so the choir is not empty: it claims some replica Chogs and has them sing one note each per round (`scripts/seed.mjs`, one `placeMany` transaction). Those transactions are real and visible on the explorer, and they are not user activity.

**Monad mainnet (chain 143):** not deployed yet. [`docs/MAINNET.md`](docs/MAINNET.md) is the runbook.

Testing is written up in [`docs/HARDENING.md`](docs/HARDENING.md).

## Honest limits

- I (the builder) cannot listen. Pitch, vowel formants, levels and clipping are measured offline; how it _feels_ is not.
- On testnet the Chogs are free copies. The essential-NFT guarantee is the mainnet deployment, where the same contract reads the real collection.
- The Choir needs holders to sing. The loft shows exactly how many have.
