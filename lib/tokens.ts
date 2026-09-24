// The unified balance every trade settles in and out of.
export const HOME = {
  chainId: 8453,
  chainName: "Base",
  address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  symbol: "USDC",
  decimals: 6,
} as const;

export type Token = {
  chainId: number;
  chainName: string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  // Per-token slippage in bps. Tight for majors, wider for thinly traded tokens.
  // Illustrative values only.
  slippageBps: number;
};

const NATIVE = "0x0000000000000000000000000000000000000000";

export const TOKENS: Token[] = [
  { chainId: 8453, chainName: "Base", address: NATIVE, symbol: "ETH", name: "Ethereum", decimals: 18, slippageBps: 100 },
  { chainId: 42161, chainName: "Arbitrum", address: NATIVE, symbol: "ETH", name: "Ethereum", decimals: 18, slippageBps: 100 },
  { chainId: 10, chainName: "Optimism", address: NATIVE, symbol: "ETH", name: "Ethereum", decimals: 18, slippageBps: 100 },
  { chainId: 8453, chainName: "Base", address: "0x4ed4e862860bed51a9570b96d89af5e1b0efefed", symbol: "DEGEN", name: "Degen", decimals: 18, slippageBps: 500 },
];

export const tokenKey = (t: Pick<Token, "chainId" | "address">) => `${t.chainId}:${t.address}`;
