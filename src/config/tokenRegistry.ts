export interface TokenEntry {
  address: string; // lowercase
  symbol: string;
  decimals: number;
  whaleThreshold: number;
  color: string;
  isStablecoin: boolean;
}

// Curated list of major ERC-20 tokens per chain (chainId => address => entry)
// Unknown tokens are silently dropped to prevent spam/MEV dust from overwhelming display.

const COMMON_TOKENS: Omit<TokenEntry, 'address'>[] = [
  { symbol: 'USDT',  decimals: 6,  whaleThreshold: 100_000, color: '#26A17B', isStablecoin: true },
  { symbol: 'USDC',  decimals: 6,  whaleThreshold: 100_000, color: '#2775CA', isStablecoin: true },
  { symbol: 'DAI',   decimals: 18, whaleThreshold: 100_000, color: '#F5AC37', isStablecoin: true },
  { symbol: 'WETH',  decimals: 18, whaleThreshold: 5,       color: '#EC1C79', isStablecoin: false },
  { symbol: 'WBTC',  decimals: 8,  whaleThreshold: 1,       color: '#F7931A', isStablecoin: false },
  { symbol: 'UNI',   decimals: 18, whaleThreshold: 5_000,   color: '#FF007A', isStablecoin: false },
  { symbol: 'AAVE',  decimals: 18, whaleThreshold: 500,     color: '#B6509E', isStablecoin: false },
  { symbol: 'LINK',  decimals: 18, whaleThreshold: 5_000,   color: '#2A5ADA', isStablecoin: false },
  { symbol: 'LDO',   decimals: 18, whaleThreshold: 50_000,  color: '#00A3FF', isStablecoin: false },
];

// Ethereum mainnet (chainId 1)
const ETHEREUM_TOKENS: Record<string, TokenEntry> = {};
const ethAddresses: Record<string, string> = {
  USDT:  '0xdac17f958d2ee523a2206206994597c13d831ec7',
  USDC:  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  DAI:   '0x6b175474e89094c44da98b954eedeac495271d0f',
  WETH:  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  WBTC:  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
  UNI:   '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
  AAVE:  '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
  LINK:  '0x514910771af9ca656af840dff83e8264ecf986ca',
  LDO:   '0x5a98fcbea516cf06857215779fd812ca3bef1b32',
  stETH: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84',
};
for (const token of COMMON_TOKENS) {
  const addr = ethAddresses[token.symbol];
  if (addr) ETHEREUM_TOKENS[addr] = { ...token, address: addr };
}
// Ethereum-specific
ETHEREUM_TOKENS[ethAddresses.stETH] = {
  address: ethAddresses.stETH, symbol: 'stETH', decimals: 18,
  whaleThreshold: 5, color: '#00A3FF', isStablecoin: false,
};

// Polygon (chainId 137)
const POLYGON_TOKENS: Record<string, TokenEntry> = {};
const polyAddresses: Record<string, string> = {
  USDT:  '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
  USDC:  '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
  DAI:   '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063',
  WETH:  '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
  WBTC:  '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6',
  UNI:   '0xb33eaad8d922b1083446dc23f610c2567fb5180f',
  AAVE:  '0xd6df932a45c0f255f85145f286ea0b292b21c90b',
  LINK:  '0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39',
  LDO:   '0xc3c7d422809852031b44ab29eec9f1eff2a58756',
  POL:   '0x0000000000000000000000000000000000001010',
};
for (const token of COMMON_TOKENS) {
  const addr = polyAddresses[token.symbol];
  if (addr) POLYGON_TOKENS[addr] = { ...token, address: addr };
}
POLYGON_TOKENS[polyAddresses.POL] = {
  address: polyAddresses.POL, symbol: 'POL', decimals: 18,
  whaleThreshold: 25_000, color: '#8247E5', isStablecoin: false,
};

// Arbitrum (chainId 42161)
const ARBITRUM_TOKENS: Record<string, TokenEntry> = {};
const arbAddresses: Record<string, string> = {
  USDT:  '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
  USDC:  '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
  DAI:   '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1',
  WETH:  '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
  WBTC:  '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f',
  UNI:   '0xfa7f8980b0f1e64a2062791cc3b0871572f1f7f0',
  AAVE:  '0xba5ddd1f9d7f570dc94a51479a000e3bce967196',
  LINK:  '0xf97f4df75117a78c1a5a0dbb814af92458539fb4',
  ARB:   '0x912ce59144191c1204e64559fe8253a0e49e6548',
};
for (const token of COMMON_TOKENS) {
  const addr = arbAddresses[token.symbol];
  if (addr) ARBITRUM_TOKENS[addr] = { ...token, address: addr };
}
ARBITRUM_TOKENS[arbAddresses.ARB] = {
  address: arbAddresses.ARB, symbol: 'ARB', decimals: 18,
  whaleThreshold: 50_000, color: '#28A0F0', isStablecoin: false,
};

// Map chain ID string to its token registry
const REGISTRY: Record<string, Record<string, TokenEntry>> = {
  ethereum: ETHEREUM_TOKENS,
  polygon:  POLYGON_TOKENS,
  arbitrum: ARBITRUM_TOKENS,
};

export function lookupToken(chainId: string, contractAddress: string): TokenEntry | null {
  const chain = REGISTRY[chainId];
  if (!chain) return null;
  return chain[contractAddress.toLowerCase()] ?? null;
}

export function getTokenWhaleThreshold(chainId: string, symbol: string): number | null {
  const chain = REGISTRY[chainId];
  if (!chain) return null;
  for (const entry of Object.values(chain)) {
    if (entry.symbol === symbol) return entry.whaleThreshold;
  }
  return null;
}

/** Get all registered tokens for a chain (used by simulation) */
export function getChainTokens(chainId: string): TokenEntry[] {
  const chain = REGISTRY[chainId];
  if (!chain) return [];
  return Object.values(chain);
}
