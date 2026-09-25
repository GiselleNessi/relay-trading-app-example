# Unified Balance Example

A minimal trading app built on Relay. It's the companion to the Unified Balance use case guide in the Relay docs.

Users sign up with an email, get an embedded wallet, and trade in and out of one USDC balance on Base with one tap.

## What it shows

| Guide section | Where it lives |
| --- | --- |
| Keep the API key on your backend | `app/api/relay/[...path]/route.ts` proxies an allowlisted set of Relay endpoints and adds the key server-side. The Relay SDK in the browser points its `baseApiUrl` at this proxy. |
| Get a quote (server-side) | `app/api/quote/route.ts` builds every `/quote/v2` request with the recommended parameters: `EXACT_INPUT`, per-token slippage, a short `ttl`, Route Racing, Queuing on sells, and optional app fees, permits, and Fee Sponsorship. |
| Choose a wallet model | `app/providers.tsx` configures Privy email login with an embedded wallet and no per-transaction confirmation modal. |
| Sign and submit the deposit | `app/page.tsx` executes the quote with the Relay SDK and the embedded wallet. |
| Track the request | `app/page.tsx` polls `/intents/status/v3` once per second and maps each status to the UI response from the guide. Production apps should use websockets or webhooks. |
| Optional: Fast Fill | `app/api/fast-fill/route.ts`, called once per request right after the deposit is submitted. Off by default. |

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

By default the embedded wallet pays gas, so it needs a little ETH on each chain it trades from. To make trades gasless, the way consumer trading apps do, turn on TEE execution and gas sponsorship (Fee sponsorship > Sponsor gas fees, with Base selected) in the Privy Dashboard, then set `NEXT_PUBLIC_SPONSOR_GAS=true`. The app then sends each transaction through Privy with `sponsor: true`.

## Settings

All optional settings are listed in `.env.example`. Route Racing, Fast Quoting, and Route Pregeneration only take effect on API keys where Relay has enabled them.

## Not production-ready

This is a demo. Before shipping something similar, add authentication to your API routes, rate-limit them, and replace status polling with websockets or webhooks.
