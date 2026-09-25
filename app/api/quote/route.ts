import { flag, relayHeaders, RELAY_API } from "@/lib/relay-server";
import { HOME, TOKENS, tokenKey } from "@/lib/tokens";

type QuoteInput = {
  user: string;
  side: "buy" | "sell";
  token: string; // tokenKey, e.g. "8453:0x0000..."
  amount: string; // base units of the input currency
};

// Builds every quote on the server, so the recommended parameters and the
// API key never depend on the client.
export async function POST(request: Request) {
  const input = (await request.json()) as QuoteInput;

  const token = TOKENS.find((t) => tokenKey(t) === input.token);
  if (!token) return Response.json({ message: "Unsupported token" }, { status: 400 });
  if (!/^0x[a-fA-F0-9]{40}$/.test(input.user)) {
    return Response.json({ message: "Invalid user address" }, { status: 400 });
  }
  if (!/^\d+$/.test(input.amount) || input.amount === "0") {
    return Response.json({ message: "Invalid amount" }, { status: 400 });
  }

  const buy = input.side === "buy";
  const origin = buy ? HOME : token;
  const destination = buy ? token : HOME;

  const body: Record<string, unknown> = {
    user: input.user,
    recipient: input.user, // embedded EVM wallets share one address across chains
    originChainId: origin.chainId,
    destinationChainId: destination.chainId,
    originCurrency: origin.address,
    destinationCurrency: destination.address,
    amount: input.amount,
    tradeType: "EXACT_INPUT", // required for Route Racing

    // Price protection
    slippageTolerance: String(token.slippageBps),
    ttl: Number(process.env.QUOTE_TTL_SECONDS ?? 30),

    // Trading capabilities (Route Racing only runs if Relay enabled it on your key)
    useRouteRacing: flag("ROUTE_RACING", true),
    useRouteRacingOnOrigin: flag("ROUTE_RACING", true),
    routeRacingMinUsdSize: Number(process.env.ROUTE_RACING_MIN_USD ?? 100),
  };

  // Queuing: let sells complete during temporary destination-liquidity shortages.
  // ttl is checked on every request, so keep it at least as long as queueingTtl.
  if (!buy && flag("QUEUE_SELLS", true)) {
    const queueingTtl = Number(process.env.QUEUEING_TTL_SECONDS ?? 3600);
    body.useQueueing = true;
    body.queueingTtl = queueingTtl;
    body.ttl = Math.max(body.ttl as number, queueingTtl);
  }

  // Gasless buys: cross-chain buys from the USDC balance come back as one permit
  // signature, and the solver submits the deposit, so no ETH is needed. Same-chain
  // buys still return approve and swap transactions.
  if (buy && flag("USE_PERMIT", true)) body.usePermit = true;

  // App fee
  if (process.env.APP_FEE_RECIPIENT && process.env.APP_FEE_BPS) {
    body.appFees = [{ recipient: process.env.APP_FEE_RECIPIENT, fee: process.env.APP_FEE_BPS }];
  }

  // Fee Sponsorship, capped per request
  if (process.env.SPONSOR_MAX_USDC) {
    body.subsidizeFees = true;
    body.sponsoredFeeComponents = ["execution", "swap", "relay"];
    body.maxSubsidizationAmount = process.env.SPONSOR_MAX_USDC;
  }

  // Relay rejects a referrer sent without an API key, so only set it with a key
  if (process.env.RELAY_API_KEY) body.referrer = process.env.RELAY_REFERRER ?? "relay-trading-app-example";

  // Quotes work without a key at public rate limits. Route Racing, Fast Quoting, Fee
  // Sponsorship, and higher limits need a key.
  const headers = relayHeaders() ?? { "Content-Type": "application/json" };

  const res = await fetch(`${RELAY_API}/quote/v2`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
