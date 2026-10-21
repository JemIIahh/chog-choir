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
- Encore burns $CHOG to a dead address: a sink, not a payment to us.
- The NFT contract is a constructor argument so one codebase serves the replica and the real collection.
- Two deployments: mainnet with real Chogs, testnet for anyone to try.

**Visual identity.** A gig poster pulled on a risograph, on warm paper stock (no blue desk: the owner rejected the ultramarine as "weird" and pointed at the official Chog Studio site as the neatness bar): greige desk with faint music doodles (vinyl, notes, mic, headphones, ticket, singing face), cream cut-paper cards with ink borders and hard tan offset shadows, ink black plus one hot pink, paper grain, die-cut sticker Chogs, a two-ink misregistered wordmark. Sound paints: every note blooms in its vowel's colour behind the page (multiplied into the paper like wet ink, so overlaps deepen) and leaves a wet-ink stain on the staff. Every Chog is a record (sleeve plus a disc that slides out and spins). Each vowel has its own colour, so the trait-to-sound mapping is visible. Bagel Fat One for display, Hanken Grotesk for text. Posters sample each Chog's own artwork for their paint.
