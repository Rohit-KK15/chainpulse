import { CHAINS } from '../config/chains';
import { getTokenWhaleThreshold } from '../config/tokenRegistry';
import { getCachedPrice } from '../data/PriceFeed';
import { useStore } from '../stores/useStore';

const STABLECOIN_SYMBOLS = new Set(['USDT', 'USDC', 'DAI']);

const WINDOW_SIZE = 200;
const COOLDOWN_MS = 3000;
const PERCENTILE = 0.95;
const PERCENTILE_MULTIPLIER = 2.0;

interface ChainState {
  values: number[];
  head: number;
  fill: number;
  sorted: number[];
  sortDirty: boolean;
  lastWhaleTime: number;
}

class AdaptiveWhaleDetectorImpl {
  private chains: Map<string, ChainState> = new Map();

  private getState(chainId: string): ChainState {
    let state = this.chains.get(chainId);
    if (!state) {
      state = {
        values: new Array(WINDOW_SIZE).fill(0),
        head: 0,
        fill: 0,
        sorted: [],
        sortDirty: true,
        lastWhaleTime: 0,
      };
      this.chains.set(chainId, state);
    }
    return state;
  }

  recordValue(chainId: string, valueInToken: number): void {
    const state = this.getState(chainId);
    state.values[state.head] = valueInToken;
    state.head = (state.head + 1) % WINDOW_SIZE;
    if (state.fill < WINDOW_SIZE) state.fill++;
    state.sortDirty = true;
  }

  getThreshold(key: string): number {
    // Key may be "chainId" or "chainId:symbol" for token transfers
    const parts = key.split(':');
    const chainId = parts[0];
    const tokenSymbol = parts[1];
    let staticThreshold: number;
    if (tokenSymbol) {
      staticThreshold = getTokenWhaleThreshold(chainId, tokenSymbol) ?? 5;
    } else {
      staticThreshold = CHAINS[chainId]?.whaleThreshold ?? 5;
    }
    const state = this.chains.get(key);
    if (!state || state.fill < 20) return this.applyUserFloor(staticThreshold, chainId, tokenSymbol);

    // Lazily sort for percentile calculation
    if (state.sortDirty) {
      state.sorted = state.values.slice(0, state.fill).sort((a, b) => a - b);
      state.sortDirty = false;
    }

    const p95Index = Math.floor(state.sorted.length * PERCENTILE);
    const p95Value = state.sorted[Math.min(p95Index, state.sorted.length - 1)];
    const adaptiveThreshold = p95Value * PERCENTILE_MULTIPLIER;

    return this.applyUserFloor(Math.max(staticThreshold, adaptiveThreshold), chainId, tokenSymbol);
  }

  /** Apply user-set USD whale threshold as a floor.
   *  Converts the USD threshold to token units using the cached price feed. */
  private applyUserFloor(threshold: number, chainId: string, tokenSymbol?: string): number {
    const userUsd = useStore.getState().whaleThresholdUsd;
    if (userUsd <= 0) return threshold;

    if (tokenSymbol && STABLECOIN_SYMBOLS.has(tokenSymbol)) {
      return Math.max(threshold, userUsd);
    }

    // For non-stablecoins and native currencies, convert USD to token amount via price feed
    const symbol = tokenSymbol ?? CHAINS[chainId]?.nativeCurrency;
    if (symbol) {
      const price = getCachedPrice(symbol);
      if (price && price > 0) {
        const tokenThreshold = userUsd / price;
        return Math.max(threshold, tokenThreshold);
      }
    }

    return threshold;
  }

  isWhale(chainId: string, valueInToken: number): boolean {
    const state = this.getState(chainId);
    const now = Date.now();

    // Cooldown: suppress whale triggers shortly after the last one
    if (now - state.lastWhaleTime < COOLDOWN_MS) {
      // During cooldown, require 2x the threshold to break through
      const threshold = this.getThreshold(chainId) * 2;
      if (valueInToken >= threshold) {
        state.lastWhaleTime = now;
        return true;
      }
      return false;
    }

    const threshold = this.getThreshold(chainId);
    if (valueInToken >= threshold) {
      state.lastWhaleTime = now;
      return true;
    }
    return false;
  }
}

export const adaptiveWhaleDetector = new AdaptiveWhaleDetectorImpl();
