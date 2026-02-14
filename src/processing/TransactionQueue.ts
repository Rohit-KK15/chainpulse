import type { ProcessedTransaction } from '../data/types';

class TransactionQueue {
  private queue: ProcessedTransaction[] = [];

  push(txs: ProcessedTransaction[]): void {
    this.queue.push(...txs);
    if (this.queue.length > 300) {
      this.queue = this.queue.slice(-150);
    }
  }

  drain(count: number = 5): ProcessedTransaction[] {
    return this.queue.splice(0, count);
  }

  clear(): void {
    this.queue.length = 0;
  }
}

export const txQueue = new TransactionQueue();
