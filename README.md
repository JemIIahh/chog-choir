# Chog Choir

Every Chog has a voice, and a song. Its real traits decide how it sounds.

Built for Chogathon 2026. Live app: _TBD_ · Demo video: _TBD_ · Contracts: see [Deployments](#deployments).

## What it is

| | |
|---|---|
| **Songs** | Type a Chog's number, hear its song. Each of the 1,969 Chogs has its own key, scale, tempo, band and hook, read from its traits. Save it as a clip or share a link. |
| **Studio** | A staff where every note is a Chog face. Pick a Chog (it sings), tap the staff to place its note, change tempo, space, brightness, key and beat. The whole band lives in the link. |
| **The Choir** | A shared, on-chain choir. One Chog gets one note per round, and only its owner can place it. A loft shows all 1,969 Chogs seated by voice type, lighting up as they sing. The more Chogs have sung, the fuller the band: voices, then a pad, then bass, then drums. |
| **Posters and clips** | Every song can be saved as a video clip (a spinning record for a single Chog) or a 1080×1350 generative poster painted from the song's notes in the Chog's own colours. |
| **Records** | Finished rounds are sealed on-chain by anyone and play back here for good. |

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

[`contracts/src/ChogChoir.sol`](contracts/src/ChogChoir.sol), tested with Foundry (25 tests).

- `place(tokenId, step, pitch)`: the owner of a Chog adds its one note to the current round.
- `encore(tokenId, step, pitch)`: a Chog that has sung can burn `encorePrice` of **$CHOG** (sent to `0x…dEaD`) for a second note, once per round.
- Streaks and totals are stored per Chog. `loft(from, count)` returns every Chog's record in one call.
- `seal(epoch)`: anyone can freeze a finished round into a hash and list it in the archive.
- Each round's key is derived on-chain from the round number, so everyone sings in the same one.
- The NFT is a constructor argument. On Monad mainnet it is the real Chog Genesis collection (`0xc96d…3763`); on testnet it is `ChogReplica`, a free-to-claim copy with the same ids and metadata, so judges can try everything.

## Why the NFT is essential

- A Chog's voice and song **are** its traits. No Chog, no voice.
- A seat in the Choir needs the real Chog in your wallet, checked by the contract (`ownerOf`).
- The band grows with the number of distinct Chogs that have sung, so holders have a reason to bring each other in.
- Encores burn $CHOG.

## Run it

```sh
cd web && pnpm install && pnpm dev          # http://127.0.0.1:5188
pnpm test                                    # 32 tests
cd ../contracts && forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.1.0 --no-git && forge test
cd ../qa && pnpm install && ./run-e2e.sh     # local chain + the whole flow in a real browser
```

`qa/audio.mjs`, `qa/beat.mjs` and `qa/sweep.mjs` render audio offline and measure it (formants, levels, balance, 200-song sweep).

## Data

- All 1,969 Chogs' traits come from the contract's own `tokenURI` metadata on IPFS (`scripts/build-data.mjs`, `scripts/build-manifest.mjs`). On-chain token ids are a rotation of the number in the name (token 1 is "CHOG #1462"); the app keys on the token id and shows the name number.
- Thumbnails were downscaled from a community copy of the artwork to avoid hammering public IPFS gateways. A random sample of 40 was checked against the on-chain originals (`scripts/verify-art.mjs`, worst mean difference 1.7/255). Art by CHOOLABS.

## Deployments

_Filled in after deploy._ Rounds on testnet were seeded from the project wallet so the choir is not empty; those transactions are real and visible on the explorer.

## Honest limits

- I (the builder) cannot listen. Pitch, vowel formants, levels and clipping are measured offline; how it _feels_ is not.
- On testnet the Chogs are free copies. The essential-NFT guarantee is the mainnet deployment, where the same contract reads the real collection.
- The Choir needs holders to sing. The loft shows exactly how many have.
