"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { getClient, type Execute } from "@relayprotocol/relay-sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  erc20Abi,
  formatUnits,
  http,
  parseUnits,
  type Chain,
} from "viem";
import { arbitrum, base, optimism } from "viem/chains";
import { HOME, TOKENS, tokenKey, type Token } from "@/lib/tokens";

const VIEM_CHAINS: Record<number, Chain> = { 8453: base, 42161: arbitrum, 10: optimism };
const NATIVE = "0x0000000000000000000000000000000000000000";

// What each status means for your UI. Mirrors the table in the Unified Balance guide.
const STATUS_RESPONSE: Record<string, { label: string; response: string; terminal?: boolean }> = {
  waiting: { label: "Waiting", response: "Show the trade as pending." },
  depositing: { label: "Depositing", response: "Keep showing the trade as pending." },
  pending: { label: "Pending", response: "Keep showing the trade as pending." },
  submitted: { label: "Submitted", response: "Show the trade as nearly complete." },
  success: { label: "Success", response: "Update the balance and stop tracking.", terminal: true },
  failure: { label: "Failed", response: "Show the failure reason and check for a refund.", terminal: true },
  refund: { label: "Refunded", response: "Show the trade as refunded, not failed.", terminal: true },
};

async function readBalance(owner: `0x${string}`, t: { chainId: number; address: string }) {
  const client = createPublicClient({ chain: VIEM_CHAINS[t.chainId], transport: http() });
  if (t.address === NATIVE) return client.getBalance({ address: owner });
  return client.readContract({
    address: t.address as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
  });
}

export default function Home() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets.find((w) => w.walletClientType === "privy");
  const address = wallet?.address as `0x${string}` | undefined;

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [token, setToken] = useState<Token>(TOKENS[0]);
  const [amount, setAmount] = useState("");
  const [homeBalance, setHomeBalance] = useState<bigint>();
  const [tokenBalance, setTokenBalance] = useState<bigint>();
  const [balanceNonce, setBalanceNonce] = useState(0);
  // Each quote result is tied to the inputs it was requested for, so a stale
  // quote is never shown after the user edits the trade.
  const [quoteResult, setQuoteResult] = useState<{ key: string; quote?: Execute; error?: string }>();
  const [trading, setTrading] = useState(false);
  const [status, setStatus] = useState<string>();
  const [statusDetail, setStatusDetail] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const inputDecimals = side === "buy" ? HOME.decimals : token.decimals;
  const outputDecimals = side === "buy" ? token.decimals : HOME.decimals;

  const refreshBalances = useCallback(() => setBalanceNonce((n) => n + 1), []);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    Promise.all([readBalance(address, HOME), readBalance(address, token)]).then(([home, tok]) => {
      if (cancelled) return;
      setHomeBalance(home);
      setTokenBalance(tok);
    });
    return () => {
      cancelled = true;
    };
  }, [address, token, balanceNonce]);

  let units: bigint | undefined;
  try {
    units = amount && Number(amount) > 0 ? parseUnits(amount, inputDecimals) : undefined;
  } catch {
    units = undefined;
  }
  const quoteKey = address && units ? `${address}|${side}|${tokenKey(token)}|${units}` : undefined;
  const quote = quoteResult?.key === quoteKey ? quoteResult?.quote : undefined;
  const quoteError = quoteResult?.key === quoteKey ? quoteResult?.error : undefined;
  const quoting = !!quoteKey && quoteResult?.key !== quoteKey;

  // 1. Quote from the backend, debounced so each edit produces one quote call
  useEffect(() => {
    if (!quoteKey || !address || !units) return;
    const body = JSON.stringify({ user: address, side, token: tokenKey(token), amount: units.toString() });
    const timer = setTimeout(async () => {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const data = await res.json();
      if (!res.ok) {
        setQuoteResult({ key: quoteKey, error: data.errorCode ? `${data.errorCode}: ${data.message}` : data.message });
      } else {
        setQuoteResult({ key: quoteKey, quote: data });
      }
    }, 500);
    return () => clearTimeout(timer);
    // quoteKey captures every input the quote depends on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey]);

  // 3. Track the request until it reaches a terminal status. Production apps
  // should prefer websockets or webhooks; this polls once per second.
  const track = useCallback((id: string) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/relay/intents/status/v3?requestId=${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data.status);
      setStatusDetail(data.details);
      if (STATUS_RESPONSE[data.status]?.terminal) {
        clearInterval(pollRef.current);
        refreshBalances();
      }
    }, 1000);
  }, [refreshBalances]);

  useEffect(() => () => clearInterval(pollRef.current), []);

  // 2. Sign and submit with the embedded wallet (no wallet prompt)
  const trade = async () => {
    if (!wallet || !quote) return;
    setTrading(true);
    setStatus("waiting");
    setStatusDetail(undefined);

    const id = (quote as Execute & { requestId?: string }).requestId ?? quote.steps[0]?.requestId;
    setRequestId(id);
    if (id) track(id);

    try {
      const originChainId = side === "buy" ? HOME.chainId : token.chainId;
      await wallet.switchChain(originChainId);
      const walletClient = createWalletClient({
        account: address!,
        chain: VIEM_CHAINS[originChainId],
        transport: custom(await wallet.getEthereumProvider()),
      });

      let fastFillSent = false;
      await getClient().actions.execute({
        quote,
        wallet: walletClient,
        onProgress: ({ txHashes }) => {
          // Optional: fast fill once the deposit is submitted (server decides if it's enabled)
          if (!fastFillSent && id && txHashes?.length) {
            fastFillSent = true;
            fetch("/api/fast-fill", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ requestId: id }),
            });
          }
        },
      });
    } catch (e) {
      setStatus((s) => (s && STATUS_RESPONSE[s]?.terminal ? s : "failure"));
      setStatusDetail(e instanceof Error ? e.message : String(e));
    } finally {
      setTrading(false);
      setAmount("");
    }
  };

  if (!ready) return <main className="shell"><p className="muted">Loading…</p></main>;

  const out = quote?.details?.currencyOut;
  const current = status ? STATUS_RESPONSE[status] : undefined;

  return (
    <main className="shell">
      <header className="top">
        <strong>Unified Balance</strong>
        {authenticated ? (
          <button className="ghost" onClick={logout}>Log out</button>
        ) : (
          <button onClick={login}>Log in with email</button>
        )}
      </header>

      {!authenticated ? (
        <section className="card">
          <h1>One balance. Every chain.</h1>
          <p className="muted">
            Sign up with your email. We create a wallet for you, and every trade settles in and out of
            your USDC balance on Base.
          </p>
        </section>
      ) : (
        <>
          <section className="card">
            <div className="row">
              <span className="muted">{user?.email?.address}</span>
              <button className="ghost small" onClick={refreshBalances}>Refresh</button>
            </div>
            <div className="balance">
              ${homeBalance === undefined ? "…" : Number(formatUnits(homeBalance, HOME.decimals)).toFixed(2)}
            </div>
            <div className="muted small">USDC on Base · {address}</div>
          </section>

          <section className="card">
            <div className="tabs">
              <button className={side === "buy" ? "on" : ""} onClick={() => setSide("buy")}>Buy</button>
              <button className={side === "sell" ? "on" : ""} onClick={() => setSide("sell")}>Sell</button>
            </div>

            <label className="muted small">Token</label>
            <select
              value={tokenKey(token)}
              onChange={(e) => setToken(TOKENS.find((t) => tokenKey(t) === e.target.value)!)}
            >
              {TOKENS.map((t) => (
                <option key={tokenKey(t)} value={tokenKey(t)}>
                  {t.symbol} on {t.chainName}
                </option>
              ))}
            </select>

            <label className="muted small">
              {side === "buy" ? "You pay (USDC)" : `You sell (${token.symbol})`}
              {side === "sell" && tokenBalance !== undefined && (
                <> · balance {Number(formatUnits(tokenBalance, token.decimals)).toPrecision(4)}</>
              )}
            </label>
            <input
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            />

            <div className="quote">
              {quoting && <span className="muted">Getting quote…</span>}
              {quoteError && <span className="error">{quoteError}</span>}
              {out && !quoting && (
                <>
                  <div>
                    You receive ≈ {Number(formatUnits(BigInt(out.amount ?? "0"), outputDecimals)).toPrecision(6)}{" "}
                    {side === "buy" ? token.symbol : "USDC"}
                  </div>
                  <div className="muted small">
                    Minimum {Number(formatUnits(BigInt(out.minimumAmount ?? "0"), outputDecimals)).toPrecision(6)} ·
                    slippage {token.slippageBps / 100}% · quote valid ~30s
                  </div>
                </>
              )}
            </div>

            <button className="primary" disabled={!quote || trading} onClick={trade}>
              {trading ? "Trading…" : side === "buy" ? `Buy ${token.symbol}` : `Sell ${token.symbol}`}
            </button>
          </section>

          {status && (
            <section className="card">
              <div className="row">
                <strong>{current?.label ?? status}</strong>
                {requestId && (
                  <a href={`https://relay.link/transaction/${requestId}`} target="_blank" rel="noreferrer">
                    View on Relay
                  </a>
                )}
              </div>
              <p className="muted small">Your response: {current?.response ?? "Keep tracking."}</p>
              {statusDetail && <p className="error small">{statusDetail}</p>}
            </section>
          )}
        </>
      )}
    </main>
  );
}
