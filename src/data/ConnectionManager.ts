import { WebSocketProvider } from 'ethers';
import { CHAINS } from '../config/chains';
import type { RawTransaction } from './types';

type TransactionCallback = (txs: RawTransaction[]) => void;
type StatusCallback = (status: 'connected' | 'error') => void;

export class ConnectionManager {
  private provider: WebSocketProvider | null = null;
  private chainId: string;
  private callback: TransactionCallback;
  private onStatus: StatusCallback | null = null;
  private destroyed = false;
  private receivedFirstBlock = false;

  constructor(chainId: string, callback: TransactionCallback) {
    this.chainId = chainId;
    this.callback = callback;
  }

  setStatusCallback(cb: StatusCallback): void {
    this.onStatus = cb;
  }

  async connect(): Promise<void> {
    const config = CHAINS[this.chainId];
    if (!config) throw new Error(`Unknown chain: ${this.chainId}`);

    this.provider = new WebSocketProvider(config.rpcWs);

    // Verify the connection is actually alive by requesting the network
    try {
      await this.provider.getNetwork();
    } catch {
      this.onStatus?.('error');
      throw new Error(`Failed to reach ${config.name} RPC`);
    }

    this.provider.on('block', async (blockNumber: number) => {
      if (this.destroyed) return;

      if (!this.receivedFirstBlock) {
        this.receivedFirstBlock = true;
        this.onStatus?.('connected');
      }

      try {
        const block = await this.provider!.getBlock(blockNumber, true);
        if (!block || this.destroyed) return;

        const txs: RawTransaction[] = [];
        for (const tx of block.prefetchedTransactions) {
          txs.push({
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            value: tx.value,
            gasPrice: tx.gasPrice ?? 0n,
            gasLimit: tx.gasLimit,
            blockNumber: block.number,
            chainId: config.id,
            timestamp: block.timestamp,
          });
        }

        if (txs.length > 0) {
          this.callback(txs);
        }
      } catch (err) {
        console.warn(`[ChainPulse] Error fetching block ${blockNumber}:`, err);
      }
    });

    // If no block arrives within a reasonable window, flag it
    const timeout = Math.max(config.blockTime * 3, 15) * 1000;
    setTimeout(() => {
      if (!this.destroyed && !this.receivedFirstBlock) {
        console.warn(
          `[ChainPulse] No blocks received from ${config.name} after ${timeout / 1000}s`,
        );
        this.onStatus?.('error');
      }
    }, timeout);
  }

  disconnect(): void {
    this.destroyed = true;
    if (this.provider) {
      this.provider.removeAllListeners();
      this.provider.destroy();
      this.provider = null;
    }
  }
}
