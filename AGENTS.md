<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Unified Balance Example

An example trading app on Relay: users hold one USDC balance on Base and buy or sell tokens across Base, Arbitrum, Optimism, and Ethereum. It's the companion to the Unified Balance guide: https://docs.relay.link/references/api/use_case_guides/unified-balance. Read the guide before changing trade behavior; the code follows it.

## Run

- `npm install`, copy `.env.example` to `.env.local`, set `NEXT_PUBLIC_PRIVY_APP_ID`, then `npm run dev` (http://localhost:3000).
- `RELAY_API_KEY` is optional. Without it, quotes use public rate limits and features that need a key (Route Racing, Fee Sponsorship, Fast Fill) don't apply.
- Check changes with `npx tsc --noEmit -p .` and `npx eslint app lib`.

## Architecture

| File | Role |
| --- | --- |
| `app/api/quote/route.ts` | Builds every `/quote/v2` request on the server: `EXACT_INPUT`, per-token slippage, short `ttl`, Route Racing, `usePermit` on buys, Queuing on sells, optional app fees and Fee Sponsorship. |
| `app/api/relay/[...path]/route.ts` | Allowlisted proxy the browser SDK uses (`baseApiUrl`). Adds the API key server-side. Allowlist lives in `lib/relay-server.ts`. |
| `app/api/fast-fill/route.ts` | Fast Fill for slow deposits. Re-checks status and skips deposits Relay already indexed. Off unless `FAST_FILL=true`. |
| `app/api/config/route.ts` | Client-safe settings read from server env vars (`SPONSOR_GAS`, `FAST_FILL_AFTER_SECONDS`). |
| `app/use-trading-wallet.ts` | The wallet abstraction. The only file besides `app/providers.tsx` that imports Privy. Returns `{ ready, authenticated, login, logout, address, embedded, label, getRelayWallet }`. |
| `app/providers.tsx` | Privy provider (email creates an embedded wallet, or connect an external wallet) and the Relay SDK client. |
| `app/page.tsx` | The UI: balance, holdings, buy/sell, quote display, execution with the Relay SDK, and status tracking. |
| `lib/tokens.ts`, `lib/chains.ts` | Token list (generated from Relay's `/currencies/v2`) and supported chains. |

## Rules the code follows

- Never expose `RELAY_API_KEY` to the browser. Quotes and Fast Fill run on the server; the browser reaches Relay only through the allowlisted proxy.
- Only send `referrer` on quotes when an API key is set. Relay rejects a referrer without a key.
- Keep `ttl` short on trades, but on queued sells raise it to at least `queueingTtl`, or Relay refunds the sell before it can wait for liquidity.
- Call Fast Fill only from the backend, only for deposits slower than the threshold, and always with `maxFillAmountUsd`.
- Sponsor fees with `sponsoredFeeComponents: ["execution", "swap", "relay"]`. Leaving it out also sponsors your own app fee.
- Gas: cross-chain buys from Base USDC are a single permit signature (no gas). Same-chain buys and sells send transactions and need gas unless `SPONSOR_GAS=true` and the user has an embedded wallet.

## Common changes

- **Swap the wallet provider:** replace the provider in `app/providers.tsx` and reimplement `useTradingWallet` with the same return shape. `getRelayWallet(chainId, sponsorGas)` must return an `AdaptedWallet` for the Relay SDK (`adaptViemWallet` from `@relayprotocol/relay-sdk` works for any viem wallet client).
- **Add tokens or chains:** add them to `lib/tokens.ts` (with a per-token `slippageBps`) and `lib/chains.ts`. Use tokens from Relay's `/currencies/v2`.
- **Replace polling:** the `track` function in `app/page.tsx` polls `/intents/status/v3`. Production apps should use Relay websockets or webhooks.
- **Relay API reference:** https://docs.relay.link. Check parameter behavior against the live spec at https://api.relay.link/documentation/json before relying on it.
