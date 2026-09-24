import { arbitrum, base, mainnet, optimism, type Chain } from "viem/chains";

export const CHAINS: [Chain, ...Chain[]] = [base, arbitrum, optimism, mainnet];

export const VIEM_CHAINS: Record<number, Chain> = Object.fromEntries(CHAINS.map((c) => [c.id, c]));
