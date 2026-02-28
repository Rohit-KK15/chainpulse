import { CHAINS } from '../config/chains';
import { getChainTokens, type TokenEntry } from '../config/tokenRegistry';
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

    // Tick interval: all chains emit at a steady ~300-800ms cadence
    // Batch size scales slightly with block time to reflect throughput differences
    const batchBase = blockTime <= 1 ? 3 : blockTime <= 4 ? 2 : 1;

    const tick = () => {
      let batchSize: number;
      if (this.burstCooldown > 0) {
        batchSize = Math.floor(Math.random() * 6 + 4) * batchBase;
        this.burstCooldown--;
      } else if (Math.random() < 0.08) {
        // 8% chance of burst
        batchSize = Math.floor(Math.random() * 8 + 5) * batchBase;
        this.burstCooldown = Math.floor(Math.random() * 3) + 1;
      } else {
        batchSize = Math.floor(Math.random() * 4 + 1) * batchBase;
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
          blockNumber: Math.floor(Date.now() / (blockTime * 1000)),
          chainId: this.chainId,
          timestamp: Math.floor(Date.now() / 1000),
        });
      }

      // ~30% chance to generate 1-3 token transfers per tick
      if (Math.random() < 0.3) {
        const tokens = getChainTokens(this.chainId);
        if (tokens.length > 0) {
          const tokenCount = Math.floor(Math.random() * 3) + 1;
          for (let i = 0; i < tokenCount; i++) {
            const token = tokens[Math.floor(Math.random() * tokens.length)];
            const tokenValue = this.generateTokenValue(token);
            const rawValue = BigInt(Math.floor(tokenValue * Math.pow(10, token.decimals)));

            txs.push({
              hash: `0x${(this.counter++).toString(16).padStart(64, 'b')}`,
              from: `0x${Math.random().toString(16).slice(2).padEnd(40, '0')}`,
              to: `0x${Math.random().toString(16).slice(2).padEnd(40, '0')}`,
              value: 0n,
              gasPrice: BigInt(Math.floor((this.baseGas + (Math.random() - 0.3) * 10) * 1e9)),
              gasLimit: BigInt(Math.floor(Math.random() * 200000 + 50000)),
              blockNumber: Math.floor(Date.now() / (blockTime * 1000)),
              chainId: this.chainId,
              timestamp: Math.floor(Date.now() / 1000),
              tokenTransfer: {
                contractAddress: token.address,
                from: `0x${Math.random().toString(16).slice(2).padEnd(40, '0')}`,
                to: `0x${Math.random().toString(16).slice(2).padEnd(40, '0')}`,
                rawValue,
                symbol: token.symbol,
                decimals: token.decimals,
                color: token.color,
                isStablecoin: token.isStablecoin,
              },
            });
          }
        }
      }

      this.callback(txs);

      // Steady cadence for all chains — smooth real-time feel
      const delay = this.burstCooldown > 0
        ? 200 + Math.random() * 300
        : 400 + Math.random() * 600;
      this.timeoutId = setTimeout(tick, delay);
    };

    tick();
  }

  private generateTokenValue(token: TokenEntry): number {
    if (token.isStablecoin) {
      return powerLaw(1, 50_000, 2.5);
    }
    return powerLaw(0.001, 100, 2.5);
  }

  stop(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
