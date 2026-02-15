// Tracks transaction rate per chain and globally using a sliding time window.
// Exposes a smoothly-interpolated activity level (0 = dead, 1 = normal, 2+ = high stress).

const WINDOW_MS = 5000;
const SMOOTHING = 0.08; // EMA factor per update call

interface BucketEntry {
  timestamp: number;
  count: number;
}

interface ChainActivity {
  buckets: BucketEntry[];
  smoothedLevel: number;
  baselineRate: number;
}

class ActivityMonitorImpl {
  private chains: Map<string, ChainActivity> = new Map();
  private globalSmoothed = 1;

  private getChain(chainId: string): ChainActivity {
    let chain = this.chains.get(chainId);
    if (!chain) {
      chain = {
        buckets: [],
        smoothedLevel: 1,
        // Reasonable baseline rates (txs per second) for normalization
        baselineRate: 5,
      };
      this.chains.set(chainId, chain);
    }
    return chain;
  }

  record(chainId: string, txCount: number): void {
    const chain = this.getChain(chainId);
    const now = Date.now();

    chain.buckets.push({ timestamp: now, count: txCount });

    // Prune old buckets
    const cutoff = now - WINDOW_MS;
    while (chain.buckets.length > 0 && chain.buckets[0].timestamp < cutoff) {
      chain.buckets.shift();
    }

    // Compute raw rate (txs/sec) over the window
    const totalTx = chain.buckets.reduce((sum, b) => sum + b.count, 0);
    const rawRate = totalTx / (WINDOW_MS / 1000);

    // Adapt baseline slowly
    chain.baselineRate += (rawRate - chain.baselineRate) * 0.01;
    chain.baselineRate = Math.max(chain.baselineRate, 1);

    // Activity level: ratio to baseline, clamped
    const rawLevel = rawRate / chain.baselineRate;
    chain.smoothedLevel += (rawLevel - chain.smoothedLevel) * SMOOTHING;
  }

  // Returns activity level for a specific chain (0-3+ range, 1 = normal)
  getActivityLevel(chainId?: string): number {
    if (chainId) {
      const chain = this.chains.get(chainId);
      return chain ? chain.smoothedLevel : 1;
    }

    // Global: average across all chains
    if (this.chains.size === 0) return 1;
    let sum = 0;
    for (const chain of this.chains.values()) {
      sum += chain.smoothedLevel;
    }
    const avg = sum / this.chains.size;
    this.globalSmoothed += (avg - this.globalSmoothed) * SMOOTHING;
    return this.globalSmoothed;
  }
}

export const activityMonitor = new ActivityMonitorImpl();
