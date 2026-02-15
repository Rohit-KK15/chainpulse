import { WebSocketProvider } from 'ethers';
import { CHAINS } from '../config/chains';
import type { RawTransaction } from './types';

type TransactionCallback = (txs: RawTransaction[]) => void;
type StatusCallback = (status: 'connected' | 'error') => void;

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 2000;

export class ConnectionManager {
  private provider: WebSocketProvider | null = null;
  private chainId: string;
  private callback: TransactionCallback;
  private onStatus: StatusCallback | null = null;
  private destroyed = false;
  private receivedFirstBlock = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(chainId: string, callback: TransactionCallback) {
    this.chainId = chainId;
    this.callback = callback;
  }

  setStatusCallback(cb: StatusCallback): void {
    this.onStatus = cb;
  }

  async connect(): Promise<void> {
    if (this.destroyed) return;

    const config = CHAINS[this.chainId];
    if (!config) throw new Error(`Unknown chain: ${this.chainId}`);

    this.cleanupProvider();
    this.provider = new WebSocketProvider(config.rpcWs);

    // Verify the connection is actually alive by requesting the network
    try {
      await this.provider.getNetwork();
    } catch {
      this.handleDisconnect();
      return;
    }

    if (this.destroyed) {
      this.cleanupProvider();
      return;
    }

    // Reset reconnect counter on successful connect
    this.reconnectAttempts = 0;
    this.receivedFirstBlock = false;

    // Monitor for WebSocket close/error to trigger reconnection
    const ws = this.provider.websocket as WebSocket | undefined;
    if (ws) {
      ws.addEventListener('close', () => {
        if (!this.destroyed) this.handleDisconnect();
      });
      ws.addEventListener('error', () => {
        if (!this.destroyed) this.handleDisconnect();
      });
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
        this.handleDisconnect();
      }
    }, timeout);
  }

  private handleDisconnect(): void {
    if (this.destroyed) return;

    this.cleanupProvider();
    this.onStatus?.('error');

    if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const delay = BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts);
      this.reconnectAttempts++;
      console.warn(
        `[ChainPulse] ${this.chainId} disconnected, reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`,
      );
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect().catch(() => this.handleDisconnect());
      }, delay);
    } else {
      console.warn(
        `[ChainPulse] ${this.chainId} max reconnect attempts reached, giving up`,
      );
    }
  }

  private cleanupProvider(): void {
    if (this.provider) {
      this.provider.removeAllListeners();
      this.provider.destroy();
      this.provider = null;
    }
  }

  disconnect(): void {
    this.destroyed = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanupProvider();
  }
}
