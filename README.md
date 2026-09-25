# Unified Balance Example

An example trading app built on Relay, and the companion to the [Unified Balance guide](https://docs.relay.link/references/api/use_case_guides/unified-balance). Your users hold one USDC balance on Base and buy or sell tokens on Base, Arbitrum, Optimism, and Ethereum in one tap.

This is a simplified take on a consumer trading app, not a production app. Clone it, run it locally with your own keys, and use it as a starting point. It shows the Relay pieces the guide recommends:

- **Server-side quotes** with per-token slippage, a short `ttl`, and optional app fees (`app/api/quote/route.ts`)
- **Gasless cross-chain buys** with a permit signature instead of a transaction (`usePermit`)
- **Route Racing** on every eligible quote, and **Queuing** on sells
- **Fast Fill for slow deposits**, decided on the backend (`app/api/fast-fill/route.ts`)
- **An API key that never reaches the browser**, through an allowlisted proxy (`app/api/relay/[...path]/route.ts`)

## Run it

You need Node.js 20 or later and a free [Privy](https://dashboard.privy.io) app.

1. Clone the repo and install:

   ```bash
   git clone https://github.com/GiselleNessi/relay-trading-app-example.git
   cd relay-trading-app-example
   npm install
   ```

2. Create a Privy app at [dashboard.privy.io](https://dashboard.privy.io), turn on email and external wallet login, and copy its App ID.
3. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_PRIVY_APP_ID`.
4. Optional: set `RELAY_API_KEY` from the [Relay Dashboard](https://dashboard.relay.link). Quotes work without one at public rate limits; Route Racing, Fee Sponsorship, Fast Fill, and higher limits need one.
5. Start the app:

   ```bash
   npm run dev
   ```

6. Open http://localhost:3000, sign up with your email or connect a wallet, and send a few dollars of USDC on Base to the address shown.

## Wallets

The app uses [Privy](https://docs.privy.io) as an example, not a requirement. Users can:

- **Sign up with email.** Privy creates an embedded wallet that signs trades with no wallet prompt.
- **Connect their own wallet**, such as MetaMask or Rainbow. The wallet asks them to confirm each trade.

Privy only appears in two files, `app/providers.tsx` and `app/use-trading-wallet.ts`. To use another wallet provider, replace the provider in `app/providers.tsx` and reimplement `useTradingWallet` with the same return shape. The rest of the app only talks to that hook.

## Gas

| Trade | Gas |
| --- | --- |
| Cross-chain buy, such as USDC on Base to ETH on Arbitrum | None. The quote returns one permit signature, and the solver submits the deposit. |
| Same-chain buy on Base, and every sell | A little ETH on the origin chain, unless Privy sponsors it. |

To make every trade gasless for email users, Privy can pay gas for the embedded wallet. In the Privy Dashboard:

1. **Billing:** add a payment method and buy gas credits. Mainnet chains don't appear in gas sponsorship until you do.
2. **Wallets > Advanced:** turn on TEE execution.
3. **Fee sponsorship:** turn on **Sponsor gas fees**, select **Base** (and any other origin chains), and turn on **Allow transactions from the client**.

Then set `SPONSOR_GAS=true` in `.env.local` and restart. Sponsored gas is billed to your Privy account. Connected wallets always pay their own gas.

## Build on it with an AI assistant

This repo is set up to work with AI coding assistants such as Claude Code, Cursor, and Codex. `AGENTS.md` explains the architecture, the Relay rules the code follows, and where to make common changes, and the assistant reads it automatically.

Some starting prompts:

- "Set this project up and run it locally. Walk me through the Privy settings I need."
- "Replace Privy with [your wallet provider], keeping the same `useTradingWallet` interface."
- "Add Solana tokens to the token list and make the Unified Balance USDC on Solana."
- "Replace status polling with Relay websockets."

## Settings

Every setting is in `.env.example` with its default. Route Racing, Fast Quoting, and Route Pregeneration only take effect on API keys where Relay has enabled them; contact Relay through the [support channels](https://docs.relay.link/resources/support) to request them.

## Before you ship something similar

This is an example. Before you ship, add authentication and rate limits to the API routes, replace status polling with [websockets](https://docs.relay.link/references/api/api_guides/websockets) or [webhooks](https://docs.relay.link/references/api/api_guides/webhooks), and read the [Unified Balance guide](https://docs.relay.link/references/api/use_case_guides/unified-balance) end to end.
