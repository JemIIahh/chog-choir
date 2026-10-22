# Chogathon 2026 submission (draft)

Field names follow the Chogathon form. Anything in [square brackets] needs a real value before you paste it. Nothing here has been sent.

## Before you submit

- [ ] Demo video recorded and uploaded (YouTube Unlisted, or Google Drive "Anyone with the link" = Viewer), 3 minutes at most. **Required.**
- [ ] Contact email (judges only). **Required.**
- [x] App link live and tested from a clean browser (production smoke test passes on it).
- [x] GitHub repo public (README is the tech and testing guide).
- [ ] Team members, X and Discord handles.
- [x] Mainnet deployed 2026-10-22 (ChogChoir `0x1C7CF660BD5e858360E261caB59F3CD1638F8bc0`), so the mainnet lines below are live.
- [ ] Real feedback or usage added under "What's next". Do not invent any.
- [ ] Re-read the deadline on your dashboard. Submissions can be edited until it closes.

---

## Project name

Chog Choir

## One line

Every Chog has a voice and a song, built from its real traits, and holders sing together in one on-chain choir.

## Description (max 8,000 characters)

**What it is.** Chog Choir turns the Chog Genesis collection into an instrument. A Chog's traits are not decoration here: they decide how it sounds. Type a Chog's number and hear its own song. Then holders play all 1,969 Chogs together, one note each per round, in a shared choir on Monad.

**Songs.** Each of the 1,969 Chogs has its own key, scale, tempo, band and vocal hook, read from its traits. The mouth decides the vowel it sings (ahh, ehh, eee, ohh, ooo) and the mood of the scale. The body decides the voice type (bass, tenor, alto, soprano) and the key. The eyes set the tempo and the tone: laser eyes are bright and buzzy, crying eyes soft and breathy. The head decides how a note starts, the accessory adds an effect, and the tier decides how many voices sing in unison. A card on every Chog explains each line in plain words, so you can hear why your Chog sounds like it does. The voice is a formant synthesiser built from scratch in the browser; there are no samples. **Hum a tune** into the microphone and the Chog sings it back in its own voice and key (nothing is recorded or sent anywhere: the pitch is read in the browser). Add a second Chog for a **duet**: the two always fit, because both sing in the first Chog's key. One tap saves a short video of your Chog performing, a poster, or a link.

**The Choir.** A shared choir on Monad. In every round a Chog can place one note, and only its owner can place it: the contract checks `ownerOf` on the collection. A choir loft shows all 1,969 Chogs seated by voice type and lighting up as they sing. The band builds as more distinct Chogs have sung: voices alone, then a pad (5 singers), bass (25), then drums (100), so holders have a reason to bring each other in. Singing every round builds a streak, and holders of several Chogs sing them all in one transaction. A Chog that has sung can take an encore: burn $CHOG for a second note. A slider asks "what if more Chogs sing?" and plays a clearly labelled preview of a fuller choir, so a quiet round still shows what the band becomes. Anyone can seal a finished round on-chain, and sealed rounds are kept in Records, where **Play all** runs them in order like an album.

**Studio.** For everyone: put any Chogs on a staff, pick a beat and key, and share the whole band as a link.

**What makes it new.** Nobody has made music out of a collection's traits, and nobody has made the collection into one instrument that holders play together, round after round. Most NFT projects use the art as a skin on a game. Here the metadata itself is the sound.

**How it runs.** No backend. Everything is the browser plus the chain. Rounds last 30 minutes on testnet. and one day on Monad mainnet. Each round's key and mode are derived on-chain from the round number, so everyone sings in the same key.

**Honest limits.** The builder cannot hear and measured the audio offline (pitch, vowel formants, loudness, clipping across 200 songs). On testnet the Chogs are free copies so judges can try everything, and the notes in the current testnet rounds come from the project wallet to keep the choir from sounding empty; those transactions are on the explorer.

## Why the Chog NFT is essential

The page asks: "If you removed the NFT, would the experience still work the same way?" No.

- **No Chog, no voice.** A voice and a song are a Chog's traits. Remove the NFT's metadata and there is nothing to play.
- **No Chog, no seat.** Placing a note in the Choir is checked on-chain against the real collection (`ownerOf`). One Chog, one note per round.
- **The band depends on holders.** It only gets fuller as more distinct Chogs sing, so every holder makes it better for every other holder.
- **Encores burn $CHOG.** A second note costs 1,000 $CHOG. It is a real `burn()`, so the token's total supply goes down, and the app shows how much the choir has burned.

Songs and Studio are open to everyone on purpose, so anyone can hear a Chog before they own one. Taking part in the Choir needs the real thing. The real collection is `0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763` on Monad mainnet, and the mainnet Choir contract is `0x1C7CF660BD5e858360E261caB59F3CD1638F8bc0`. On testnet the same contract points at a free copy of the collection so judges can try everything.

## $CHOG

Encores burn $CHOG (1,000 per encore, read from the contract) with a real `burn()`: the choir pulls the tokens in and burns them, so total supply falls by exactly that amount. I rehearsed this against the real collection and the real $CHOG on a fork of Monad mainnet before deploying. On mainnet this is the real token, `0x350035555E10d9AfAF1566AaebfCeD5BA6C27777`. On testnet a free stand-in token with a faucet is used so judges can test the burn.

## Demo video (max 3 minutes)

[Link]. Plan: 0:00 hook and one Chog's song; 0:25 the traits behind the sound; 0:45 hum a tune and the Chog sings it back, then a duet; 1:15 the Choir: the loft, the "what if more Chogs sing?" slider and the band layers building; 2:00 encore burn; 2:20 Records, Play all; 2:45 what's next.

## App link

https://chog-choir.vercel.app (use this address, not a long `…-seunjeremiah2003-…vercel.app` deployment link: those ask for a Vercel login). Dark and light mode follow your system and can be switched at the top.

## Judge access instructions (max 8,000 characters)

Open https://chog-choir.vercel.app. You can listen to everything without logging in. A wallet is only needed to sing in The Choir (steps 3 and 5): press "Connect wallet" at the top right and use any browser wallet, or sign in with email or Google and one is created for you. The Choir comes in two versions: a free one on Monad testnet (step 3, it opens first, no Chog needed) and the real one on Monad mainnet (step 5, a real Chog is needed).

1. SONGS
Type a Chog number (try 1462) and press Play. Try "Duet with Chog #" with 88 and press Sing together. Press "Hum a tune", allow the microphone, wait for the count-in, then hum "ooo" or "la" with a few different notes for about five seconds: the Chog sings your tune back. Save clip, Save poster and Copy link show the exports. If you connect a wallet here, it shows the Chogs you own.

2. STUDIO
Pick a Chog, tap the staff to place its note, change the beat and key, press Play, and copy the link.

3. THE CHOIR, FREE VERSION (Monad testnet, chain 10143)
This is what The Choir opens on, so you can try everything without owning a Chog.
a. Get free testnet MON for gas from https://faucet.monad.xyz or the Alchemy Monad testnet faucet (no sign-up needed).
b. Press "Connect wallet". Use any browser wallet, or choose "Email or Google": a wallet is created for you, and Privy asks you to confirm each transaction. A new wallet starts with no MON, so press "Copy my address" and send that address the testnet MON from the faucet.
c. Press "Claim a free Chog" (a free copy of the real collection). Pick it, tap a cell on the staff, and press Sing. Your Chog lights up in the loft and the voice count goes up.
d. Claim two or three Chogs and press "Sing with all": they all sing in one transaction.
e. Press "Get 1,000 test $CHOG", tap a cell, and press the encore button. It burns 1,000 test $CHOG, adds a second voice, and the "$CHOG burned" counter goes up.
f. Drag "What if more Chogs sing?" to hear the band fill out. It is a preview and is never sent to the chain.
Rounds last 30 minutes on testnet.

4. RECORDS
When a round ends anyone can press "Seal it". Sealed rounds play back, and "Play all" plays every sealed round in order.

5. THE REAL VERSION (Monad mainnet, chain 143)
Press "Real Chogs on Monad" at the top of The Choir, or open https://chog-choir.vercel.app/?net=main#choir. This is the live version. The Choir contract is 0x1C7CF660BD5e858360E261caB59F3CD1638F8bc0 (https://monadvision.com/address/0x1C7CF660BD5e858360E261caB59F3CD1638F8bc0), and for every note it checks ownerOf on the real Chog Genesis (0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763). Singing here needs a real Chog in your connected wallet and a little MON for gas (a note costs about 0.02 MON). An encore burns 1,000 real $CHOG (0x350035555E10d9AfAF1566AaebfCeD5BA6C27777). Rounds are one day long and turn over at 00:00 UTC.
This choir starts empty and fills only as real Chog holders sing, so you may see an empty loft ("Nobody has sung this round. Be the first."). If you do not hold a Chog you can still connect a wallet (the page says it holds no Chog Genesis and offers the free version) and drag "What if more Chogs sing?" to hear what the round becomes. To sing without owning a Chog, use the free version in step 3.

The code is at https://github.com/JemIIahh/chog-choir . Its README lists every contract address and how each part was tested.

## Tech stack

Vite, React, TypeScript, viem. Web Audio: formant synthesis, a small drum and bass band, offline rendering for measurement. Solidity 0.8.28, Foundry, OpenZeppelin v5. Monad testnet and mainnet. Canvas for posters and clip export (MediaRecorder). 38 contract tests, 60+ unit tests, an end-to-end test in a real browser that runs against a local chain and against real Monad testnet (real transactions, real waits between rounds), a rehearsal of the mainnet deployment on a fork against the real collection and token (then, after deploying, the settings read back from the chain and the deployed code compared with the compiled contract: identical), and a 200-song audio sweep.

## GitHub repo

https://github.com/JemIIahh/chog-choir

## Pre-existing work

None. Built during the hackathon. Third-party: OpenZeppelin contracts, the Vite/React/viem libraries, and Google Fonts (Bagel Fat One, Hanken Grotesk). Chog Genesis artwork is by CHOOLABS; traits are read from the collection's own metadata on IPFS. To avoid hammering public IPFS gateways, the small thumbnails were downscaled from a community copy of the artwork and a random sample was checked against the originals.

## What's next

Planned: more voices per Chog as its streak grows, a weekly "Chog of the week" song, duets between two *holders* in the same round, and full songs recorded from sealed rounds.

User feedback and usage so far: [add real feedback, quotes and on-chain numbers from people who tried it. The seeded testnet notes are the builder's and are not user usage.]

## Go-to-market plan (optional, max 8,000 characters)

**Who first.** Chog holders, because the Choir needs them, and the wider Monad community, who can try the free testnet version.

**Why they come back.** Rounds repeat, streaks reward showing up every round, and the band only reaches full strength when enough different Chogs have sung. The loft makes the collective visible: you can see your Chog among the others.

**How it spreads.** Every Chog already has a shareable clip and a poster in its own colours, made in one tap. Holders post their Chog's song; the link opens straight to that Chog.

**Launch steps.**
1. Share in the Chog Discord and on X with the clip of one Chog and a link that plays it.
2. Open daily rounds on mainnet and post the loft each day: how many Chogs sang, which layer unlocked.
3. Ask holders to bring one other holder to reach the next band layer (25 singers for bass, 100 for drums).
4. Collect feedback from the first holders and publish a changelog.

**Cost to run.** None beyond gas: there is no backend to host.

[Edit this to match what you are actually willing to do.]
