# Unified Balance Example

A minimal trading app built on Relay. It's the companion to the Unified Balance use case guide in the Relay docs.

Bring your own Privy app and Relay API key: nothing in the code is tied to a specific account.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FGiselleNessi%2Frelay-trading-app-example&env=NEXT_PUBLIC_PRIVY_APP_ID,RELAY_API_KEY&envDescription=Your%20Privy%20App%20ID%20and%20Relay%20API%20key&envLink=https%3A%2F%2Fgithub.com%2FGiselleNessi%2Frelay-trading-app-example%23run-it)

Users sign up with an email, get an embedded wallet, and trade in and out of one USDC balance on Base with one tap.

## What it shows

| Guide section | Where it lives |
| --- | --- |
| Keep the API key on your backend | `app/api/relay/[...path]/route.ts` proxies an allowlisted set of Relay endpoints and adds the key server-side. The Relay SDK in the browser points its `baseApiUrl` at this proxy. |
| Get a quote (server-side) | `app/api/quote/route.ts` builds every `/quote/v2` request with the recommended parameters: `EXACT_INPUT`, per-token slippage, a short `ttl`, Route Racing, Queuing on sells, and optional app fees, permits, and Fee Sponsorship. |
| Use an embedded wallet | `app/providers.tsx` configures Privy email login with an embedded wallet and no per-transaction confirmation modal. |
| Sign and submit the deposit | `app/page.tsx` executes the quote with the Relay SDK and the embedded wallet. |
| Track the request | `app/page.tsx` polls `/intents/status/v3` once per second and maps each status to the UI response from the guide. Production apps should use websockets or webhooks. |
| Call Fast Fill | `app/api/fast-fill/route.ts`, called once per request right after the deposit is submitted. Off by default. |

## Trading UX

Modeled on consumer trading apps like the ones this guide describes:

- **One cash balance** at the top, with sells shown as a pending balance right away.
- **One-click trades** with no wallet pop-ups.
- **Quick amounts:** $5, $10, $25, or 10%, 25%, 50%, and Max of your balance.
- **Live price** for the selected token, refreshed every 5 seconds.
- **Fee details** from the quote, including what's sponsored.
- **Holdings** list; click one to sell it.
- **Tokens** grouped into Majors, Memecoins, and Ecosystem across Base, Arbitrum, Optimism, and Ethereum, generated from Relay's verified `/currencies/v2` list (`lib/tokens.ts`).

## Run it

1. Create a Privy app at [dashboard.privy.io](https://dashboard.privy.io) with email login enabled, and copy its App ID.
2. Create a Relay API key in the [Relay Dashboard](https://dashboard.relay.link).
3. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_PRIVY_APP_ID` and `RELAY_API_KEY`.
4. Install and start:

   ```bash
   npm install
   npm run dev
   ```

5. Open http://localhost:3000, log in with your email, and send a few dollars of USDC on Base to the wallet address shown.

To deploy instead, use the **Deploy with Vercel** button above and enter the same two values. Mark `RELAY_API_KEY` as a secret, and redeploy after changing any variable.

## Gas

By default the embedded wallet pays its own gas, so send it a little ETH on Base along with the USDC.

To make trades gasless, the way consumer trading apps do, Privy pays gas for the embedded wallet. In the Privy Dashboard:

1. **Billing:** add a payment method and buy gas credits. Mainnet chains don't appear in gas sponsorship until you do.
2. **Wallets > Advanced:** turn on TEE execution.
3. **Fee sponsorship:** turn on **Sponsor gas fees**, select **Base**, and turn on **Allow transactions from the client**.

Then set `SPONSOR_GAS=true` on the server and restart (or redeploy). The app sends each transaction through Privy with `sponsor: true`. Sponsored gas is billed to your Privy account.

## Settings

All optional settings are listed in `.env.example`. Route Racing, Fast Quoting, and Route Pregeneration only take effect on API keys where Relay has enabled them.

## Not production-ready

This is a demo. Before shipping something similar, add authentication to your API routes, rate-limit them, and replace status polling with websockets or webhooks.
