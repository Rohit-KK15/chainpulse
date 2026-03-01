const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price';

const TOKEN_IDS: Record<string, string> = {
  ETH: 'ethereum',
  MATIC: 'matic-network',
  ARB: 'arbitrum',
  USDC: 'usd-coin',
  USDT: 'tether',
  DAI: 'dai',
  WETH: 'weth',
  WBTC: 'wrapped-bitcoin',
};

let priceCache: Record<string, number> = {};
let lastFetch = 0;
const CACHE_TTL = 60_000; // 60 seconds

export async function fetchPrices(): Promise<Record<string, number>> {
  const now = Date.now();
  if (now - lastFetch < CACHE_TTL && Object.keys(priceCache).length > 0) {
    return priceCache;
  }

  const ids = Object.values(TOKEN_IDS).join(',');
  try {
    const res = await fetch(`${COINGECKO_API}?ids=${ids}&vs_currencies=usd`);
    if (!res.ok) return priceCache;
    const data = await res.json();

    const prices: Record<string, number> = {};
    for (const [symbol, geckoId] of Object.entries(TOKEN_IDS)) {
      if (data[geckoId]?.usd) {
        prices[symbol] = data[geckoId].usd;
      }
    }

    priceCache = prices;
    lastFetch = now;
    return prices;
  } catch {
    return priceCache;
  }
}

export function getCachedPrice(symbol: string): number | null {
  return priceCache[symbol.toUpperCase()] ?? null;
}

export function formatUsdValue(value: number, symbol: string): string | null {
  const price = getCachedPrice(symbol);
  if (price === null) return null;
  const usd = value * price;
  if (usd < 0.01) return '<$0.01';
  if (usd < 1) return `$${usd.toFixed(2)}`;
  if (usd < 1_000) return `$${usd.toFixed(2)}`;
  if (usd < 1_000_000) return `$${(usd / 1_000).toFixed(1)}K`;
  if (usd < 1_000_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  return `$${(usd / 1_000_000_000).toFixed(2)}B`;
}
