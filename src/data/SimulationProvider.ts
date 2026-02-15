import { CHAINS } from '../config/chains';
import type { RawTransaction } from './types';

type TransactionCallback = (txs: RawTransaction[]) => void;

// Power-law distribution: many small values, few large ones
function powerLaw(min: number, max: number, exponent: number): number {
  const u = Math.random();
  return min * Math.pow((max / min), Math.pow(u, exponent));
}

export class SimulationProvider {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private chainId: string;
  private callback: TransactionCallback;
  private counter = 0;
  // Bursty activity state
  private burstCooldown = 0;
  private baseGas = 30;

  constructor(chainId: string, callback: TransactionCallback) {
    this.chainId = chainId;
    this.callback = callback;
  }

  start(): void {
    const config = CHAINS[this.chainId];
    const whaleThreshold = config?.whaleThreshold ?? 5;
    const blockTime = config?.blockTime ?? 12;

    // Scale tick timing by block time relative to a "standard" 2s chain
    // Faster chains (Arbitrum 0.25s) tick very frequently with small batches
    // Slower chains (Ethereum 12s) tick less often but deliver bigger batches
    const speedFactor = Math.max(0.1, 2 / blockTime); // >1 for fast chains, <1 for slow

    const tick = () => {
      // Bursty batch sizes scaled by block time
      // Slow chains (Ethereum) get bigger batches to compensate for less frequent ticks
      const batchScale = Math.max(1, blockTime / 2);
      let batchSize: number;
      if (this.burstCooldown > 0) {
        batchSize = Math.floor((Math.random() * 15 + 8) * batchScale);
        this.burstCooldown--;
      } else if (Math.random() < 0.08) {
        // 8% chance of burst
        batchSize = Math.floor((Math.random() * 20 + 10) * batchScale);
        this.burstCooldown = Math.floor(Math.random() * 3) + 1;
      } else {
        batchSize = Math.floor((Math.random() * 6 + 1) * batchScale);
      }

      // Gas price drifts over time (mean-reverting random walk)
      this.baseGas += (Math.random() - 0.5) * 8;
      this.baseGas = Math.max(5, Math.min(200, this.baseGas));

      const txs: RawTransaction[] = [];

      for (let i = 0; i < batchSize; i++) {
        // Power-law value distribution
        const valueInToken = powerLaw(0.001, 100, 2.5);
        const isWhale = valueInToken >= whaleThreshold;

        // Whale values should be convincingly large
        const finalValue = isWhale
          ? whaleThreshold + powerLaw(1, whaleThreshold * 10, 1.5)
          : valueInToken;

        const value = BigInt(Math.floor(finalValue * 1000)) * 10n ** 15n;

        // Gas price correlates with activity + random jitter
        const gasMult = this.burstCooldown > 0 ? 1.5 : 1;
        const gasPrice = BigInt(
          Math.floor((this.baseGas * gasMult + (Math.random() - 0.3) * 20) * 1e9),
        );

        txs.push({
          hash: `0x${(this.counter++).toString(16).padStart(64, 'a')}`,
          from: `0x${Math.random().toString(16).slice(2).padEnd(40, '0')}`,
          to:
            Math.random() > 0.05
              ? `0x${Math.random().toString(16).slice(2).padEnd(40, '0')}`
              : null,
          value,
          gasPrice: gasPrice < 0n ? 10000000000n : gasPrice,
          gasLimit: BigInt(Math.floor(Math.random() * 500000 + 21000)),
          blockNumber: Math.floor(Date.now() / 12000),
          chainId: this.chainId,
          timestamp: Math.floor(Date.now() / 1000),
        });
      }

      this.callback(txs);

      // Variable timing scaled by chain speed
      // Fast chains (Arbitrum): ~100-400ms ticks
      // Medium chains (Polygon): ~250-1000ms ticks
      // Slow chains (Ethereum): ~800-2500ms ticks, but bigger batches above
      const baseDelay = this.burstCooldown > 0
        ? 200 + Math.random() * 400
        : 500 + Math.random() * 2000;
      const delay = Math.min(baseDelay / speedFactor, 3000);
      this.timeoutId = setTimeout(tick, delay);
    };

    tick();
  }

  stop(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
