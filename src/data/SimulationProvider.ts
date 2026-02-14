import type { RawTransaction } from './types';

type TransactionCallback = (txs: RawTransaction[]) => void;

export class SimulationProvider {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private chainId: string;
  private callback: TransactionCallback;
  private counter = 0;

  constructor(chainId: string, callback: TransactionCallback) {
    this.chainId = chainId;
    this.callback = callback;
  }

  start(): void {
    const tick = () => {
      const batchSize = Math.floor(Math.random() * 8) + 2;
      const txs: RawTransaction[] = [];

      for (let i = 0; i < batchSize; i++) {
        const isWhale = Math.random() < 0.04;
        const value = isWhale
          ? BigInt(Math.floor(Math.random() * 50 + 5)) * 10n ** 18n
          : BigInt(Math.floor(Math.random() * 4000)) * 10n ** 15n;

        const gasPrice =
          BigInt(Math.floor(Math.random() * 100 + 10)) * 10n ** 9n;

        txs.push({
          hash: `0x${(this.counter++).toString(16).padStart(64, 'a')}`,
          from: `0x${Math.random().toString(16).slice(2).padEnd(40, '0')}`,
          to:
            Math.random() > 0.05
              ? `0x${Math.random().toString(16).slice(2).padEnd(40, '0')}`
              : null,
          value,
          gasPrice,
          gasLimit: BigInt(Math.floor(Math.random() * 500000 + 21000)),
          blockNumber: Math.floor(Date.now() / 12000),
          chainId: this.chainId,
          timestamp: Math.floor(Date.now() / 1000),
        });
      }

      this.callback(txs);

      const delay = 500 + Math.random() * 2000;
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
