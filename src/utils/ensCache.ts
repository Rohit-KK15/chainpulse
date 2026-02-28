import { useState, useEffect } from 'react';
import { JsonRpcProvider } from 'ethers';

const MAX_CACHE_SIZE = 500;
const cache = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();

let provider: JsonRpcProvider | null = null;

function getProvider(): JsonRpcProvider {
  if (!provider) {
    provider = new JsonRpcProvider('https://ethereum-rpc.publicnode.com');
  }
  return provider;
}

function evictOldest(): void {
  if (cache.size > MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
}

export async function resolveENS(address: string): Promise<string | null> {
  const lower = address.toLowerCase();

  if (cache.has(lower)) return cache.get(lower) ?? null;

  if (pending.has(lower)) return pending.get(lower)!;

  const promise = (async () => {
    try {
      const name = await getProvider().lookupAddress(address);
      evictOldest();
      cache.set(lower, name);
      return name;
    } catch {
      cache.set(lower, null);
      return null;
    } finally {
      pending.delete(lower);
    }
  })();

  pending.set(lower, promise);
  return promise;
}

export function useENSName(address: string | null | undefined): string | null {
  const [name, setName] = useState<string | null>(() => {
    if (!address) return null;
    return cache.get(address.toLowerCase()) ?? null;
  });

  useEffect(() => {
    if (!address) {
      setName(null);
      return;
    }

    const lower = address.toLowerCase();
    const cached = cache.get(lower);
    if (cached !== undefined) {
      setName(cached);
      return;
    }

    let cancelled = false;
    resolveENS(address).then((resolved) => {
      if (!cancelled) setName(resolved);
    });

    return () => { cancelled = true; };
  }, [address]);

  return name;
}
