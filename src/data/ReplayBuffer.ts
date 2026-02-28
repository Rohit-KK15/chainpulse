import type { RawTransaction, ProcessedTransaction } from './types';
import { mapTransaction } from '../processing/TransactionMapper';
import { txQueue } from '../processing/TransactionQueue';

export type ReplaySpeed = 1 | 5 | 20;

export class ReplayBuffer {
  private transactions: RawTransaction[] = [];
  private processed: ProcessedTransaction[] = [];
  private cursor = 0;
  private playing = false;
  private speed: ReplaySpeed = 5;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onProgress?: (cursor: number, total: number) => void;

  load(txs: RawTransaction[]) {
    this.stop();
    this.transactions = txs;
    this.processed = txs.map(mapTransaction);
    this.cursor = 0;
  }

  get length() { return this.transactions.length; }
  get position() { return this.cursor; }
  get isPlaying() { return this.playing; }
  get currentSpeed() { return this.speed; }

  setSpeed(s: ReplaySpeed) { this.speed = s; }

  setOnProgress(cb: (cursor: number, total: number) => void) {
    this.onProgress = cb;
  }

  seek(position: number) {
    this.cursor = Math.max(0, Math.min(position, this.processed.length - 1));
    this.onProgress?.(this.cursor, this.processed.length);
  }

  play() {
    if (this.processed.length === 0) return;
    this.playing = true;
    this.tick();
  }

  pause() {
    this.playing = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  stop() {
    this.pause();
    this.cursor = 0;
    this.onProgress?.(0, this.processed.length);
  }

  private tick() {
    if (!this.playing || this.cursor >= this.processed.length) {
      this.playing = false;
      return;
    }

    // Emit a batch of transactions based on speed
    const batchSize = this.speed;
    const batch = this.processed.slice(this.cursor, this.cursor + batchSize);
    txQueue.push(batch);

    this.cursor += batch.length;
    this.onProgress?.(this.cursor, this.processed.length);

    if (this.cursor >= this.processed.length) {
      this.playing = false;
      return;
    }

    // Compute delay: time gap between current and next tx, compressed by speed
    const currentTs = this.processed[this.cursor - 1]?.timestamp ?? 0;
    const nextTs = this.processed[this.cursor]?.timestamp ?? 0;
    const gap = Math.max(0, nextTs - currentTs);
    const delay = Math.min(Math.max(gap * 1000 / (this.speed * 10), 50), 500);

    this.timer = setTimeout(() => this.tick(), delay);
  }

  clear() {
    this.stop();
    this.transactions = [];
    this.processed = [];
    this.cursor = 0;
  }
}

export const replayBuffer = new ReplayBuffer();
