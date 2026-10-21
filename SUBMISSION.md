# Chogathon 2026 submission (draft)

Fill the links, then paste into the form.

**Project name:** Chog Choir

**Team:** _owner's handles_

**One line:** Every Chog has a voice and a song, built from its real traits, and holders sing together in one on-chain choir.

## What it does and what makes it new (max 8,000 characters)

Chog Choir turns the Chog Genesis collection into an instrument.

**Songs.** Type your Chog's number and hear its song. Each of the 1,969 Chogs has its own key, scale, tempo, band and vocal hook, read from its traits: the mouth decides the vowel it sings and the mood, the body its key and voice type, the eyes its tempo and tone, the head how it starts a note, the accessory an effect, the tier how many voices sing in unison. A card on every Chog explains each line in plain words. One tap saves a short video of your Chog performing, or copies a link.

**The Choir.** A shared choir on Monad. In each round, a Chog can add one note, and only its owner can place it. A choir loft shows all 1,969 Chogs seated by voice type, lighting up as they sing. The band builds as more distinct Chogs have sung: voices alone, then a pad, then bass, then drums, so holders have a reason to bring each other in. Singing every round builds a streak. A Chog that has sung can take an encore: burn $CHOG for a second note. Finished rounds are sealed on-chain by anyone and kept in Records.

**Studio.** For everyone: put any Chogs on a staff, pick a beat and key, and share the whole band as a link.

Nobody has built music from the collection's traits, and nobody has made the collection one instrument that holders play together, round after round.

## Why the Chog NFT is essential

A Chog's voice and song are its traits, so there is no voice without the Chog. A seat in the Choir is checked on-chain against the real collection (`ownerOf`). The band's growth depends on how many distinct Chogs have sung. Encores burn $CHOG. Take the NFT out and there is no voice, no seat, and nothing to play.

## Demo and testing instructions

1. Open the app. On **Songs**, type a Chog number (try 1462) and press Play.
2. **Studio**: pick a Chog, tap the staff, change the beat.
3. **The Choir**: choose "Try it free on testnet", connect a wallet on Monad testnet (get testnet MON from the Monad faucet), claim a free Chog, tap a cell, press Sing. Burn free test $CHOG for an encore. Open **Records** to hear sealed rounds.
4. Real holders: choose "Real Chogs on Monad" and sing with a real Chog (needs a little MON for gas).

## Tech stack

Vite, React, TypeScript, viem. Web Audio (formant synthesis, a small drum and bass band, offline rendering for measurement). Solidity 0.8.28, Foundry, OpenZeppelin. Monad mainnet and testnet. No backend: everything is the browser plus the chain.

## Pre-existing work

None. Built during the hackathon. Chog Genesis metadata is read from the contract; artwork by CHOOLABS.

## What's next

More voices per Chog as it sings (streak rewards), a weekly "Chog of the week" song, duets between two holders, and full songs recorded from sealed rounds.

## Judge access

No login. Everything works without a wallet except placing a note. Testnet Chogs are free to claim in the app.
