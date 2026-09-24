"use client";
// Token logos come from many hosts, so plain <img> is simpler than next/image here.
/* eslint-disable @next/next/no-img-element */

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { getClient, type Execute } from "@relayprotocol/relay-sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPublicClient, createWalletClient, custom, erc20Abi, formatUnits, http, parseUnits } from "viem";
import { VIEM_CHAINS } from "@/lib/chains";
import { CATEGORY_LABEL, HOME, TOKENS, tokenKey, type Category, type Token } from "@/lib/tokens";

const NATIVE = "0x0000000000000000000000000000000000000000";

// What each status means for your UI. Mirrors the table in the Unified Balance guide.
const STATUS_RESPONSE: Record<string, { label: string; response: string; terminal?: boolean }> = {
  waiting: { label: "Waiting for deposit", response: "Show the trade as pending." },
  depositing: { label: "Depositing", response: "Keep showing the trade as pending." },
  pending: { label: "Filling", response: "Keep showing the trade as pending." },
  submitted: { label: "Almost done", response: "Show the trade as nearly complete." },
  success: { label: "Done", response: "Update the balance and stop tracking.", terminal: true },
  failure: { label: "Failed", response: "Show the failure reason and check for a refund.", terminal: true },
  refund: { label: "Refunded", response: "Show the trade as refunded, not failed.", terminal: true },
};

const BUY_PRESETS_USD = [5, 10, 25];
const PERCENTS = [10, 25, 50, 100];

type Balances = Record<string, bigint>;

// Reads USDC plus every listed token, one multicall per chain.
async function readBalances(owner: `0x${string}`): Promise<Balances> {
  const all = [HOME, ...TOKENS];
  const byChain = new Map<number, typeof all>();
  for (const t of all) byChain.set(t.chainId, [...(byChain.get(t.chainId) ?? []), t]);

  const out: Balances = {};
  await Promise.all(
    [...byChain].map(async ([chainId, tokens]) => {
      const client = createPublicClient({ chain: VIEM_CHAINS[chainId], transport: http() });
      const erc20s = tokens.filter((t) => t.address !== NATIVE);
      const [native, results] = await Promise.all([
        tokens.some((t) => t.address === NATIVE) ? client.getBalance({ address: owner }) : undefined,
        client.multicall({
          allowFailure: true,
          contracts: erc20s.map((t) => ({
            address: t.address as `0x${string}`,
            abi: erc20Abi,
            functionName: "balanceOf" as const,
            args: [owner] as const,
          })),
        }),
      ]);
      if (native !== undefined) out[`${chainId}:${NATIVE}`] = native;
      erc20s.forEach((t, i) => {
        const r = results[i];
        if (r.status === "success") out[tokenKey(t)] = r.result as bigint;
      });
    }),
  );
  return out;
}

async function fetchPrice(t: Pick<Token, "chainId" | "address">): Promise<number | undefined> {
  const res = await fetch(`/api/relay/currencies/token/price?chainId=${t.chainId}&address=${t.address}`);
  if (!res.ok) return undefined;
  return (await res.json()).price;
}

const usd = (n?: number) =>
  n === undefined ? "…" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n < 1 ? 4 : 2 });
const amt = (v: bigint, decimals: number) => {
  const n = Number(formatUnits(v, decimals));
  return n === 0 ? "0" : n < 0.0001 ? n.toExponential(2) : n.toLocaleString("en-US", { maximumFractionDigits: 6 });
};

export default function Home() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets.find((w) => w.walletClientType === "privy");
  const address = wallet?.address as `0x${string}` | undefined;

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [token, setToken] = useState<Token>(TOKENS[0]);
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState("");
  const [amount, setAmount] = useState("");
  const [balances, setBalances] = useState<Balances>({});
  const [balanceNonce, setBalanceNonce] = useState(0);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [showFees, setShowFees] = useState(false);
  // Each quote result is tied to the inputs it was requested for, so a stale
  // quote is never shown after the user edits the trade.
  const [quoteResult, setQuoteResult] = useState<{ key: string; quote?: Execute; error?: string }>();
  const [trading, setTrading] = useState(false);
  const [status, setStatus] = useState<string>();
  const [statusDetail, setStatusDetail] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [pendingUsd, setPendingUsd] = useState<number>();
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const inputDecimals = side === "buy" ? HOME.decimals : token.decimals;
  const outputDecimals = side === "buy" ? token.decimals : HOME.decimals;
  const homeBalance = balances[tokenKey(HOME)];
  const tokenBalance = balances[tokenKey(token)];
  const inputBalance = side === "buy" ? homeBalance : tokenBalance;
  const refreshBalances = useCallback(() => setBalanceNonce((n) => n + 1), []);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    readBalances(address).then((b) => !cancelled && setBalances(b));
    return () => {
      cancelled = true;
    };
  }, [address, balanceNonce]);

  // Prices for anything the user holds, loaded once per balance refresh
  useEffect(() => {
    const held = TOKENS.filter((t) => (balances[tokenKey(t)] ?? BigInt(0)) > BigInt(0));
    let cancelled = false;
    Promise.all(held.map(async (t) => [tokenKey(t), await fetchPrice(t)] as const)).then((rows) => {
      if (cancelled) return;
      const found = rows.filter((r): r is readonly [string, number] => r[1] !== undefined);
      setPrices((p) => ({ ...p, ...Object.fromEntries(found) }));
    });
    return () => {
      cancelled = true;
    };
  }, [balances]);

  // Live price for the selected token, refreshed every 5 seconds
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetchPrice(token).then((p) => !cancelled && p !== undefined && setPrices((s) => ({ ...s, [tokenKey(token)]: p })));
    load();
    const id = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token]);

  let units: bigint | undefined;
  try {
    units = amount && Number(amount) > 0 ? parseUnits(amount, inputDecimals) : undefined;
  } catch {
    units = undefined;
  }
  const insufficient = units !== undefined && inputBalance !== undefined && units > inputBalance;
  const quoteKey = address && units && !insufficient ? `${address}|${side}|${tokenKey(token)}|${units}` : undefined;
  const quote = quoteResult?.key === quoteKey ? quoteResult?.quote : undefined;
  const quoteError = quoteResult?.key === quoteKey ? quoteResult?.error : undefined;
  const quoting = !!quoteKey && quoteResult?.key !== quoteKey;

  // 1. Quote from the backend, debounced so each edit produces one quote call
  useEffect(() => {
    if (!quoteKey || !address || !units) return;
    const body = JSON.stringify({ user: address, side, token: tokenKey(token), amount: units.toString() });
    const timer = setTimeout(async () => {
      const res = await fetch("/api/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body });
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
  const track = useCallback(
    (id: string) => {
      clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const res = await fetch(`/api/relay/intents/status/v3?requestId=${id}`);
        if (!res.ok) return;
        const data = await res.json();
        setStatus(data.status);
        setStatusDetail(data.details);
        if (STATUS_RESPONSE[data.status]?.terminal) {
          clearInterval(pollRef.current);
          setPendingUsd(undefined);
          refreshBalances();
        }
      }, 1000);
    },
    [refreshBalances],
  );

  useEffect(() => () => clearInterval(pollRef.current), []);

  // 2. Sign and submit with the embedded wallet (no wallet prompt)
  const trade = async () => {
    if (!wallet || !quote) return;
    setTrading(true);
    setStatus("waiting");
    setStatusDetail(undefined);

    // Sells feel instant: show the proceeds as a pending balance right away
    if (side === "sell") setPendingUsd(Number(quote.details?.currencyOut?.amountUsd ?? 0));

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
      setPendingUsd(undefined);
    } finally {
      setTrading(false);
      setAmount("");
    }
  };

  const setPercent = (pct: number) => {
    if (inputBalance === undefined) return;
    const v = (inputBalance * BigInt(pct)) / BigInt(100);
    setAmount(formatUnits(v, inputDecimals));
  };

  const holdings = useMemo(
    () =>
      TOKENS.filter((t) => (balances[tokenKey(t)] ?? BigInt(0)) > BigInt(0)).map((t) => {
        const bal = balances[tokenKey(t)];
        const price = prices[tokenKey(t)];
        return { t, bal, value: price === undefined ? undefined : Number(formatUnits(bal, t.decimals)) * price };
      }),
    [balances, prices],
  );

  const pickerTokens = TOKENS.filter((t) =>
    `${t.symbol} ${t.name} ${t.chainName}`.toLowerCase().includes(search.toLowerCase()),
  );

  if (!ready) return <main className="shell"><p className="muted">Loading…</p></main>;

  const out = quote?.details?.currencyOut;
  const fees = quote?.fees;
  // feeSponsorship is on the /quote/v2 response but not yet on the SDK's Execute type
  const sponsorship = (quote as { feeSponsorship?: { quoted?: { sponsoredTotal?: { amountUsd?: string } } } } | undefined)
    ?.feeSponsorship;
  const sponsoredUsd = Number(sponsorship?.quoted?.sponsoredTotal?.amountUsd ?? 0);
  const current = status ? STATUS_RESPONSE[status] : undefined;
  const livePrice = prices[tokenKey(token)];

  return (
    <main className="shell">
      <header className="top">
        <strong className="brand">◎ Unified Balance</strong>
        {authenticated ? (
          <button className="ghost small" onClick={logout}>Log out</button>
        ) : (
          <button onClick={login}>Log in</button>
        )}
      </header>

      {!authenticated ? (
        <section className="card hero">
          <h1>One balance. Every chain.</h1>
          <p className="muted">
            Sign up with your email. We create a wallet for you, and every trade settles in and out of your USDC
            balance, with no wallet pop-ups.
          </p>
          <button className="primary" onClick={login}>Sign up with email</button>
        </section>
      ) : (
        <>
          <section className="card">
            <div className="row">
              <span className="muted small">Cash balance</span>
              <button className="ghost small" onClick={refreshBalances}>Refresh</button>
            </div>
            <div className="balance">
              {homeBalance === undefined ? "…" : usd(Number(formatUnits(homeBalance, HOME.decimals)))}
            </div>
            {pendingUsd !== undefined && <div className="pending">+{usd(pendingUsd)} pending</div>}
            <div className="muted small">{user?.email?.address} · USDC on Base · {address}</div>
          </section>

          {holdings.length > 0 && (
            <section className="card">
              <span className="muted small">Holdings</span>
              {holdings.map(({ t, bal, value }) => (
                <button
                  key={tokenKey(t)}
                  className="holding"
                  onClick={() => {
                    setToken(t);
                    setSide("sell");
                    setAmount("");
                  }}
                >
                  <img src={t.logo} alt="" width={28} height={28} />
                  <span className="grow">
                    <strong>{t.symbol}</strong> <span className="muted small">{t.chainName}</span>
                    <br />
                    <span className="muted small">{amt(bal, t.decimals)}</span>
                  </span>
                  <span>{usd(value)}</span>
                </button>
              ))}
            </section>
          )}

          <section className="card">
            <div className="tabs">
              <button className={side === "buy" ? "on" : ""} onClick={() => { setSide("buy"); setAmount(""); }}>Buy</button>
              <button className={side === "sell" ? "on" : ""} onClick={() => { setSide("sell"); setAmount(""); }}>Sell</button>
            </div>

            <div className="row">
              <button className="token-button" onClick={() => setPicking(true)}>
                <img src={token.logo} alt="" width={28} height={28} />
                <span>
                  <strong>{token.symbol}</strong>
                  <br />
                  <span className="muted small">{token.chainName}</span>
                </span>
                <span className="muted">▾</span>
              </button>
              <span className="live" title="Live price, refreshed every 5 seconds">
                <span className="dot" /> {usd(livePrice)}
              </span>
            </div>

            <label className="muted small">
              {side === "buy" ? "Amount (USDC)" : `Amount (${token.symbol})`}
              {inputBalance !== undefined && <> · available {amt(inputBalance, inputDecimals)}</>}
            </label>
            <div className="amount">
              {side === "buy" && <span className="muted">$</span>}
              <input
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              />
            </div>

            <div className="chips">
              {side === "buy" &&
                BUY_PRESETS_USD.map((v) => (
                  <button key={v} onClick={() => setAmount(String(v))}>${v}</button>
                ))}
              {PERCENTS.map((p) => (
                <button key={p} onClick={() => setPercent(p)} disabled={!inputBalance}>
                  {p === 100 ? "Max" : `${p}%`}
                </button>
              ))}
            </div>

            <div className="quote">
              {insufficient && <span className="error">Not enough balance</span>}
              {quoting && <span className="muted">Getting the best price…</span>}
              {quoteError && <span className="error">{quoteError}</span>}
              {out && !quoting && (
                <>
                  <div className="receive">
                    You get ≈ <strong>{amt(BigInt(out.amount ?? "0"), outputDecimals)} {side === "buy" ? token.symbol : "USDC"}</strong>
                    <span className="muted"> ({usd(Number(out.amountUsd ?? 0))})</span>
                  </div>
                  <button className="link small" onClick={() => setShowFees((v) => !v)}>
                    Fee details {showFees ? "▴" : "▾"}
                  </button>
                  {showFees && (
                    <table className="fees">
                      <tbody>
                        <tr><td>Network gas</td><td>{usd(Number(fees?.gas?.amountUsd ?? 0))}</td></tr>
                        <tr><td>Relay fee</td><td>{usd(Number(fees?.relayer?.amountUsd ?? 0))}</td></tr>
                        <tr><td>App fee</td><td>{usd(Number(fees?.app?.amountUsd ?? 0))}</td></tr>
                        {sponsoredUsd > 0 && <tr><td>Sponsored</td><td className="good">−{usd(sponsoredUsd)}</td></tr>}
                        <tr><td>Minimum received</td><td>{amt(BigInt(out.minimumAmount ?? "0"), outputDecimals)}</td></tr>
                        <tr><td>Slippage</td><td>{token.slippageBps / 100}%</td></tr>
                        <tr><td>Est. time</td><td>~{quote?.details?.timeEstimate ?? 1}s</td></tr>
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>

            <button className="primary" disabled={!quote || trading} onClick={trade}>
              {trading ? "Trading…" : `${side === "buy" ? "Buy" : "Sell"} ${token.symbol}`}
            </button>
          </section>

          {status && (
            <section className="card">
              <div className="row">
                <strong>{current?.label ?? status}</strong>
                {requestId && (
                  <a href={`https://relay.link/transaction/${requestId}`} target="_blank" rel="noreferrer">
                    View on Relay ↗
                  </a>
                )}
              </div>
              <p className="muted small">Your response: {current?.response ?? "Keep tracking."}</p>
              {statusDetail && <p className="error small">{statusDetail}</p>}
            </section>
          )}
        </>
      )}

      {picking && (
        <div className="sheet" onClick={() => setPicking(false)}>
          <div className="sheet-body" onClick={(e) => e.stopPropagation()}>
            <input autoFocus placeholder="Search tokens" value={search} onChange={(e) => setSearch(e.target.value)} />
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((cat) => {
              const list = pickerTokens.filter((t) => t.category === cat);
              if (!list.length) return null;
              return (
                <div key={cat}>
                  <div className="muted small group">{CATEGORY_LABEL[cat]}</div>
                  {list.map((t) => (
                    <button
                      key={tokenKey(t)}
                      className="holding"
                      onClick={() => {
                        setToken(t);
                        setAmount("");
                        setPicking(false);
                        setSearch("");
                      }}
                    >
                      <img src={t.logo} alt="" width={28} height={28} />
                      <span className="grow">
                        <strong>{t.symbol}</strong> <span className="muted small">{t.name}</span>
                      </span>
                      <span className="muted small">{t.chainName}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <footer className="footer">
        Built with{" "}
        <a href="https://relay.link" target="_blank" rel="noreferrer">Relay</a>
        {" · "}
        <a href="https://docs.relay.link" target="_blank" rel="noreferrer">Docs</a>
      </footer>
    </main>
  );
}
