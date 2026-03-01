import type { ProcessedTransaction } from '../data/types';

/**
 * Per-chain fair transaction queue.
 *
 * Each chain gets its own sub-queue. Draining uses round-robin across chains
 * so that a single high-throughput chain (e.g. Ethereum with 200+ tx blocks)
 * can't starve others.
 */
class TransactionQueue {
  private chains = new Map<string, ProcessedTransaction[]>();
  private chainOrder: string[] = [];
  private roundRobinIdx = 0;
  private static MAX_PER_CHAIN = 60;
  private static TRIM_TARGET = 30;

  push(txs: ProcessedTransaction[]): void {
    if (txs.length === 0) return;

    // Group by chain
    const grouped = new Map<string, ProcessedTransaction[]>();
    for (const tx of txs) {
      let arr = grouped.get(tx.chainId);
      if (!arr) { arr = []; grouped.set(tx.chainId, arr); }
      arr.push(tx);
    }

    for (const [chainId, batch] of grouped) {
      let q = this.chains.get(chainId);
      if (!q) {
        q = [];
        this.chains.set(chainId, q);
        this.chainOrder.push(chainId);
      }
      q.push(...batch);

      // Trim this chain's queue if too large
      if (q.length > TransactionQueue.MAX_PER_CHAIN) {
        const whales: ProcessedTransaction[] = [];
        const normal: ProcessedTransaction[] = [];
        for (const tx of q) {
          if (tx.isWhale) whales.push(tx);
          else normal.push(tx);
        }
        const normalKeep = Math.max(TransactionQueue.TRIM_TARGET - whales.length, 0);
        this.chains.set(chainId, [...whales, ...normal.slice(-normalKeep)]);
      }
    }
  }

  get size(): number {
    let total = 0;
    for (const q of this.chains.values()) total += q.length;
    return total;
  }

  /**
   * Drain up to `count` transactions using round-robin across chains.
   * This ensures each chain gets fair representation in the particle field.
   */
  drain(count: number = 5): ProcessedTransaction[] {
    const result: ProcessedTransaction[] = [];
    if (this.chainOrder.length === 0) return result;

    let remaining = count;
    let emptyPasses = 0;

    while (remaining > 0 && emptyPasses < this.chainOrder.length) {
      const chainId = this.chainOrder[this.roundRobinIdx % this.chainOrder.length];
      const q = this.chains.get(chainId);

      if (q && q.length > 0) {
        result.push(q.shift()!);
        remaining--;
        emptyPasses = 0;
      } else {
        emptyPasses++;
      }

      this.roundRobinIdx = (this.roundRobinIdx + 1) % this.chainOrder.length;
    }

    return result;
  }

  clear(): void {
    this.chains.clear();
    this.chainOrder = [];
    this.roundRobinIdx = 0;
  }
}

export const txQueue = new TransactionQueue();
