# Chog Choir: design notes

**Intent.** Make the Chog Genesis collection an instrument people play together. A judge or a holder should hear something delightful in five seconds, and a holder should have a reason to come back and to bring other holders.

**Goals**
- Hear any Chog sing at once, with no wallet.
- The voice and the song come from the real traits, and the card says how in plain words.
- One shared choir on Monad where only an owner can place its Chog's note.
- Participation is visible (the loft) and audible (the band builds).

**Non-goals**
- A game with stats, fights or economy. Sound is the product.
- A backend or database. The browser and the chain are enough.
- Sample-based audio. Every sound is synthesised.

**Anti-goals** (would make it a failure even if it technically works)
- Another "traits become stats" project with a speaker icon.
- A choir that looks empty. The loft always shows the real count; seeded testnet rounds are labelled.
- Anything that hides that testnet Chogs are free copies.

**Decisions**
- Formant synthesis for voices so a Chog is recognisably a voice, not a synth lead.
- One note per Chog per round, on a 16-step, 12-pitch staff: small enough to read, and the contract stays simple.
- The key is derived on-chain from the round number, so everyone sings together without coordination.
- The band is built from the number of distinct singers, a public number anyone can verify.
- Encore burns $CHOG with the token's own `burn()`: a sink, not a payment to us. Total supply drops, and the app counts what the choir has burned.
- The NFT contract is a constructor argument so one codebase serves the replica and the real collection.
- Two deployments: mainnet with real Chogs, testnet for anyone to try.

**Visual identity.** Two modes of one idea, switched by a toggle in the header (it follows the system setting until the visitor chooses). *Dark* is a quiet room with one spot from above: warm black, cream text, smoked-glass panels, and all the colour comes from the Chogs themselves. Their rings glow, and every note throws its vowel's colour across the page like stage light (additive). *Light* is a white room washed with the five vowel colours at their palest, frosted-glass panels, a sunrise play button and a wordmark with one vowel colour per letter; sound lands on it like wet ink (multiplied). Each vowel has its own colour, so the trait-to-sound mapping is visible. Bagel Fat One for display, Hanken Grotesk for text. Every Chog is a record (sleeve plus a disc that slides out and spins). Posters and clips are drawn in the current mode and sample each Chog's own artwork for their paint. Rejected along the way (do not bring back): the ultramarine desk, a beige-and-pink "paper" look that read as a copy of the Chog Studio site, and a flat black-and-yellow "Poster" look. Tokens live in `src/styles.css`, shared structure in `src/structure.css`, the two modes in `src/themes/`, and canvas colours in `src/lib/palette.ts`.
