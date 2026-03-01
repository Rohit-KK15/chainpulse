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

// ── Ethereum mainnet (chainId 1) ──

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
ETHEREUM_TOKENS[ethAddresses.stETH] = {
  address: ethAddresses.stETH, symbol: 'stETH', decimals: 18,
  whaleThreshold: 5, color: '#00A3FF', isStablecoin: false,
};

// ── Polygon (chainId 137) ──

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

// ── Arbitrum (chainId 42161) ──

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

// ── Base (chainId 8453) ──

const BASE_TOKENS: Record<string, TokenEntry> = {};
const baseAddresses: Record<string, string> = {
  USDT:  '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2',
  USDC:  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  DAI:   '0x50c5725949a6f0c72e6c4a641f24049a917db0cb',
  WETH:  '0x4200000000000000000000000000000000000006',
  cbETH: '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22',
  AERO:  '0x940181a94a35a4569e4529a3cdfb74e38fd98631',
};
for (const token of COMMON_TOKENS) {
  const addr = baseAddresses[token.symbol];
  if (addr) BASE_TOKENS[addr] = { ...token, address: addr };
}
BASE_TOKENS[baseAddresses.cbETH] = {
  address: baseAddresses.cbETH, symbol: 'cbETH', decimals: 18,
  whaleThreshold: 5, color: '#0052FF', isStablecoin: false,
};
BASE_TOKENS[baseAddresses.AERO] = {
  address: baseAddresses.AERO, symbol: 'AERO', decimals: 18,
  whaleThreshold: 50_000, color: '#0052FF', isStablecoin: false,
};

// ── Optimism (chainId 10) ──

const OPTIMISM_TOKENS: Record<string, TokenEntry> = {};
const opAddresses: Record<string, string> = {
  USDT:  '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58',
  USDC:  '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
  DAI:   '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1',
  WETH:  '0x4200000000000000000000000000000000000006',
  WBTC:  '0x68f180fcce6836688e9084f035309e29bf0a2095',
  UNI:   '0x6fd9d7ad17242c41f7131d257212c54a0e816691',
  AAVE:  '0x76fb31fb4af56892a25e32cfc43de717950c9278',
  LINK:  '0x350a791bfc2c21f9ed5d10980dad2e2638ffa7f6',
  OP:    '0x4200000000000000000000000000000000000042',
};
for (const token of COMMON_TOKENS) {
  const addr = opAddresses[token.symbol];
  if (addr) OPTIMISM_TOKENS[addr] = { ...token, address: addr };
}
OPTIMISM_TOKENS[opAddresses.OP] = {
  address: opAddresses.OP, symbol: 'OP', decimals: 18,
  whaleThreshold: 50_000, color: '#FF0420', isStablecoin: false,
};

// ── Avalanche (chainId 43114) ──

const AVALANCHE_TOKENS: Record<string, TokenEntry> = {};
const avaxAddresses: Record<string, string> = {
  USDT:  '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7',
  USDC:  '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e',
  DAI:   '0xd586e7f844cea2f87f50152665bcbc2c279d8d70',
  'WETH.e': '0x49d5c2bdffac6ce2bfdb6fd9b3c5c3d7cd90c7e5',
  'WBTC.e': '0x50b7545627a5162f82a992c33b87adc75187b218',
  WAVAX: '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7',
  JOE:   '0x6e84a6216ea6dacc71ee8e6b0a5b7322eebc0fdd',
  LINK:  '0x5947bb275c521040051d82396192181b413227a3',
  AAVE:  '0x63a72806098bd3d9520cc43356dd78afe5d386d9',
};
for (const token of COMMON_TOKENS) {
  const addr = avaxAddresses[token.symbol];
  if (addr) AVALANCHE_TOKENS[addr] = { ...token, address: addr };
}
AVALANCHE_TOKENS[avaxAddresses.WAVAX] = {
  address: avaxAddresses.WAVAX, symbol: 'WAVAX', decimals: 18,
  whaleThreshold: 1_000, color: '#E84142', isStablecoin: false,
};
AVALANCHE_TOKENS[avaxAddresses.JOE] = {
  address: avaxAddresses.JOE, symbol: 'JOE', decimals: 18,
  whaleThreshold: 100_000, color: '#E84142', isStablecoin: false,
};
if (avaxAddresses['WETH.e']) {
  AVALANCHE_TOKENS[avaxAddresses['WETH.e']] = {
    address: avaxAddresses['WETH.e'], symbol: 'WETH.e', decimals: 18,
    whaleThreshold: 5, color: '#EC1C79', isStablecoin: false,
  };
}
if (avaxAddresses['WBTC.e']) {
  AVALANCHE_TOKENS[avaxAddresses['WBTC.e']] = {
    address: avaxAddresses['WBTC.e'], symbol: 'WBTC.e', decimals: 8,
    whaleThreshold: 1, color: '#F7931A', isStablecoin: false,
  };
}

// ── BSC (chainId 56) ──

const BSC_TOKENS: Record<string, TokenEntry> = {};
const bscAddresses: Record<string, string> = {
  USDT:  '0x55d398326f99059ff775485246999027b3197955',
  USDC:  '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
  DAI:   '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3',
  WETH:  '0x2170ed0880ac9a755fd29b2688956bd959f933f8',
  WBTC:  '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c',
  WBNB:  '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
  CAKE:  '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
  UNI:   '0xbf5140a22578168fd562dccf235e5d43a02ce9b1',
  LINK:  '0xf8a0bf9cf54bb92f17374d9e9a321e6a111a51bd',
  AAVE:  '0xfb6115445bff7b52feb98650c87f44907e58f802',
};
for (const token of COMMON_TOKENS) {
  const addr = bscAddresses[token.symbol];
  if (addr) BSC_TOKENS[addr] = { ...token, address: addr };
}
// BSC stablecoins use 18 decimals
BSC_TOKENS[bscAddresses.USDT] = {
  address: bscAddresses.USDT, symbol: 'USDT', decimals: 18,
  whaleThreshold: 100_000, color: '#26A17B', isStablecoin: true,
};
BSC_TOKENS[bscAddresses.USDC] = {
  address: bscAddresses.USDC, symbol: 'USDC', decimals: 18,
  whaleThreshold: 100_000, color: '#2775CA', isStablecoin: true,
};
BSC_TOKENS[bscAddresses.WBNB] = {
  address: bscAddresses.WBNB, symbol: 'WBNB', decimals: 18,
  whaleThreshold: 50, color: '#F0B90B', isStablecoin: false,
};
BSC_TOKENS[bscAddresses.CAKE] = {
  address: bscAddresses.CAKE, symbol: 'CAKE', decimals: 18,
  whaleThreshold: 50_000, color: '#D1884F', isStablecoin: false,
};

// ── Registry map ──

const REGISTRY: Record<string, Record<string, TokenEntry>> = {
  ethereum:     ETHEREUM_TOKENS,
  polygon:      POLYGON_TOKENS,
  arbitrum:     ARBITRUM_TOKENS,
  base:         BASE_TOKENS,
  optimism:     OPTIMISM_TOKENS,
  avalanche:    AVALANCHE_TOKENS,
  bsc:          BSC_TOKENS,
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

/** Popular token symbols per chain for the filter UI */
export const POPULAR_SYMBOLS: Record<string, string[]> = {
  ethereum:    ['ETH', 'USDT', 'USDC', 'DAI', 'WETH', 'WBTC', 'UNI', 'LINK', 'AAVE', 'stETH', 'LDO'],
  polygon:     ['MATIC', 'USDT', 'USDC', 'DAI', 'WETH', 'WBTC', 'UNI', 'LINK', 'AAVE', 'POL'],
  arbitrum:    ['ETH', 'USDT', 'USDC', 'DAI', 'WETH', 'WBTC', 'UNI', 'LINK', 'AAVE', 'ARB'],
  base:        ['ETH', 'USDT', 'USDC', 'DAI', 'WETH', 'cbETH', 'AERO'],
  optimism:    ['ETH', 'USDT', 'USDC', 'DAI', 'WETH', 'WBTC', 'UNI', 'LINK', 'AAVE', 'OP'],
  avalanche:   ['AVAX', 'USDT', 'USDC', 'DAI', 'WETH.e', 'WBTC.e', 'WAVAX', 'JOE', 'LINK', 'AAVE'],
  bsc:         ['BNB', 'USDT', 'USDC', 'DAI', 'WETH', 'WBTC', 'WBNB', 'CAKE', 'UNI', 'LINK', 'AAVE'],
};

/** Get the unique set of all popular symbols across all chains */
export function getAllPopularSymbols(): Set<string> {
  const all = new Set<string>();
  for (const symbols of Object.values(POPULAR_SYMBOLS)) {
    for (const s of symbols) all.add(s);
  }
  return all;
}
