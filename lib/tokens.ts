// The unified balance every trade settles in and out of.
export const HOME = {
  chainId: 8453,
  chainName: "Base",
  address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  symbol: "USDC",
  decimals: 6,
} as const;

export type Category = "major" | "meme" | "ecosystem";

export type Token = {
  category: Category;
  chainId: number;
  chainName: string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo: string;
  // Per-token slippage in bps: tight for majors, wider for memecoins.
  // Illustrative values only.
  slippageBps: number;
};

export const CATEGORY_LABEL: Record<Category, string> = {
  major: "Majors",
  meme: "Memecoins",
  ecosystem: "Ecosystem",
};

// Generated from Relay's /currencies/v2 (verified tokens).
export const TOKENS: Token[] = [
  {"category": "major", "chainId": 8453, "chainName": "Base", "address": "0x0000000000000000000000000000000000000000", "symbol": "ETH", "name": "Ether", "decimals": 18, "logo": "https://assets.relay.link/icons/1/light.png", "slippageBps": 100},
  {"category": "major", "chainId": 42161, "chainName": "Arbitrum", "address": "0x0000000000000000000000000000000000000000", "symbol": "ETH", "name": "Ether", "decimals": 18, "logo": "https://assets.relay.link/icons/1/light.png", "slippageBps": 100},
  {"category": "major", "chainId": 10, "chainName": "Optimism", "address": "0x0000000000000000000000000000000000000000", "symbol": "ETH", "name": "Ether", "decimals": 18, "logo": "https://assets.relay.link/icons/1/light.png", "slippageBps": 100},
  {"category": "major", "chainId": 1, "chainName": "Ethereum", "address": "0x0000000000000000000000000000000000000000", "symbol": "ETH", "name": "Ether", "decimals": 18, "logo": "https://assets.relay.link/icons/1/light.png", "slippageBps": 100},
  {"category": "major", "chainId": 8453, "chainName": "Base", "address": "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf", "symbol": "cbBTC", "name": "Coinbase Wrapped BTC", "decimals": 8, "logo": "https://coin-images.coingecko.com/coins/images/40143/large/cbbtc.webp?1726136727", "slippageBps": 100},
  {"category": "major", "chainId": 42161, "chainName": "Arbitrum", "address": "0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f", "symbol": "WBTC", "name": "Wrapped BTC", "decimals": 8, "logo": "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png", "slippageBps": 100},
  {"category": "major", "chainId": 8453, "chainName": "Base", "address": "0x311935cd80b76769bf2ecc9d8ab7635b2139cf82", "symbol": "SOL", "name": "Solana", "decimals": 9, "logo": "https://upload.wikimedia.org/wikipedia/en/b/b9/Solana_logo.png", "slippageBps": 100},
  {"category": "meme", "chainId": 8453, "chainName": "Base", "address": "0x4ed4e862860bed51a9570b96d89af5e1b0efefed", "symbol": "DEGEN", "name": "Degen", "decimals": 18, "logo": "https://coin-images.coingecko.com/coins/images/34515/large/android-chrome-512x512.png?1706198225", "slippageBps": 500},
  {"category": "meme", "chainId": 8453, "chainName": "Base", "address": "0x532f27101965dd16442e59d40670faf5ebb142e4", "symbol": "BRETT", "name": "Brett", "decimals": 18, "logo": "https://coin-images.coingecko.com/coins/images/35529/large/1000050750.png?1709031995", "slippageBps": 500},
  {"category": "meme", "chainId": 8453, "chainName": "Base", "address": "0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4", "symbol": "TOSHI", "name": "Toshi", "decimals": 18, "logo": "https://coin-images.coingecko.com/coins/images/31126/large/Toshi_Logo_-_Circular.png?1721677476", "slippageBps": 500},
  {"category": "meme", "chainId": 1, "chainName": "Ethereum", "address": "0x6982508145454ce325ddbe47a25d4ec3d2311933", "symbol": "PEPE", "name": "Pepe", "decimals": 18, "logo": "https://coin-images.coingecko.com/coins/images/29850/large/pepe-token.jpeg?1696528776", "slippageBps": 500},
  {"category": "ecosystem", "chainId": 8453, "chainName": "Base", "address": "0x940181a94a35a4569e4529a3cdfb74e38fd98631", "symbol": "AERO", "name": "Aerodrome", "decimals": 18, "logo": "https://coin-images.coingecko.com/coins/images/31745/large/token.png?1696530564", "slippageBps": 300},
  {"category": "ecosystem", "chainId": 8453, "chainName": "Base", "address": "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b", "symbol": "VIRTUAL", "name": "Virtual Protocol", "decimals": 18, "logo": "https://coin-images.coingecko.com/coins/images/34057/large/LOGOMARK.png?1708356054", "slippageBps": 300},
  {"category": "ecosystem", "chainId": 8453, "chainName": "Base", "address": "0x1111111111166b7fe7bd91427724b487980afc69", "symbol": "ZORA", "name": "Zora", "decimals": 18, "logo": "https://coin-images.coingecko.com/coins/images/54693/large/zora.jpg?1741094751", "slippageBps": 300},
  {"category": "ecosystem", "chainId": 42161, "chainName": "Arbitrum", "address": "0x912ce59144191c1204e64559fe8253a0e49e6548", "symbol": "ARB", "name": "Arbitrum", "decimals": 18, "logo": "https://arbitrum.foundation/logo.png", "slippageBps": 300},
  {"category": "ecosystem", "chainId": 10, "chainName": "Optimism", "address": "0x4200000000000000000000000000000000000042", "symbol": "OP", "name": "Optimism", "decimals": 18, "logo": "https://ethereum-optimism.github.io/data/OP/logo.png", "slippageBps": 300},
];

export const tokenKey = (t: Pick<Token, "chainId" | "address">) => `${t.chainId}:${t.address}`;
