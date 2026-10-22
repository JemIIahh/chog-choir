# Sign in with email or Google (Privy)

An optional second way in for people who have no crypto wallet: they sign in with an email code or Google and get an embedded wallet. It is **off until you give it a Privy App ID**, and when it is off the page has no such option and never contacts Privy. The Privy SDK is a separate download, fetched only when someone picks "Email or Google".

## Current state (2026-10-22)

- App ID `cmvj6kyvc00jn0hjt8w4mqayr` ("ChogChoir"), set as `VITE_PRIVY_APP_ID` in Vercel production and in `web/.env.local`. The live site shows **Sign in with email** and opens Privy's real sign-in window.
- In the Privy dashboard **Email is on and Google is off**, so the page offers email only (`VITE_PRIVY_METHODS` defaults to `email`). To add Google: enable it under *Login methods*, set `VITE_PRIVY_METHODS=email,google` in Vercel, redeploy.
- *Allowed origins* is empty and Privy accepts any origin, so the live site and localhost both work. Adding `https://chog-choir.vercel.app` there would stop other sites from using this App ID.
- Embedded wallets are created on sign-in by the page's own setting (the dashboard default is "off").

## Turn it on

1. Create an app at <https://dashboard.privy.io> (a "Client-side" app).
2. In the app's settings:
   - **Login methods:** enable **Email** and **Google**.
   - **Allowed origins:** add `https://chog-choir.vercel.app` and, for testing here, `http://localhost:5188` and `http://127.0.0.1:5188`.
   - **Embedded wallets:** Ethereum embedded wallets on. (The page asks Privy to create one automatically for people who sign in without a wallet.)
   - Optional: under *Test accounts* make a test email with a fixed code, so sign-in can be checked without a real inbox.
3. Copy the **App ID** (about 25 letters and digits). It is public, not a secret.
4. Locally: `echo 'VITE_PRIVY_APP_ID=<the id>' > web/.env.local`, then `pnpm dev`.
5. Live: `cd web && vercel env add VITE_PRIVY_APP_ID production`, paste the id, then `vercel deploy --prod --yes` (Vite reads it at build time, so it needs a redeploy).

## What the visitor sees

"Connect wallet" now has an **Email or Google** row on top. Choosing it opens Privy's own sign-in window; when it finishes, the account shows up in the header like any other wallet, remembered across reloads, and **Disconnect** also signs out of Privy. Every transaction (singing, claiming, encores) asks for a confirmation in Privy's window.

## Sessions on a shared computer

- **Disconnect** signs out of Privy (and waits for that to finish before closing anything). Replacing the email wallet with a browser wallet signs out too.
- Closing the tab without disconnecting keeps the session, on purpose, so the wallet is back after a reload (the same as a browser wallet that stays connected).
- Choosing **Email or Google** always starts a fresh sign-in: if an older session is still on the browser it is ended first, so the wallet is never handed to someone who did not just sign in.

## Gas

An embedded wallet starts with **0 MON**, and singing is a transaction. On testnet the page already tells a wallet with no MON where to get some and has a **Copy my address** button, but a first-time visitor has to leave the page for a faucet. Options if that matters for judges:

- Leave it (zero extra moving parts).
- A tiny serverless "drip" that sends 0.05 testnet MON to a new address once. It needs a funded key stored as a Vercel secret and some abuse limiting, so it is a decision for you, not something to add silently.

## What is and is not tested

`node qa/privy.mjs` checks the part that does not need a real app: with no id the option is absent and Privy is never contacted; with an id Privy rejects, the option shows, fails with a clear message after about 20 seconds, and the rest of the page keeps working. **A real sign-in needs a real App ID and an email code, so it has not been run** until you set one up. With a Privy test account it can be added to `qa/` in a few minutes.
