import type { ProcessedTransaction } from '../data/types';

class TransactionQueue {
  private queue: ProcessedTransaction[] = [];
  private static MAX_SIZE = 300;
  private static TRIM_TARGET = 150;

  push(txs: ProcessedTransaction[]): void {
    this.queue.push(...txs);
    if (this.queue.length > TransactionQueue.MAX_SIZE) {
      // Partition into whales and non-whales, only trim non-whales
      const whales: ProcessedTransaction[] = [];
      const normal: ProcessedTransaction[] = [];
      for (const tx of this.queue) {
        if (tx.isWhale) whales.push(tx);
        else normal.push(tx);
      }
      const normalKeep = Math.max(TransactionQueue.TRIM_TARGET - whales.length, 0);
      this.queue = [...whales, ...normal.slice(-normalKeep)];
    }
  }

  get size(): number {
    return this.queue.length;
  }

  drain(count: number = 5): ProcessedTransaction[] {
    return this.queue.splice(0, count);
  }

  clear(): void {
    this.queue.length = 0;
  }
}

export const txQueue = new TransactionQueue();
