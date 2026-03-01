import { CHAINS } from '../config/chains';

export interface CachedToken {
  address: string;   // lowercase
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  chainId: string;   // our internal chain ID
}

interface CoinGeckoToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

interface CoinGeckoTokenList {
  tokens: CoinGeckoToken[];
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const STORAGE_PREFIX = 'chainpulse_tokens_';

// In-memory cache: chainId → (lowercase address → CachedToken)
const memoryCache = new Map<string, Map<string, CachedToken>>();

// Symbol index for fast search: chainId → (lowercase symbol/name fragment → CachedToken[])
const symbolIndex = new Map<string, CachedToken[]>();

let initialized = false;

function getStorageKey(chainId: string): string {
  return `${STORAGE_PREFIX}${chainId}`;
}

function loadFromLocalStorage(chainId: string): CachedToken[] | null {
  try {
    const raw = localStorage.getItem(getStorageKey(chainId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.expiry && Date.now() > parsed.expiry) {
      localStorage.removeItem(getStorageKey(chainId));
      return null;
    }
    return parsed.tokens as CachedToken[];
  } catch {
    return null;
  }
}

function saveToLocalStorage(chainId: string, tokens: CachedToken[]): void {
  try {
    localStorage.setItem(getStorageKey(chainId), JSON.stringify({
      tokens,
      expiry: Date.now() + CACHE_TTL_MS,
    }));
  } catch {
    // Quota exceeded — ignore
  }
}

function populateMemoryCache(chainId: string, tokens: CachedToken[]): void {
  const addressMap = new Map<string, CachedToken>();
  for (const t of tokens) {
    addressMap.set(t.address.toLowerCase(), t);
  }
  memoryCache.set(chainId, addressMap);
  symbolIndex.set(chainId, tokens);
}

async function fetchTokenList(chainId: string, platformId: string): Promise<CachedToken[]> {
  const url = `https://tokens.coingecko.com/${platformId}/all.json`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data: CoinGeckoTokenList = await resp.json();

  return data.tokens.map((t) => ({
    address: t.address.toLowerCase(),
    symbol: t.symbol,
    name: t.name,
    decimals: t.decimals,
    logoURI: t.logoURI,
    chainId,
  }));
}

export async function initTokenLists(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const chains = Object.values(CHAINS);
  const promises = chains.map(async (chain) => {
    // Try localStorage first
    const cached = loadFromLocalStorage(chain.id);
    if (cached && cached.length > 0) {
      populateMemoryCache(chain.id, cached);
      return;
    }

    // No CoinGecko platform → skip fetch
    if (!chain.coingeckoPlatformId) return;

    try {
      const tokens = await fetchTokenList(chain.id, chain.coingeckoPlatformId);
      populateMemoryCache(chain.id, tokens);
      saveToLocalStorage(chain.id, tokens);
    } catch {
      // Fetch failed — hardcoded registry will be used as fallback
    }
  });

  await Promise.allSettled(promises);
}

/** Look up a token by address from the CoinGecko cache */
export function lookupCachedToken(chainId: string, address: string): CachedToken | null {
  const chain = memoryCache.get(chainId);
  if (!chain) return null;
  return chain.get(address.toLowerCase()) ?? null;
}

/** Search tokens by symbol or name substring, filtered to enabled chains */
export function searchTokens(query: string, enabledChainIds: string[]): CachedToken[] {
  if (!query || query.length < 1) return [];
  const q = query.toLowerCase();
  const results: CachedToken[] = [];
  const maxResults = 50;

  for (const chainId of enabledChainIds) {
    const tokens = symbolIndex.get(chainId);
    if (!tokens) continue;
    for (const t of tokens) {
      if (results.length >= maxResults) break;
      if (t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)) {
        results.push(t);
      }
    }
    if (results.length >= maxResults) break;
  }

  return results;
}
