import { CHAINS } from '../config/chains';

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

  getThreshold(chainId: string): number {
    const staticThreshold = CHAINS[chainId]?.whaleThreshold ?? 5;
    const state = this.chains.get(chainId);
    if (!state || state.fill < 20) return staticThreshold;

    // Lazily sort for percentile calculation
    if (state.sortDirty) {
      state.sorted = state.values.slice(0, state.fill).sort((a, b) => a - b);
      state.sortDirty = false;
    }

    const p95Index = Math.floor(state.sorted.length * PERCENTILE);
    const p95Value = state.sorted[Math.min(p95Index, state.sorted.length - 1)];
    const adaptiveThreshold = p95Value * PERCENTILE_MULTIPLIER;

    return Math.max(staticThreshold, adaptiveThreshold);
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
