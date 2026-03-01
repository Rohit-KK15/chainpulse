import { WebSocketProvider } from 'ethers';
import { CHAINS } from '../config/chains';
import { lookupToken } from '../config/tokenRegistry';
import type { RawTransaction } from './types';

type TransactionCallback = (txs: RawTransaction[]) => void;
type StatusCallback = (status: 'connected' | 'error') => void;

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 2000;

// ERC-20 Transfer(address,address,uint256) topic
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const MAX_TOKEN_TXS_PER_BLOCK = 40;
const MAX_NATIVE_TXS_PER_BLOCK = 50;

export class ConnectionManager {
  private provider: WebSocketProvider | null = null;
  private chainId: string;
  private callback: TransactionCallback;
  private onStatus: StatusCallback | null = null;
  private destroyed = false;
  private receivedFirstBlock = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private blockTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private wsCloseHandler: (() => void) | null = null;
  private wsErrorHandler: (() => void) | null = null;

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
      this.wsCloseHandler = () => {
        if (!this.destroyed) this.handleDisconnect();
      };
      this.wsErrorHandler = () => {
        if (!this.destroyed) this.handleDisconnect();
      };
      ws.addEventListener('close', this.wsCloseHandler);
      ws.addEventListener('error', this.wsErrorHandler);
    }

    this.provider.on('block', async (blockNumber: number) => {
      if (this.destroyed) return;

      if (!this.receivedFirstBlock) {
        this.receivedFirstBlock = true;
        this.onStatus?.('connected');
      }

      try {
        // Fetch block and ERC-20 Transfer logs in parallel
        const [block, logs] = await Promise.all([
          this.provider!.getBlock(blockNumber, true),
          this.provider!.getLogs({
            fromBlock: blockNumber,
            toBlock: blockNumber,
            topics: [TRANSFER_TOPIC],
          }).catch(() => []),
        ]);
        if (!block || this.destroyed) return;

        // Build tx map from block transactions
        const txMap = new Map<string, RawTransaction>();
        for (const tx of block.prefetchedTransactions) {
          txMap.set(tx.hash, {
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

        // Decode ERC-20 Transfer logs and attach to matching txs
        const seen = new Set<string>();
        const tokenOnlyTxs: RawTransaction[] = [];

        for (const log of logs) {
          // Skip if not enough topics (need indexed from, to)
          if (!log.topics || log.topics.length < 3) continue;
          // Skip ERC-721 (data is empty or just 0x for NFTs with tokenId in topic)
          if (!log.data || log.data.length <= 2) continue;

          const contractAddress = log.address.toLowerCase();
          const token = lookupToken(config.id, contractAddress);
          if (!token) continue; // Unknown token — silently drop

          const dedupKey = `${log.transactionHash}:${contractAddress}`;
          if (seen.has(dedupKey)) continue;
          seen.add(dedupKey);

          const from = '0x' + log.topics[1].slice(26);
          const to = '0x' + log.topics[2].slice(26);
          const rawValue = BigInt(log.data);

          const tokenTransfer = {
            contractAddress,
            from,
            to,
            rawValue,
            symbol: token.symbol,
            decimals: token.decimals,
            color: token.color,
            isStablecoin: token.isStablecoin,
          };

          const existingTx = log.transactionHash ? txMap.get(log.transactionHash) : null;
          if (existingTx && !existingTx.tokenTransfer) {
            // Attach to existing tx (first token transfer wins)
            existingTx.tokenTransfer = tokenTransfer;
          } else {
            // Create standalone token tx entry
            tokenOnlyTxs.push({
              hash: log.transactionHash ?? `0xlog_${log.index}`,
              from,
              to,
              value: 0n,
              gasPrice: 0n,
              gasLimit: 0n,
              blockNumber: block.number,
              chainId: config.id,
              timestamp: block.timestamp,
              tokenTransfer,
            });
          }
        }

        // Cap token-only txs: keep whale-sized ones, random sample the rest
        let cappedTokenTxs = tokenOnlyTxs;
        if (tokenOnlyTxs.length > MAX_TOKEN_TXS_PER_BLOCK) {
          // Separate whales from non-whales
          const whales: RawTransaction[] = [];
          const rest: RawTransaction[] = [];
          for (const tx of tokenOnlyTxs) {
            const tt = tx.tokenTransfer!;
            const displayValue = Number(tt.rawValue) / Math.pow(10, tt.decimals);
            if (displayValue >= lookupToken(config.id, tt.contractAddress)!.whaleThreshold) {
              whales.push(tx);
            } else {
              rest.push(tx);
            }
          }
          // Fisher-Yates partial shuffle for random sampling
          const remaining = MAX_TOKEN_TXS_PER_BLOCK - whales.length;
          for (let i = rest.length - 1; i > 0 && rest.length - i <= remaining; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rest[i], rest[j]] = [rest[j], rest[i]];
          }
          cappedTokenTxs = [...whales, ...rest.slice(0, Math.max(0, remaining))];
        }

        // Cap native txs: sample if block has too many
        let nativeTxs = [...txMap.values()];
        if (nativeTxs.length > MAX_NATIVE_TXS_PER_BLOCK) {
          // Keep high-value txs (top 20% by value), random sample the rest
          nativeTxs.sort((a, b) => (a.value > b.value ? -1 : a.value < b.value ? 1 : 0));
          const keepTop = Math.ceil(MAX_NATIVE_TXS_PER_BLOCK * 0.2);
          const top = nativeTxs.slice(0, keepTop);
          const rest = nativeTxs.slice(keepTop);
          const sampleCount = MAX_NATIVE_TXS_PER_BLOCK - keepTop;
          // Fisher-Yates partial shuffle
          for (let i = rest.length - 1; i > 0 && rest.length - i <= sampleCount; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rest[i], rest[j]] = [rest[j], rest[i]];
          }
          nativeTxs = [...top, ...rest.slice(0, Math.max(0, sampleCount))];
        }

        const txs = [...nativeTxs, ...cappedTokenTxs];

        if (txs.length > 0) {
          this.callback(txs);
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn(`[ChainPulse] Error fetching block ${blockNumber}:`, err);
        }
      }
    });

    // If no block arrives within a reasonable window, flag it
    const timeout = Math.max(config.blockTime * 3, 15) * 1000;
    this.blockTimeoutId = setTimeout(() => {
      this.blockTimeoutId = null;
      if (!this.destroyed && !this.receivedFirstBlock) {
        if (import.meta.env.DEV) {
          console.warn(
            `[ChainPulse] No blocks received from ${config.name} after ${timeout / 1000}s`,
          );
        }
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
      if (import.meta.env.DEV) {
        console.warn(
          `[ChainPulse] ${this.chainId} disconnected, reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`,
        );
      }
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect().catch(() => this.handleDisconnect());
      }, delay);
    } else {
      if (import.meta.env.DEV) {
        console.warn(
          `[ChainPulse] ${this.chainId} max reconnect attempts reached, falling back`,
        );
      }
    }
  }

  private cleanupProvider(): void {
    if (this.blockTimeoutId !== null) {
      clearTimeout(this.blockTimeoutId);
      this.blockTimeoutId = null;
    }

    if (this.provider) {
      // Remove WebSocket listeners before destroying
      const ws = this.provider.websocket as WebSocket | undefined;
      if (ws) {
        if (this.wsCloseHandler) ws.removeEventListener('close', this.wsCloseHandler);
        if (this.wsErrorHandler) ws.removeEventListener('error', this.wsErrorHandler);
      }
      this.wsCloseHandler = null;
      this.wsErrorHandler = null;

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
